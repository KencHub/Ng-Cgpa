// ── SemesterSummaryBar.jsx ────────────────────────────────────────────────────
// Sticky footer bar at the bottom of each semester panel.
// Shows total credit units, total quality points, and the semester GPA.
//
// CSS lives in SemesterPanel.css (already built in Batch 17).
// This component has no CSS import of its own.


import React from "react";


export default function SemesterSummaryBar({
  totalCU,
  totalQP,
  gpa,
  courseCount,
  institution,
}) {
  const hasData    = courseCount > 0;
  const qpDisplay  = totalQP ? (Math.round(totalQP * 100) / 100).toFixed(2) : "0.00";
  const scaleMax   = institution?.scale ?? 5.0;

  return (
    <div
      className="semester-summary-bar"
      role="status"
      aria-label="Semester summary"
    >
      {/* ── Left stats ───────────────────────────────────────────────────── */}
      <div className="semester-summary-bar__stat">
        <span className="semester-summary-bar__label">Credit Units</span>
        <span className="semester-summary-bar__value">
          {hasData ? totalCU : "—"}
        </span>
      </div>

      <div
        className="semester-summary-bar__stat"
        title="Total quality points = Σ (grade point × credit units)"
      >
        <span className="semester-summary-bar__label">Quality Points</span>
        <span className="semester-summary-bar__value">
          {hasData ? qpDisplay : "—"}
        </span>
      </div>

      <div className="semester-summary-bar__stat">
        <span className="semester-summary-bar__label">Courses</span>
        <span className="semester-summary-bar__value">{courseCount}</span>
      </div>

      {/* ── GPA — right-aligned ───────────────────────────────────────────── */}
      {gpa !== null ? (
        <div className="semester-summary-bar__gpa-block">
          <span
            className="semester-summary-bar__gpa-value"
            aria-label={`Semester GPA: ${gpa.toFixed(2)} out of ${scaleMax.toFixed(1)}`}
          >
            {gpa.toFixed(2)}
          </span>
          <span className="semester-summary-bar__gpa-label">
            / {scaleMax.toFixed(1)} GPA
          </span>
        </div>
      ) : (
        <span className="semester-summary-bar__gpa-empty">
          {hasData
            ? "Enter credit units to see GPA"
            : "Add courses to see GPA"}
        </span>
      )}
    </div>
  );
}