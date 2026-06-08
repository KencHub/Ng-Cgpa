// ── WESConverter.jsx ──────────────────────────────────────────────────────────
// Self-contained WES conversion feature.
//
// Trigger button in CGPASummary opens a modal portal with three views:
//
//   "select"         — landing: choose between the two conversion types
//   "equivalent"     — classification-based (3-step breakdown, existing)
//   "coursebycourse" — per-course breakdown with semester accordions
//
// Both conversions run upfront (pure sync, < 1ms for any realistic course
// count). No loading state is needed or shown — the data is already in memory.
//
// Edge cases (unsupported scale, no data, no degree) are handled in
// wesConverter.js and surfaced here as either hard blocks or advisories.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { createPortal }                             from "react-dom";
import { convertToWES, convertCoursesToWES, checkWESReadiness } from "../../utils/wesConverter.js";

// ── Grade style map ───────────────────────────────────────────────────────────
// Covers every grade returned by both conversion functions.

const GRADE_STYLES = {
  "A":  { background: "var(--color-success-light)",    color: "var(--color-success)",        border: "var(--color-success)"       },
  "B+": { background: "rgba(27, 67, 50, 0.08)",        color: "var(--color-primary)",        border: "var(--color-primary-light)" },
  "B":  { background: "var(--color-warning-light)",    color: "var(--color-warning)",        border: "var(--color-warning)"       },
  "B-": { background: "rgba(188, 108, 37, 0.12)",      color: "var(--color-warning)",        border: "var(--color-warning)"       },
  "C+": { background: "var(--color-surface-3)",        color: "var(--color-text-secondary)", border: "var(--color-border-strong)" },
  "C":  { background: "var(--color-surface-3)",        color: "var(--color-text-secondary)", border: "var(--color-border-strong)" },
  "D":  { background: "var(--color-danger-light)",     color: "var(--color-danger)",         border: "var(--color-danger)"        },
  "F":  { background: "var(--color-danger-light)",     color: "var(--color-danger)",         border: "var(--color-danger)"        },
};

function getGradeStyle(grade) {
  return GRADE_STYLES[grade] ?? GRADE_STYLES["C"];
}

// ── Exported component — trigger + portal ─────────────────────────────────────

