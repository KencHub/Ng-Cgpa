// ── SemesterPanel.jsx ─────────────────────────────────────────────────────────
// Changed: What-if GPA removed from SemesterHeader.
// Changed: whatIfSemesterGPA and gpa passed to CourseTable instead,
//          where the bar shows them inline beside the toggle button.

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import CourseTable        from "./CourseTable.jsx";
import SemesterSummaryBar from "./SemesterSummaryBar.jsx";
import { computeSemesterSummary } from "../../utils/calculator.js";
import "./SemesterPanel.css";


// ── What-if semester GPA helper ───────────────────────────────────────────────

function computeWhatIfSemesterGPA(courses, gradeTable, whatIfGrades) {
  if (!Array.isArray(courses) || !whatIfGrades) return null;

  const hasAnyOverride = courses.some(
    (c) => c.id in whatIfGrades && whatIfGrades[c.id]
  );
  if (!hasAnyOverride) return null;

  let totalCU = 0;
  let totalQP = 0;

  for (const course of courses) {
    const cu = parseFloat(course.creditUnits);
    if (isNaN(cu) || cu <= 0) continue;

    let gp = null;
    const override = whatIfGrades[course.id];
    if (override) {
      const entry = gradeTable.find((g) => g.letter === override);
      gp = entry ? entry.point : null;
    } else if (
      course.gradePoint !== null &&
      course.gradePoint !== undefined &&
      !isNaN(course.gradePoint)
    ) {
      gp = course.gradePoint;
    }

    if (gp === null) continue;
    totalQP += cu * gp;
    totalCU += cu;
  }

  if (totalCU === 0) return null;
  return Math.round((totalQP / totalCU) * 10000) / 10000;
}


// ── Main component ────────────────────────────────────────────────────────────

export default function SemesterPanel({
  semester,
  institution,
  activeGradeTable,
  activePassmark,
  onAddCourse,
  onRemoveCourse,
  onUpdateCourse,
  onRename,
  onRemoveSemester,
  onClearSemester,
  onToggleCollapse,
  onOpenImport,
  whatIfMode,
  whatIfGrades,
  onWhatIfToggle,
  onWhatIfGradeChange,
}) {
  const { totalCU, totalQP, gpa } = useMemo(
    () => computeSemesterSummary(semester, activeGradeTable),
    [semester, activeGradeTable]
  );

  const warnings = useMemo(
    () => getSemesterWarnings(semester.courses, totalCU),
    [semester.courses, totalCU]
  );

  const whatIfSemesterGPA = useMemo(() => {
    if (!whatIfMode) return null;
    return computeWhatIfSemesterGPA(
      semester.courses,
      activeGradeTable,
      whatIfGrades
    );
  }, [whatIfMode, whatIfGrades, semester.courses, activeGradeTable]);

  return (
    <div
      className={`semester-panel panel-card${semester.isCollapsed ? " semester-panel--collapsed" : ""}`}
    >
      <SemesterHeader
        semester={semester}
        gpa={gpa}
        courseCount={semester.courses.length}
        totalCU={totalCU}
        onRename={onRename}
        onRemoveSemester={onRemoveSemester}
        onClearSemester={onClearSemester}
        onToggleCollapse={onToggleCollapse}
      />

      {!semester.isCollapsed && (
        <div className="semester-panel__body">

          {warnings.length > 0 && (
            <div className="semester-panel__warnings">
              {warnings.map((w) => (
                <WarningBanner key={w.id} type={w.type} message={w.message} />
              ))}
            </div>
          )}

          <CourseTable
            courses={semester.courses}
            semesterId={semester.id}
            activeGradeTable={activeGradeTable}
            institution={institution}
            onAddCourse={onAddCourse}
            onRemoveCourse={onRemoveCourse}
            onUpdateCourse={onUpdateCourse}
            onOpenImport={onOpenImport}
            whatIfMode={whatIfMode}
            whatIfGrades={whatIfGrades}
            onWhatIfToggle={onWhatIfToggle}
            onWhatIfGradeChange={onWhatIfGradeChange}
            whatIfSemesterGPA={whatIfSemesterGPA}
            gpa={gpa}
          />

          <SemesterSummaryBar
            totalCU={totalCU}
            totalQP={totalQP}
            gpa={gpa}
            courseCount={semester.courses.length}
            institution={institution}
          />

        </div>
      )}
    </div>
  );
}


// ── Semester header ───────────────────────────────────────────────────────────

