// ── ImportModal.jsx ───────────────────────────────────────────────────────────
// Portal modal for bulk-importing courses from pasted text.
//
// Supports two formats per line (auto-detected):
//   Score: MTH101, 3, 75
//   Grade: MTH101, 3, A
//
// Mixed formats are accepted. Each line is parsed independently.
// A live preview updates as the user types, showing valid courses and
// any skipped lines with their reasons.
//
// IMPORTANT: onAddSemester (cgpa.addSemester in useCGPA.js) must return
// the new semester ID for the "Create new semester" option to work.
// Update addSemester in useCGPA.js to pre-generate the ID outside the
// setSemesters callback and return it:
//   const id = generateSemesterId();
//   setSemesters(prev => [...prev, { id, ... }]);
//   setActiveTabState(id);
//   return id;
//
// CSS lives in Modal.css (Batch 25). Base .modal styles come from App.css.


import React, { useState, useEffect, useMemo } from "react";
import { createPortal }             from "react-dom";
import {
  previewImport,
  parseImportText,
  getFormatGuide,
}                                   from "../../utils/importParser.js";
import { makeCourseIdFactory }      from "../../utils/idGenerator.js";


// ── Sentinel value for "create new semester" option ──────────────────────────
const NEW_SEM = "__new__";


// ── Main component ────────────────────────────────────────────────────────────

export default function ImportModal({
  semesters,
  activeTab,
  activeGradeTable,
  institution,
  onImport,
  onAddSemester,
  onClose,
}) {
  // Pre-select the active tab, or the first semester, or "new"
  const defaultTarget = activeTab
    || (semesters.length > 0 ? semesters[0].id : NEW_SEM);

  const [targetId,    setTargetId]    = useState(defaultTarget);
  const [rawText,     setRawText]     = useState("");
  const [showGuide,   setShowGuide]   = useState(false);
  const [importDone,  setImportDone]  = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Live parse preview
  const previewResult = useMemo(() => {
    if (!rawText.trim() || !activeGradeTable.length) return null;
    return previewImport(rawText, activeGradeTable);
  }, [rawText, activeGradeTable]);

  // Format guide string
  const formatGuide = useMemo(
    () => getFormatGuide(activeGradeTable),
    [activeGradeTable]
  );

  const canImport = (
    previewResult &&
    previewResult.imported > 0 &&
    !importDone
  );

  // Target semester label for the confirm button
  const targetLabel = useMemo(() => {
    if (targetId === NEW_SEM) return "a new semester";
    const sem = semesters.find((s) => s.id === targetId);
    return sem ? sem.label : "the selected semester";
  }, [targetId, semesters]);


  // ── Confirm handler ─────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!canImport) return;

    const generateId  = makeCourseIdFactory();
    const parsed      = parseImportText(rawText, activeGradeTable, generateId);

    if (parsed.imported === 0) return;

    let semId = targetId;

    if (targetId === NEW_SEM) {
      // addSemester must return the new semester ID (see note above)
      semId = onAddSemester();
      if (!semId) {
        // Fallback: not ideal, but prevents a silent failure
        console.warn(
          "[NG CGPA] addSemester did not return an ID. " +
          "Update useCGPA.js to pre-generate and return the ID."
        );
        return;
      }
    }

    onImport(semId, parsed.courses);
    setImportDone(true);

    // Brief success feedback before closing
    setTimeout(() => onClose(), 400);
  }


  // ── Render ──────────────────────────────────────────────────────────────────

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="modal__header">
          <h2 className="modal__title" id="import-modal-title">
            Import Courses
          </h2>
          <button
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <IconX />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="modal__body import-modal__body">

          {/* No institution guard */}
          {!institution && (
            <div className="import-modal__no-inst">
              <span aria-hidden="true">⚠ </span>
              Select your university before importing. The import parser uses
              your institution&rsquo;s grade table to validate scores and grades.
            </div>
          )}

          {/* Semester target */}
          <div className="import-modal__field">
            <label
              className="label import-modal__label"
              htmlFor="import-target-sem"
            >
              Import into
            </label>
            <select
              id="import-target-sem"
              className="input-base import-modal__select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.label}
                  {sem.courses.length > 0
                    ? ` (${sem.courses.length} course${sem.courses.length === 1 ? "" : "s"})`
                    : ""}
                </option>
              ))}
              <option value={NEW_SEM}>＋ Create new semester</option>
            </select>
          </div>

          {/* Paste area */}
          <div className="import-modal__field">
            <div className="import-modal__paste-header">
              <label
                className="label import-modal__label"
                htmlFor="import-text"
              >
                Paste your results
              </label>
              <button
                className="import-modal__guide-toggle"
                onClick={() => setShowGuide((p) => !p)}
                type="button"
                aria-expanded={showGuide}
                aria-controls="import-guide"
              >
                {showGuide ? "Hide format guide" : "Show format guide"}
              </button>
            </div>

            {/* Format guide */}
            {showGuide && (
              <pre
                className="import-modal__guide"
                id="import-guide"
                aria-label="Format guide"
              >
                {formatGuide}
              </pre>
            )}

            {/* Textarea */}
            <textarea
              id="import-text"
              className="import-modal__textarea"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                "MTH101, 3, 75\nENG102, 2, A\nPHY103, 4, 68\nCSC201, 2, B"
              }
              rows={6}
              disabled={!institution}
              spellCheck="false"
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Paste course data here"
              aria-describedby="import-guide"
            />
          </div>

          {/* Live preview */}
          {previewResult && (
            <ImportPreview result={previewResult} />
          )}

          {/* Import done feedback */}
          {importDone && (
            <div className="import-modal__success" role="status">
              <IconCheck />
              Courses imported successfully.
            </div>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="modal__footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canImport}
            type="button"
            aria-label={
              canImport
                ? `Import ${previewResult.imported} courses into ${targetLabel}`
                : "Import"
            }
          >
            {importDone ? (
              <>
                <IconCheck /> Imported
              </>
            ) : canImport ? (
              `Import ${previewResult.imported} ${previewResult.imported === 1 ? "Course" : "Courses"}`
            ) : (
              "Import"
            )}
          </button>
        </div>

      </div>
    </>,
    document.body
  );
}


