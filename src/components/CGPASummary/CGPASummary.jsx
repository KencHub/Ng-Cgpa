// ── CGPASummary.jsx ───────────────────────────────────────────────────────────
// Hero CGPA card in the right panel.
//
// Three display states:
//   1. No institution selected — prompts user to pick a school.
//   2. Institution selected, no courses — shows scale and empty message.
//   3. Courses entered — full CGPA display with class badge, progress bar,
//      classification formula hint, and quick stats.
//
// ClassBadge and CGPAProgressBar are imported from Batch 19.
// CGPASummary.css is also from Batch 19.
//
// The CGPA number uses an inline style for the degree-class color
// so that any classification (including custom-school classifications)
// renders correctly without needing extra CSS classes.


import React, { useMemo } from "react";
import ClassBadge      from "./ClassBadge.jsx";
import CGPAProgressBar from "./CGPAProgressBar.jsx";
import { ScaleBadge }  from "../InstitutionSelector/InstitutionSelector.jsx";
import "./CGPASummary.css";


// ── Degree class → colour map ─────────────────────────────────────────────────

const CLASS_COLORS = {
  "first":  "var(--color-class-first)",
  "2:1":    "var(--color-class-upper)",
  "upper":  "var(--color-class-upper)",
  "2:2":    "var(--color-class-lower)",
  "lower":  "var(--color-class-lower)",
  "third":  "var(--color-class-third)",
  "pass":   "var(--color-class-pass)",
  "fail":   "var(--color-class-none)",
};

