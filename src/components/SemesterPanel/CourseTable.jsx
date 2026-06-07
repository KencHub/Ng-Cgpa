// ── CourseTable.jsx ───────────────────────────────────────────────────────────
// Changed: What-if bar removed from top of table.
// Changed: What-if button moved to footer as peer action button (idle state).
// Changed: Active state is a single bordered unit: [Exit What-if | ⓘ | ~GPA delta]
//          One accent-orange border wraps all three segments, signalling
//          everything inside is hypothetical. Real GPA in header stays clean.

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import CourseRow from "./CourseRow.jsx";


// ── InfoPopover ────────────────────────────────────────────────────────────────

function InfoPopover({ anchorRef, open, onClose, children, width = 240 }) {
  const [coords, setCoords] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open || !anchorRef.current) { setCoords(null); return; }
    const rect = anchorRef.current.getBoundingClientRect();
    const vpW  = window.innerWidth;
    const EDGE = 8;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(EDGE, Math.min(left, vpW - width - EDGE));
    const arrowLeft = Math.max(12, Math.min(
      (rect.left + rect.width / 2) - left,
      width - 12
    ));
    setCoords({ top: rect.top, left, arrowLeft });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (
        popRef.current    && !popRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) { onClose(); }
    }
    function handleKey(e)   { if (e.key === "Escape") onClose(); }
    function handleScroll() { onClose(); }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown",     handleKey);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown",     handleKey);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [open, onClose, anchorRef]);

  if (!open || !coords) return null;

  return ReactDOM.createPortal(
    <div
      ref={popRef}
      className="info-popover"
      role="tooltip"
      style={{
        position:  "fixed",
        top:       coords.top,
        left:      coords.left,
        width,
        transform: "translateY(calc(-100% - 10px))",
        zIndex:    9999,
      }}
    >
      <div className="info-popover__body">{children}</div>
      <div className="info-popover__arrow" style={{ left: coords.arrowLeft }} />
    </div>,
    document.body
  );
}


// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "name",  label: "Course", hint: "Course code or name"      },
  { key: "cu",    label: "CU",     hint: "Credit units (1–6)"       },
  { key: "score", label: "Score",  hint: "Exam score (0–100)"       },
  { key: "grade", label: "Grade",  hint: "Letter grade"             },
  { key: "gp",    label: "GP",     hint: "Grade point (derived)"    },
  { key: "qp",    label: "QP",     hint: "Quality points (derived)" },
];


// ── CourseTable ───────────────────────────────────────────────────────────────