// ── Import preview ────────────────────────────────────────────────────────────

function ImportPreview({ result }) {
  const { courses, skipped, imported, total } = result;

  if (total === 0) return null;

  return (
    <div className="import-preview" aria-live="polite" aria-atomic="true">

      {/* Summary */}
      <div className="import-preview__summary">
        <span
          className={`import-preview__badge import-preview__badge--${imported > 0 ? "good" : "empty"}`}
        >
          {imported} {imported === 1 ? "course" : "courses"} ready
        </span>
        {skipped.length > 0 && (
          <span className="import-preview__badge import-preview__badge--skip">
            {skipped.length} {skipped.length === 1 ? "line" : "lines"} skipped
          </span>
        )}
      </div>

      {/* Course list */}
      {courses.length > 0 && (
        <div
          className="import-preview__courses"
          role="list"
          aria-label="Courses to be imported"
        >
          {courses.map((course, idx) => (
            <div
              key={idx}
              className={`import-preview__course${
                course.gradePoint === 0 ? " import-preview__course--fail" : ""
              }`}
              role="listitem"
            >
              <span className="import-preview__course-name">
                {course.name}
              </span>
              <span className="import-preview__course-cu">
                {course.creditUnits} CU
              </span>
              <span className="import-preview__course-score">
                {course.score !== null ? course.score : "—"}
              </span>
              <span className={`import-preview__course-grade${
                course.gradePoint === 0 ? " import-preview__course-grade--fail" : ""
              }`}>
                {course.grade || "—"}
              </span>
              <span className="import-preview__course-qp">
                {course.qualityPoint !== null
                  ? `${(Math.round(course.qualityPoint * 100) / 100).toFixed(2)} QP`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Skipped lines */}
      {skipped.length > 0 && (
        <details className="import-preview__skipped">
          <summary className="import-preview__skipped-summary">
            {skipped.length} skipped {skipped.length === 1 ? "line" : "lines"}
          </summary>
          <div className="import-preview__skipped-list">
            {skipped.map((s, idx) => (
              <div key={idx} className="import-preview__skip-item">
                <span className="import-preview__skip-line">
                  Line {s.lineNumber}: <code>{s.line}</code>
                </span>
                <span className="import-preview__skip-reason">
                  {s.reason}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M2 7l4 4 6-7"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}