function getClassColor(shortClass) {
  if (!shortClass) return "var(--color-text-muted)";
  const lower = shortClass.toLowerCase();
  for (const [key, color] of Object.entries(CLASS_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "var(--color-text-secondary)";
}


// ── Main component ────────────────────────────────────────────────────────────

export default function CGPASummary({
  cgpa,
  degreeClass,
  degreeClassShort,
  degreeClassEntry,
  totals,
  semesterCount,
  courseCount,
  scaleMax,
  institution,
  semesterSummaries,
}) {
  const hasInstitution = institution !== null && institution !== undefined;
  const hasCGPA        = cgpa !== null && cgpa !== undefined;
  const classColor     = getClassColor(degreeClassEntry?.short);

  // Percentage of scale achieved — used by progress bar
  const cgpaPct = hasCGPA
    ? Math.min(100, Math.round((cgpa / scaleMax) * 100))
    : 0;

  // Formula hint: "48.50 QP ÷ 12 CU" for transparency
  const formulaHint = useMemo(() => {
    if (!hasCGPA || !totals.totalCU) return null;
    const qp = Math.round(totals.totalQP * 100) / 100;
    return `${qp.toFixed(2)} QP ÷ ${totals.totalCU} CU`;
  }, [hasCGPA, totals]);

  return (
    <div className="cgpa-summary panel-card">

      {/* ── Card header ────────────────────────────────────────────────────── */}
      <div className="cgpa-summary__header">
        <div className="cgpa-summary__header-left">
          <span className="label cgpa-summary__section-label">CGPA</span>
          {hasInstitution && (
            <span className="cgpa-summary__institution">
              {institution.shortName}
            </span>
          )}
        </div>

        {hasInstitution && (
          <ScaleBadge
            scale={scaleMax}
            scaleGroup={institution.scaleGroup}
            compact
          />
        )}
      </div>


      {/* ── State: no institution ─────────────────────────────────────────── */}
      {!hasInstitution && (
        <div className="cgpa-summary__state cgpa-summary__state--empty">
          <span className="cgpa-summary__state-icon" aria-hidden="true">
            <IconMortarboard />
          </span>
          <p className="cgpa-summary__state-msg">
            Select your university to start tracking your CGPA.
          </p>
        </div>
      )}


      {/* ── State: institution set, no courses ───────────────────────────── */}
      {hasInstitution && !hasCGPA && (
        <div className="cgpa-summary__state cgpa-summary__state--no-data">
          <div className="cgpa-summary__display cgpa-summary__display--empty">
            <span
              className="cgpa-summary__number cgpa-summary__number--empty"
              aria-label="No CGPA data yet"
            >
              —
            </span>
            <span className="cgpa-summary__scale">/ {scaleMax.toFixed(1)}</span>
          </div>
          <p className="cgpa-summary__state-msg cgpa-summary__state-msg--sm">
            Enter courses to calculate your CGPA.
          </p>
        </div>
      )}


      {/* ── State: has CGPA data ──────────────────────────────────────────── */}
      {hasInstitution && hasCGPA && (
        <div className="cgpa-summary__body">

          {/* Hero number */}
          <div className="cgpa-summary__hero">
            <div className="cgpa-summary__display">
              <span
                className="cgpa-summary__number"
                style={{ color: classColor }}
                aria-label={`CGPA: ${cgpa.toFixed(2)} out of ${scaleMax.toFixed(1)}`}
              >
                {cgpa.toFixed(2)}
              </span>
              <span className="cgpa-summary__scale">
                / {scaleMax.toFixed(1)}
              </span>
            </div>

            {/* Class badge */}
            {degreeClassEntry && (
              <div className="cgpa-summary__badge-row">
                <ClassBadge entry={degreeClassEntry} />
              </div>
            )}

            {/* Formula hint for transparency */}
            {formulaHint && (
              <span
                className="cgpa-summary__formula"
                title="How your CGPA is calculated: total quality points ÷ total credit units"
              >
                {formulaHint}
              </span>
            )}
          </div>


          {/* Progress bar with classification boundaries */}
          <div className="cgpa-summary__progress-wrap">
            <CGPAProgressBar
              cgpa={cgpa}
              scaleMax={scaleMax}
              classEntry={degreeClassEntry}
              classifications={institution?.classifications ?? []}
            />
          </div>


          {/* Divider */}
          <hr className="divider cgpa-summary__divider" />


          {/* Quick stats grid */}
          <div className="cgpa-summary__stats">
            <QuickStat
              label="Credit Units"
              value={totals.totalCU}
              icon={<IconCU />}
              title="Total credit units attempted across all semesters"
            />
            <QuickStat
              label="Quality Points"
              value={(Math.round(totals.totalQP * 100) / 100).toFixed(2)}
              icon={<IconQP />}
              title="Total quality points: sum of grade point × credit units for every course"
            />
            <QuickStat
              label="Semesters"
              value={semesterCount}
              icon={<IconSemester />}
              title="Completed semesters with courses entered"
            />
            <QuickStat
              label="Courses"
              value={courseCount}
              icon={<IconCourse />}
              title="Total courses entered across all semesters"
            />
          </div>


          {/* GPA trend sparkline summary (text) */}
          {semesterSummaries && semesterSummaries.length > 1 && (
            <GPATrend summaries={semesterSummaries} scaleMax={scaleMax} />
          )}

        </div>
      )}

    </div>
  );
}


// ── Quick stat ────────────────────────────────────────────────────────────────

function QuickStat({ label, value, icon, title }) {
  const display = value === 0 || value === "0" || value === "0.00"
    ? (label === "Quality Points" ? "0.00" : "0")
    : value;

  return (
    <div className="quick-stat" title={title}>
      <div className="quick-stat__icon" aria-hidden="true">{icon}</div>
      <div className="quick-stat__text">
        <span className="quick-stat__value">{display}</span>
        <span className="label quick-stat__label">{label}</span>
      </div>
    </div>
  );
}


// ── GPA trend summary ─────────────────────────────────────────────────────────
// A compact text-based trend indicator showing whether performance
// is improving or declining across semesters.

function GPATrend({ summaries, scaleMax }) {
  const valid = summaries.filter((s) => s.gpa !== null);
  if (valid.length < 2) return null;

  const first   = valid[0].gpa;
  const last    = valid[valid.length - 1].gpa;
  const delta   = Math.round((last - first) * 100) / 100;
  const best    = valid.reduce((a, b) => (a.gpa > b.gpa ? a : b));
  const lowest  = valid.reduce((a, b) => (a.gpa < b.gpa ? a : b));

  const direction = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";

  return (
    <div className="gpa-trend">
      <div className="gpa-trend__header">
        <span className="label">GPA Trend</span>
        <span
          className={`gpa-trend__indicator gpa-trend__indicator--${direction}`}
          aria-label={
            direction === "up"   ? "GPA improving" :
            direction === "down" ? "GPA declining" :
            "GPA stable"
          }
        >
          {direction === "up"   ? <IconTrendUp />   :
           direction === "down" ? <IconTrendDown /> :
           <IconTrendFlat />}
          <span>
            {direction === "up"   ? `+${delta.toFixed(2)} from first semester` :
             direction === "down" ? `${delta.toFixed(2)} from first semester` :
             "Stable across semesters"}
          </span>
        </span>
      </div>

      <div className="gpa-trend__detail">
        <span className="gpa-trend__peak">
          Best: <strong>{best.gpa.toFixed(2)}</strong>
          <span className="gpa-trend__sem-label"> ({shortenLabel(best.label)})</span>
        </span>
        <span className="gpa-trend__low">
          Lowest: <strong>{lowest.gpa.toFixed(2)}</strong>
          <span className="gpa-trend__sem-label"> ({shortenLabel(lowest.label)})</span>
        </span>
      </div>
    </div>
  );
}

function shortenLabel(label) {
  if (!label) return "";
  return label.replace(/\bSemester\b/gi, "").replace(/\s{2,}/g, " ").trim();
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconMortarboard() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40"
      fill="none" aria-hidden="true">
      <path d="M6 24 L20 14 L34 24"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <rect x="12" y="24" width="16" height="10" rx="2"
        fill="currentColor" opacity="0.4" />
      <rect x="18.5" y="11" width="3" height="4" rx="1.5"
        fill="currentColor" opacity="0.7" />
      <circle cx="20" cy="10" r="2.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function IconCU() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 7h5M7 4.5v5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

function IconQP() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <path d="M2 10.5l3-3 2 2 5-5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSemester() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <rect x="1.5" y="3" width="11" height="9.5" rx="1.5"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 1.5v3M9.5 1.5v3M1.5 6.5h11"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

function IconCourse() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <rect x="2" y="1.5" width="10" height="11" rx="1.5"
        stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <path d="M2 10l4-4 2 2 4-5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3h3v3"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrendDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <path d="M2 4l4 4 2-2 4 5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11h3V8"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrendFlat() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true">
      <path d="M2 7h10"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <path d="M9 4.5l2.5 2.5L9 9.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}