export default function CourseTable({
  courses,
  semesterId,
  activeGradeTable,
  institution,
  onAddCourse,
  onRemoveCourse,
  onUpdateCourse,
  onOpenImport,
  whatIfMode,
  whatIfGrades,
  onWhatIfToggle,
  onWhatIfGradeChange,
  whatIfSemesterGPA,
  gpa,
}) {
  const isDisabled = !institution;
  const hasCourses = courses.length > 0;

  const lastRowRef    = useRef(null);
  const prevCountRef  = useRef(courses.length);
  const infoAnchorRef = useRef(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // Auto-focus new course row
  useEffect(() => {
    if (courses.length > prevCountRef.current && lastRowRef.current) {
      const input = lastRowRef.current.querySelector("input[type='text']");
      if (input) {
        input.focus();
        lastRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
    prevCountRef.current = courses.length;
  }, [courses.length]);

  // Close info popover when what-if mode exits
  useEffect(() => { setInfoOpen(false); }, [whatIfMode]);

  // Delta between what-if GPA and real GPA
  const whatIfDelta =
    whatIfSemesterGPA !== null &&
    whatIfSemesterGPA !== undefined &&
    gpa !== null
      ? Math.round((whatIfSemesterGPA - gpa) * 100) / 100
      : null;

  // Idle what-if button only appears once at least one course has a grade
  const showWhatIfIdle = !whatIfMode && courses.some(c => c.grade);


  if (isDisabled) {
    return (
      <div className="course-table course-table--disabled">
        <div className="course-table__blocked">
          <span className="course-table__blocked-icon" aria-hidden="true">
            <IconLock />
          </span>
          <p className="course-table__blocked-msg">
            Select your university first to begin entering courses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="course-table" role="table" aria-label="Courses">

      {/* ── Column headers ────────────────────────────────────────────────── */}
      <div className="course-table__header" role="row">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`course-table__th course-table__th--${col.key}`}
            role="columnheader"
            title={col.hint}
          >
            {col.label}
          </div>
        ))}
        <div className="course-table__th course-table__th--actions" role="columnheader">
          <span className="sr-only">Actions</span>
        </div>
      </div>


      {/* ── Course rows ───────────────────────────────────────────────────── */}
      {hasCourses ? (
        <div className="course-table__body">
          {courses.map((course, idx) => (
            <CourseRow
              key={course.id}
              ref={idx === courses.length - 1 ? lastRowRef : null}
              course={course}
              activeGradeTable={activeGradeTable}
              institution={institution}
              rowIndex={idx}
              onUpdate={(courseId, changes) =>
                onUpdateCourse(semesterId, courseId, changes)
              }
              onRemove={(courseId) =>
                onRemoveCourse(semesterId, courseId)
              }
              whatIfMode={whatIfMode}
              whatIfGradeLetter={whatIfGrades?.[course.id] ?? null}
              onWhatIfChange={(letter) =>
                onWhatIfGradeChange(course.id, letter)
              }
            />
          ))}
        </div>
      ) : (
        <EmptyCoursesState
          onAdd={() => onAddCourse(semesterId)}
          onImport={onOpenImport}
        />
      )}


      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="course-table__footer">

        <button
          className="course-table__add-btn"
          onClick={() => onAddCourse(semesterId)}
          type="button"
          aria-label="Add a new course to this semester"
        >
          <IconPlus />
          <span>Add Course</span>
        </button>

        <button
          className="course-table__import-btn"
          onClick={onOpenImport}
          type="button"
          aria-label="Bulk import courses from text"
          title="Paste multiple courses at once"
        >
          <IconImport />
          <span>Bulk Import</span>
        </button>

        {/* Idle — appears once a course has a grade */}
        {showWhatIfIdle && (
          <button
            className="course-table__whatif-toggle"
            onClick={onWhatIfToggle}
            type="button"
            aria-pressed={false}
          >
            <IconWhatIf />
            <span>What-if?</span>
          </button>
        )}

        {/* Active — one bordered unit: [Exit What-if | ⓘ | ~GPA delta] */}
        {whatIfMode && (
          <div
            className="course-table__whatif-unit"
            role="group"
            aria-label="What-if mode active"
          >
            {/* Segment 1: exit action */}
            <button
              className="course-table__whatif-exit"
              onClick={onWhatIfToggle}
              type="button"
              aria-pressed={true}
            >
              <IconWhatIf />
              <span>Exit What-if</span>
            </button>

            {/* Segment 2: ⓘ divider */}
            <button
              ref={infoAnchorRef}
              className="course-table__whatif-info-seg"
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              aria-expanded={infoOpen}
              aria-label="What-if mode information"
            >
              <IconInfo />
            </button>

            <InfoPopover
              anchorRef={infoAnchorRef}
              open={infoOpen}
              onClose={() => setInfoOpen(false)}
              width={260}
            >
              Hypothetical semester GPA based on your what-if grade selections. Your real GPA is unchanged.
            </InfoPopover>

            {/* Segment 3: GPA result — only when overrides produce a value */}
            {whatIfSemesterGPA !== null && whatIfSemesterGPA !== undefined && (
              <span
                className="course-table__whatif-result"
                aria-label={`What-if semester GPA: ${whatIfSemesterGPA.toFixed(2)}`}
              >
                <span className="course-table__whatif-result-tilde">~</span>
                <span className="course-table__whatif-result-value">
                  {whatIfSemesterGPA.toFixed(2)}
                </span>
                {whatIfDelta !== null && (
                  <span
                    className={[
                      "course-table__whatif-gpa-delta",
                      whatIfDelta >= 0
                        ? "course-table__whatif-gpa-delta--up"
                        : "course-table__whatif-gpa-delta--down",
                    ].join(" ")}
                  >
                    {whatIfDelta > 0
                      ? `+${whatIfDelta.toFixed(2)}`
                      : whatIfDelta.toFixed(2)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {hasCourses && (
          <span className="course-table__count" aria-live="polite">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        )}

      </div>

    </div>
  );
}


// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyCoursesState({ onAdd, onImport }) {
  return (
    <div className="course-table__empty">
      <p className="course-table__empty-msg">
        No courses yet. Add them one by one or paste a list.
      </p>
      <div className="course-table__empty-actions">
        <button className="btn btn-primary" onClick={onAdd} type="button">
          <IconPlus />
          Add Course
        </button>
        <button className="btn btn-secondary" onClick={onImport} type="button">
          <IconImport />
          Paste Courses
        </button>
      </div>
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 9v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 1.5v7M4.5 6.5 7 9l2.5-2.5"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconWhatIf() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 5h4l1.5 2L9 5h3" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 7l1 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6.5 7l-1 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.7" fill="currentColor" />
    </svg>
  );
}