export default function WESConverter({
  cgpa,
  degreeClassEntry,
  institution,
  useUILegacyScale,
  semesterCount,
  semesters,
}) {
  const [open, setOpen]     = useState(false);
  const handleOpen          = useCallback(() => setOpen(true),  []);
  const handleClose         = useCallback(() => setOpen(false), []);

  if (!institution) return null;

  const readiness = checkWESReadiness(semesters);

  
  // Below threshold — show a locked placeholder with progress indicator
  if (!readiness.visible) {
    const progressPct = Math.min(
      Math.round((readiness.totalGradedCU / 15) * 100),
      100
    );
    return (
      <div className="wes-trigger wes-trigger--locked" aria-disabled="true">
        <div className="wes-trigger__locked-row">
          <span className="wes-trigger__icon" aria-hidden="true">
            <IconLock />
          </span>
          <span className="wes-trigger__text">Convert to International Scale</span>
          <span className="wes-trigger__badge wes-trigger__badge--locked">WES</span>
        </div>
        <div
          className="wes-trigger__progress"
          role="progressbar"
          aria-valuenow={readiness.totalGradedCU}
          aria-valuemin={0}
          aria-valuemax={15}
          aria-label={`${readiness.totalGradedCU} of 15 credit units entered`}
        >
          <div className="wes-trigger__progress-bar">
            <div
              className="wes-trigger__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="wes-trigger__progress-label">
            {readiness.totalGradedCU} / 15 CU
          </span>
        </div>
        <p className="wes-trigger__locked-msg">{readiness.message}</p>
      </div>
    );
  }

  return (
    <>
      <button
        className="wes-trigger"
        onClick={handleOpen}
        title="See how your CGPA converts to international scales (WES)"
        aria-haspopup="dialog"
      >
        <span className="wes-trigger__icon" aria-hidden="true">
          <IconGlobe />
        </span>
        <span className="wes-trigger__text">Convert to International Scale</span>
        <span className="wes-trigger__badge">WES</span>
        <span className="wes-trigger__arrow" aria-hidden="true">
          <IconArrowRight />
        </span>
      </button>

      {open && createPortal(
        <WESModal
          cgpa={cgpa}
          degreeClassEntry={degreeClassEntry}
          institution={institution}
          useUILegacyScale={useUILegacyScale}
          semesterCount={semesterCount}
          semesters={semesters}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function WESModal({
  cgpa, degreeClassEntry, institution, useUILegacyScale,
  semesterCount, semesters, onClose,
}) {
  // View state: "select" | "equivalent" | "coursebycourse"
  // Initialises to "select" every time the modal opens (WESModal mounts fresh).
  const [view, setView] = useState("select");

  // Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Both conversions computed upfront — pure sync functions, no UI cost
  const classResult = convertToWES({
    cgpa, degreeClassEntry, institution, useUILegacyScale, semesterCount,
  });

  const cbcResult = convertCoursesToWES({
    semesters, institution, useUILegacyScale,
  });

  const gradeStyle = classResult.supported
    ? getGradeStyle(classResult.canadianGrade)
    : null;

  const subtitle =
    view === "equivalent"      ? "Classification-Based Conversion" :
    view === "coursebycourse"  ? "Course-by-Course Breakdown"       :
    "WES (World Education Services) Equivalent";

  return (
    <div
      className="wes-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="International Scale Conversion"
    >
      <div className="wes-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="wes-modal__header">
          <div className="wes-modal__header-left">

            {view !== "select" ? (
              <button
                className="wes-back-btn"
                onClick={() => setView("select")}
                aria-label="Back to conversion options"
              >
                <IconChevronLeft />
                <span>Back</span>
              </button>
            ) : (
              <span className="wes-modal__header-icon" aria-hidden="true">
                <IconGlobeLg />
              </span>
            )}

            <div>
              <h2 className="wes-modal__title">
                International Scale Conversion
              </h2>
              <p className="wes-modal__subtitle">{subtitle}</p>
            </div>

          </div>
          <button
            className="wes-modal__close"
            onClick={onClose}
            aria-label="Close conversion panel"
          >
            <IconClose />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="wes-modal__body">

          {/*
            key={view} causes React to remount this div on every view change,
            which re-triggers the CSS entry animation defined on .wes-view-content.
          */}
          <div className="wes-view-content" key={view}>

            {view === "select" && (
              <SelectView
                onSelect={setView}
                cbcAvailable={cbcResult.supported}
              />
            )}

            {view === "equivalent" && (
              <EquivalentView
                result={classResult}
                gradeStyle={gradeStyle}
                institution={institution}
                cgpa={cgpa}
              />
            )}

            {view === "coursebycourse" && (
              <CourseByCourseView
                cbcResult={cbcResult}
                institution={institution}
              />
            )}

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="wes-modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
          {view !== "select" && (
            <a
              href="https://www.wes.org"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary wes-modal__wes-link"
            >
              Verify on wes.org
              <span aria-hidden="true"><IconExternal /></span>
            </a>
          )}
        </div>

      </div>
    </div>
  );
}

// ── View: Selection Screen ────────────────────────────────────────────────────

function SelectView({ onSelect, cbcAvailable }) {
  return (
    <div className="wes-select">
      <p className="wes-select__intro">
        Choose how you want to view your international grade equivalent.
      </p>

      <div className="wes-option-cards">

        {/* Option 1 — Classification-based */}
        <button
          className="wes-option-card"
          onClick={() => onSelect("equivalent")}
          aria-label="View classification-based international equivalent"
        >
          <span className="wes-option-card__icon" aria-hidden="true">
            <IconGlobeLg />
          </span>
          <span className="wes-option-card__content">
            <span className="wes-option-card__title">
              International Equivalent
            </span>
            <span className="wes-option-card__desc">
              Your degree classification mapped to a Canadian grade and US GPA.
              Based on WES's published Nigeria conversion guide.
            </span>
          </span>
          <span className="wes-option-card__arrow" aria-hidden="true">
            <IconArrowRight />
          </span>
        </button>

        {/* Option 2 — Course by course */}
        <button
          className="wes-option-card"
          onClick={() => onSelect("coursebycourse")}
          aria-label="View course-by-course breakdown"
        >
          <span className="wes-option-card__icon" aria-hidden="true">
            <IconList />
          </span>
          <span className="wes-option-card__content">
            <span className="wes-option-card__title">
              Course by Course
            </span>
            <span className="wes-option-card__desc">
              Every course mapped individually to its WES grade equivalent,
              grouped by semester.
              {!cbcAvailable && (
                <span className="wes-option-card__unavail">
                  {" "}Add your course grades first.
                </span>
              )}
            </span>
          </span>
          <span className="wes-option-card__arrow" aria-hidden="true">
            <IconArrowRight />
          </span>
        </button>

      </div>
    </div>
  );
}

// ── View: Classification-Based Equivalent ─────────────────────────────────────

function EquivalentView({ result, gradeStyle, institution, cgpa }) {
  if (!result.supported) {
    return (
      <div className="wes-unsupported">
        <span className="wes-unsupported__icon" aria-hidden="true">
          <IconBlock />
        </span>
        <p className="wes-unsupported__msg">{result.reason}</p>
      </div>
    );
  }

  return (
    <>
      {/* Early data advisory */}
      {result.warning && (
        <div className="wes-advisory" role="status">
          <span className="wes-advisory__icon" aria-hidden="true">
            <IconWarningTriangle />
          </span>
          <p className="wes-advisory__text">{result.warning}</p>
        </div>
      )}

      {/* Step 1 — Academic Record */}
      <div className="wes-step">
        <div className="wes-step__head">
          <span className="wes-step__num" aria-hidden="true">1</span>
          <span className="wes-step__label">Your Academic Record</span>
        </div>
        <div className="wes-step__body">
          <dl className="wes-record">
            <div className="wes-record__row">
              <dt className="wes-record__key">University</dt>
              <dd className="wes-record__val">
                {institution.name}
                <span className="wes-record__id"> ({institution.id})</span>
              </dd>
            </div>
            <div className="wes-record__row">
              <dt className="wes-record__key">Grading Scale</dt>
              <dd className="wes-record__val">{result.scaleLabel}</dd>
            </div>
            <div className="wes-record__row">
              <dt className="wes-record__key">Your CGPA</dt>
              <dd className="wes-record__val wes-record__val--cgpa">
                {cgpa.toFixed(2)}
                <span className="wes-record__of">
                  {" "}/ {institution.scale.toFixed(1)}
                </span>
              </dd>
            </div>
            <div className="wes-record__row">
              <dt className="wes-record__key">Classification</dt>
              <dd className="wes-record__val">
                <span className="wes-record__class-pill">
                  {result.degreeClass}
                </span>
              </dd>
            </div>
            <div className="wes-record__row wes-record__row--last">
              <dt className="wes-record__key">Band Range</dt>
              <dd className="wes-record__val wes-record__val--mono">
                {result.nigerianRange} / {institution.scale.toFixed(1)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Step 2 — Methodology */}
      <div className="wes-step">
        <div className="wes-step__head">
          <span className="wes-step__num" aria-hidden="true">2</span>
          <span className="wes-step__label">How WES Converts Nigerian Grades</span>
        </div>
        <div className="wes-step__body">
          <p className="wes-method__text">
            WES maps your result using your{" "}
            <strong>degree classification band</strong>, not a raw number formula.
            For each band on the <strong>{result.scaleLabel}</strong>, WES assigns
            a standard Canadian letter grade and a US 4.0 GPA equivalent. This is
            consistent with WES's published Nigeria grade conversion guide.
          </p>
          <div className="wes-method__mapping">
            <div className="wes-method__mapping-row">
              <span className="wes-method__mapping-key">Your classification</span>
              <span className="wes-method__mapping-arrow">→</span>
              <span className="wes-method__mapping-val">{result.degreeClass}</span>
            </div>
            <div className="wes-method__mapping-row">
              <span className="wes-method__mapping-key">CGPA band</span>
              <span className="wes-method__mapping-arrow">→</span>
              <span className="wes-method__mapping-val wes-method__mapping-val--mono">
                {result.nigerianRange} / {institution.scale.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 — International Equivalent */}
      <div className="wes-step">
        <div className="wes-step__head">
          <span className="wes-step__num" aria-hidden="true">3</span>
          <span className="wes-step__label">Your International Equivalent</span>
        </div>
        <div className="wes-step__body">

          <div className="wes-cards">
            <div
              className="wes-card"
              style={{
                backgroundColor: gradeStyle.background,
                borderColor:     gradeStyle.border,
              }}
            >
              <span className="wes-card__label">Canadian Grade</span>
              <span
                className="wes-card__value"
                style={{ color: gradeStyle.color }}
                aria-label={`Canadian grade: ${result.canadianGrade}`}
              >
                {result.canadianGrade}
              </span>
              <span className="wes-card__context">WES Standard</span>
            </div>

            <div
              className="wes-card"
              style={{
                backgroundColor: gradeStyle.background,
                borderColor:     gradeStyle.border,
              }}
            >
              <span className="wes-card__label">US GPA (4.0 Scale)</span>
              <span
                className="wes-card__value"
                style={{ color: gradeStyle.color }}
                aria-label={`US GPA equivalent: ${result.usGPA} out of 4.0`}
              >
                {result.usGPA}
                <span className="wes-card__of">/4.0</span>
              </span>
              <span className="wes-card__context">GPA Equivalent</span>
            </div>
          </div>

          <div className="wes-admission">
            <span className="wes-admission__icon" aria-hidden="true">
              <IconInfo />
            </span>
            <p className="wes-admission__text">{result.admissionNote}</p>
          </div>

        </div>
      </div>

      <WESDisclaimer />
    </>
  );
}

// ── View: Course by Course ────────────────────────────────────────────────────

function CourseByCourseView({ cbcResult, institution }) {
  // Track which semester accordions are expanded. All start collapsed.
  const [openSemesters, setOpenSemesters] = useState(new Set());

  function toggleSemester(id) {
    setOpenSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!cbcResult.supported) {
    return (
      <div className="wes-unsupported">
        <span className="wes-unsupported__icon" aria-hidden="true">
          <IconBlock />
        </span>
        <p className="wes-unsupported__msg">{cbcResult.reason}</p>
      </div>
    );
  }

  const { semesters, totals } = cbcResult;

  return (
    <>
      {/* Summary bar */}
      <div className="wes-cbc__summary">
        <span className="wes-cbc__summary-text">
          {totals.gradedCourses} course{totals.gradedCourses !== 1 ? "s" : ""}
          {" "}across{" "}
          {totals.semesterCount} semester{totals.semesterCount !== 1 ? "s" : ""}
        </span>
        {totals.failCount > 0 && (
          <span
            className="wes-cbc__fail-badge"
            aria-label={`${totals.failCount} failed course${totals.failCount !== 1 ? "s" : ""}`}
          >
            {totals.failCount} F{totals.failCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Semester accordions */}
      {semesters.map((sem) => (
        <SemesterBlock
          key={sem.id}
          semester={sem}
          isOpen={openSemesters.has(sem.id)}
          onToggle={() => toggleSemester(sem.id)}
        />
      ))}

      {/* Weighted WES GPA */}
      {totals.weightedWesGPA !== null && (
        <div className="wes-cbc__footer">
          <div className="wes-cbc__footer-left">
            <span className="wes-cbc__footer-label">Weighted WES GPA</span>
            <span className="wes-cbc__footer-sub">
              sum(WES GPA × credit units) ÷ {totals.totalCU} CU
            </span>
          </div>
          <span
            className="wes-cbc__footer-value"
            aria-label={`Weighted WES GPA: ${totals.weightedWesGPA.toFixed(2)} out of 4.0`}
          >
            {totals.weightedWesGPA.toFixed(2)}
            <span className="wes-cbc__footer-of">/4.0</span>
          </span>
        </div>
      )}

      <WESDisclaimer />
    </>
  );
}

// ── Semester accordion block ──────────────────────────────────────────────────

function SemesterBlock({ semester, isOpen, onToggle }) {
  const courseCount = semester.courses.length;
  const failCount   = semester.courses.filter((c) => c.isFail).length;

  return (
    <div className="wes-cbc__semester">

      {/* Collapsible header */}
      <button
        className="wes-cbc__sem-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`${semester.label}, ${courseCount} course${courseCount !== 1 ? "s" : ""}${failCount ? `, ${failCount} failed` : ""}`}
      >
        <span
          className={`wes-cbc__sem-chevron${isOpen ? " wes-cbc__sem-chevron--open" : ""}`}
          aria-hidden="true"
        >
          <IconChevronRight />
        </span>
        <span className="wes-cbc__sem-label">{semester.label}</span>
        <span className="wes-cbc__sem-count">
          {courseCount} course{courseCount !== 1 ? "s" : ""}
        </span>
        {failCount > 0 && (
          <span className="wes-cbc__sem-fail-badge" aria-hidden="true">
            {failCount}F
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="wes-cbc__courses">

          {/* Column headers */}
          <div className="wes-cbc__col-headers" aria-hidden="true">
            <span className="wes-cbc__col-hdr">Course</span>
            <span className="wes-cbc__col-hdr wes-cbc__col-hdr--center">Grade</span>
            <span className="wes-cbc__col-hdr"></span>
            <span className="wes-cbc__col-hdr wes-cbc__col-hdr--center">WES</span>
            <span className="wes-cbc__col-hdr wes-cbc__col-hdr--right">GPA</span>
          </div>

          {/* Course rows */}
          {semester.courses.map((course) => {
            const ws = getGradeStyle(course.wesGrade);
            return (
              <div
                key={course.id}
                className={`wes-cbc__course${course.isFail ? " wes-cbc__course--fail" : ""}`}
              >
                <span className="wes-cbc__course-name" title={course.name}>
                  {course.name}
                </span>
                <span className="wes-cbc__course-grade">
                  {course.grade}
                </span>
                <span className="wes-cbc__course-arrow" aria-hidden="true">
                  →
                </span>
                <span
                  className="wes-cbc__course-wes"
                  style={{
                    backgroundColor: ws.background,
                    color:           ws.color,
                  }}
                  aria-label={`WES equivalent: ${course.wesGrade}`}
                >
                  {course.wesGrade}
                </span>
                <span className="wes-cbc__course-gpa">
                  {course.wesGPA !== null
                    ? course.wesGPA.toFixed(1)
                    : "—"}
                </span>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

// ── Shared disclaimer ─────────────────────────────────────────────────────────

function WESDisclaimer() {
  return (
    <div className="wes-disclaimer">
      <span className="wes-disclaimer__icon" aria-hidden="true">
        <IconWarningFill />
      </span>
      <div className="wes-disclaimer__content">
        <p className="wes-disclaimer__lead">
          This is an estimate, not an official WES evaluation.
        </p>
        <p className="wes-disclaimer__body">
          WES evaluates transcripts course by course. Your actual evaluation
          outcome may differ based on transcript details, your institution's
          recognition status, and the purpose of your evaluation. Always
          verify directly with WES before using this figure in any application.
        </p>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 1.5C7 1.5 5.2 3.8 5.2 7s1.8 5.5 1.8 5.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 1.5C7 1.5 8.8 3.8 8.8 7s-1.8 5.5-1.8 5.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.5 7h11M2 4.5h10M2 9.5h10"
        stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobeLg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 2.5C11 2.5 8.5 6 8.5 11s2.5 8.5 2.5 8.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 2.5C11 2.5 13.5 6 13.5 11s-2.5 8.5-2.5 8.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 11h17M3 7h16M3 15h16"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3l3 3-3 3"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 11L5 7l4-4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 9.5L7.5 6 4 2.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M4 6h14M4 11h14M4 16h9"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4" cy="6"  r="1" fill="currentColor" />
      <circle cx="4" cy="11" r="1" fill="currentColor" />
      <circle cx="4" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconBlock() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="13" stroke="currentColor"
        strokeWidth="1.5" opacity="0.35" />
      <path d="M11 18h14" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconWarningTriangle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2L12.5 11.5H1.5L7 2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v2.5" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.65" fill="currentColor" />
    </svg>
  );
}

function IconWarningFill() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2L14.5 13H1.5L8 2Z"
        fill="currentColor" opacity="0.15" />
      <path d="M8 2L14.5 13H1.5L8 2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7v2.5" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.5V10" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="8" height="6" rx="1.5"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M4.5 2H2v7h7V6.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H9v2.5M9 2L5.5 5.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}