function SemesterHeader({
  semester,
  gpa,
  courseCount,
  totalCU,
  onRename,
  onRemoveSemester,
  onClearSemester,
  onToggleCollapse,
}) {
  const [isEditing,  setIsEditing]  = useState(false);
  const [editValue,  setEditValue]  = useState(semester.label);
  const labelInputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) setEditValue(semester.label);
  }, [semester.label, isEditing]);

  useEffect(() => {
    if (isEditing && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(semester.label);
    setIsEditing(true);
    setConfirmState(null);
  }, [semester.label]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim().slice(0, 60);
    if (trimmed && trimmed !== semester.label) {
      onRename(semester.id, trimmed);
    } else {
      setEditValue(semester.label);
    }
    setIsEditing(false);
  }, [editValue, semester.id, semester.label, onRename]);

  const cancelEdit = useCallback(() => {
    setEditValue(semester.label);
    setIsEditing(false);
  }, [semester.label]);

  function handleLabelKeyDown(e) {
    if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  const [confirmState, setConfirmState] = useState(null);

  function requestConfirm(type) {
    setIsEditing(false);
    setConfirmState({ type });
  }

  function handleConfirm() {
    if (confirmState?.type === "clear")  onClearSemester(semester.id);
    if (confirmState?.type === "delete") onRemoveSemester(semester.id);
    setConfirmState(null);
  }

  function handleCancelConfirm() { setConfirmState(null); }

  useEffect(() => {
    if (!confirmState) return;
    const timer = setTimeout(handleCancelConfirm, 6000);
    return () => clearTimeout(timer);
  }, [confirmState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDangerConfirm = confirmState?.type === "delete";
  const confirmMessage  = confirmState?.type === "delete"
    ? "Delete this semester and all its courses?"
    : `Remove all ${courseCount} course${courseCount === 1 ? "" : "s"} in this semester?`;

  return (
    <div className="semester-header">
      <div className="semester-header__main">

        <button
          className="btn-icon semester-header__collapse"
          onClick={() => onToggleCollapse(semester.id)}
          aria-expanded={!semester.isCollapsed}
          aria-label={semester.isCollapsed ? "Expand semester" : "Collapse semester"}
          title={semester.isCollapsed ? "Expand" : "Collapse"}
        >
          <IconChevron open={!semester.isCollapsed} />
        </button>

        <div className="semester-header__label-wrap">
          {isEditing ? (
            <input
              ref={labelInputRef}
              className="semester-header__label-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleLabelKeyDown}
              maxLength={60}
              aria-label="Rename semester"
            />
          ) : (
            <span
              className="semester-header__label"
              onDoubleClick={startEditing}
              title="Double-click to rename"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") startEditing(); }}
              aria-label={`Semester: ${semester.label}. Double-click to rename.`}
            >
              {semester.label}
            </span>
          )}
        </div>

        <div className="semester-header__right">

          {/* Real GPA only — what-if GPA lives in the CourseTable bar */}
          {gpa !== null ? (
            <span className="semester-header__gpa" aria-label={`Semester GPA: ${gpa.toFixed(2)}`}>
              <span className="semester-header__gpa-label">GPA</span>
              <span className="semester-header__gpa-value">{gpa.toFixed(2)}</span>
            </span>
          ) : (
            !semester.isCollapsed && semester.courses.length === 0 && (
              <span className="semester-header__gpa semester-header__gpa--empty">
                Add courses to see GPA
              </span>
            )
          )}

          <div className="semester-header__actions" role="group" aria-label="Semester actions">
            <button className="btn-icon semester-header__action-btn"
              onClick={startEditing} title="Rename semester" aria-label="Rename semester" disabled={isEditing}>
              <IconEdit />
            </button>
            <button className="btn-icon semester-header__action-btn"
              onClick={() => requestConfirm("clear")} title="Clear all courses"
              aria-label="Clear all courses in this semester" disabled={courseCount === 0}>
              <IconClear />
            </button>
            <button className="btn-icon semester-header__action-btn semester-header__action-btn--danger"
              onClick={() => requestConfirm("delete")} title="Delete semester" aria-label="Delete this semester">
              <IconTrash />
            </button>
          </div>
        </div>

      </div>

      {confirmState && (
        <div
          className={`semester-confirm${isDangerConfirm ? " semester-confirm--danger" : " semester-confirm--warning"}`}
          role="alert"
        >
          <span className="semester-confirm__message">{confirmMessage}</span>
          <div className="semester-confirm__actions">
            <button
              className={`btn semester-confirm__btn-confirm${isDangerConfirm ? " btn-danger" : " btn-secondary"}`}
              onClick={handleConfirm}
              autoFocus
            >
              {confirmState.type === "delete" ? "Delete" : "Clear"}
            </button>
            <button className="btn btn-ghost semester-confirm__btn-cancel" onClick={handleCancelConfirm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Warning banner ────────────────────────────────────────────────────────────

function WarningBanner({ type, message }) {
  return (
    <div className={`semester-warning semester-warning--${type}`} role="status">
      <span className="semester-warning__icon" aria-hidden="true"><IconWarning /></span>
      <span className="semester-warning__text">{message}</span>
    </div>
  );
}


// ── Semester validation ───────────────────────────────────────────────────────

function getSemesterWarnings(courses, totalCU) {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  const warnings = [];
  if (totalCU > 30) {
    warnings.push({
      id: "cu-high", type: "warning",
      message: `This semester has ${totalCU} credit units. Most semesters carry 15 to 24 units. Check your entries.`,
    });
  }
  if (totalCU < 6 && courses.length > 0) {
    warnings.push({
      id: "cu-low", type: "warning",
      message: "This semester total seems low. Verify your credit units.",
    });
  }
  return warnings;
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconChevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms ease" }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 4h10M5 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M3 4l.8 7.5a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9L11 4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.6 7.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-7.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6.5v3M8.5 6.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 1.5L13 12H1L7 1.5z" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.7" fill="currentColor" />
    </svg>
  );
}