// ── ImportModal.jsx ───────────────────────────────────────────────────────────
// Portal modal for bulk-importing courses.
//
// Two input modes:
//   Paste text  — original behaviour, unchanged.
//   Import file — new: accepts Excel (.xlsx/.xls) or PDF transcripts.
//                 Detects semester blocks automatically and offers
//                 "Import all semesters" when multiple blocks are found.
//
// New optional prop:
//   onSetSemesterLabel(id, label) — renames a semester after creation.
//   Add to useCGPA.js if you want auto-labelled semesters:
//     setSemesterLabel: (id, label) =>
//       setSemesters(prev => prev.map(s => s.id === id ? { ...s, label } : s)),
//
// Required packages for file import:
//   npm install xlsx
//   npm install pdfjs-dist
//
// CSS lives in Modal.css (Batch 25).


import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal }                               from "react-dom";
import {
  previewImport,
  parseImportText,
  getFormatGuide,
}                                                     from "../../utils/importParser.js";
import {
  parseXLSXTranscript,
  parsePDFTranscript,
}                                                     from "../../utils/importTranscript.js";
import { makeCourseIdFactory }                        from "../../utils/idGenerator.js";


const NEW_SEM = "__new__";


// ── Main component ────────────────────────────────────────────────────────────

export default function ImportModal({
  semesters,
  activeTab,
  activeGradeTable,
  institution,
  onImport,
  onAddSemester,
  onSetSemesterLabel,   // optional
  onClose,
}) {
  const defaultTarget = activeTab || (semesters.length > 0 ? semesters[0].id : NEW_SEM);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState("paste"); // "paste" | "file"

  // ── Paste-mode state ──────────────────────────────────────────────────────
  const [targetId,   setTargetId]   = useState(defaultTarget);
  const [rawText,    setRawText]    = useState("");
  const [showGuide,  setShowGuide]  = useState(false);

  // ── File-mode state ───────────────────────────────────────────────────────
  const [transcriptResult, setTranscriptResult] = useState(null);
  const [fileError,        setFileError]        = useState(null);
  const [isParsingFile,    setIsParsingFile]    = useState(false);
  const [parsedFileName,   setParsedFileName]   = useState(null);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [importDone, setImportDone] = useState(false);

  const xlsxInputRef = useRef(null);
  const pdfInputRef  = useRef(null);


  // ── Keyboard / scroll lock ────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);


  // ── Paste mode: live preview ──────────────────────────────────────────────

  const previewResult = useMemo(() => {
    if (inputMode !== "paste") return null;
    if (!rawText.trim() || !activeGradeTable.length) return null;
    return previewImport(rawText, activeGradeTable);
  }, [rawText, activeGradeTable, inputMode]);

  const formatGuide = useMemo(
    () => getFormatGuide(activeGradeTable),
    [activeGradeTable]
  );


  // ── Target semester label ─────────────────────────────────────────────────

  const targetLabel = useMemo(() => {
    if (targetId === NEW_SEM) return "a new semester";
    const sem = semesters.find(s => s.id === targetId);
    return sem ? sem.label : "the selected semester";
  }, [targetId, semesters]);


  // ── Mode switch — clear file state when switching back to paste ───────────

  function switchMode(mode) {
    setInputMode(mode);
    setImportDone(false);
    if (mode === "paste") {
      setTranscriptResult(null);
      setFileError(null);
      setParsedFileName(null);
    }
  }


  // ── File parsing ──────────────────────────────────────────────────────────

  async function handleFile(file, type) {
    if (!file) return;
    setIsParsingFile(true);
    setFileError(null);
    setTranscriptResult(null);
    setParsedFileName(file.name);
    setImportDone(false);

    try {
      const generateId = makeCourseIdFactory();
      const result = type === "xlsx"
        ? await parseXLSXTranscript(file, activeGradeTable, generateId)
        : await parsePDFTranscript(file, activeGradeTable, generateId);

      setTranscriptResult(result);
    } catch (err) {
      setFileError(err.message || "Could not parse this file.");
    } finally {
      setIsParsingFile(false);
      // Reset the file input so the same file can be re-selected after an error
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
      if (pdfInputRef.current)  pdfInputRef.current.value  = "";
    }
  }


  // ── Paste mode: confirm ───────────────────────────────────────────────────

  function handlePasteConfirm() {
    if (!previewResult || previewResult.imported === 0) return;

    const generateId = makeCourseIdFactory();
    const parsed     = parseImportText(rawText, activeGradeTable, generateId);
    if (parsed.imported === 0) return;

    let semId = targetId;
    if (targetId === NEW_SEM) {
      semId = onAddSemester();
      if (!semId) {
        console.warn(
          "[NG CGPA] addSemester did not return an ID. " +
          "Update useCGPA.js to return the new semester ID."
        );
        return;
      }
    }

    onImport(semId, parsed.courses);
    setImportDone(true);
    setTimeout(() => onClose(), 400);
  }


  // ── File mode: import single semester ────────────────────────────────────
  // Used when the transcript has exactly one semester block, or the user
  // is importing a specific block into a chosen existing semester.

  function handleFileSingleImport(courses) {
    let semId = targetId;
    if (targetId === NEW_SEM) {
      semId = onAddSemester();
      if (!semId) return;
    }
    onImport(semId, courses);
    setImportDone(true);
    setTimeout(() => onClose(), 400);
  }


  // ── File mode: import all semesters ──────────────────────────────────────

  function handleImportAll() {
    if (!transcriptResult) return;

    for (const sem of transcriptResult.semesters) {
      const semId = onAddSemester();
      if (!semId) continue;

      // Rename the semester if the hook exposes that action
      if (onSetSemesterLabel && sem.label) {
        onSetSemesterLabel(semId, sem.label);
      }

      onImport(semId, sem.courses);
    }

    setImportDone(true);
    setTimeout(() => onClose(), 400);
  }


  // ── Can-import derivations ────────────────────────────────────────────────

  const canPasteImport = inputMode === "paste" && !!previewResult && previewResult.imported > 0 && !importDone;
  const canFileImport  = inputMode === "file"  && !!transcriptResult && transcriptResult.totalCourses > 0 && !importDone;

  const fileHasMultipleSemesters =
    transcriptResult && transcriptResult.semesters.length > 1;


  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />

      <div
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="modal__header">
          <h2 className="modal__title" id="import-modal-title">
            Import Courses
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close" type="button">
            <IconX />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="modal__body import-modal__body">

          {/* No institution guard */}
          {!institution && (
            <div className="import-modal__no-inst">
              <span aria-hidden="true">⚠ </span>
              Select your university before importing. The parser uses your
              institution&rsquo;s grade table to validate scores and grades.
            </div>
          )}

          {/* Mode tabs */}
          <div className="import-modal__mode-tabs" role="tablist">
            <button
              className={`import-modal__mode-tab${inputMode === "paste" ? " import-modal__mode-tab--active" : ""}`}
              onClick={() => switchMode("paste")}
              role="tab"
              aria-selected={inputMode === "paste"}
              type="button"
            >
              Paste text
            </button>
            <button
              className={`import-modal__mode-tab${inputMode === "file" ? " import-modal__mode-tab--active" : ""}`}
              onClick={() => switchMode("file")}
              role="tab"
              aria-selected={inputMode === "file"}
              type="button"
            >
              Import from file
            </button>
          </div>


          {/* ── PASTE MODE ────────────────────────────────────────────────── */}
          {inputMode === "paste" && (
            <>
              {/* Semester target */}
              <div className="import-modal__field">
                <label className="label import-modal__label" htmlFor="import-target-sem">
                  Import into
                </label>
                <select
                  id="import-target-sem"
                  className="input-base import-modal__select"
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                >
                  {semesters.map(sem => (
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
                  <label className="label import-modal__label" htmlFor="import-text">
                    Paste your results
                  </label>
                  <button
                    className="import-modal__guide-toggle"
                    onClick={() => setShowGuide(p => !p)}
                    type="button"
                    aria-expanded={showGuide}
                    aria-controls="import-guide"
                  >
                    {showGuide ? "Hide format guide" : "Show format guide"}
                  </button>
                </div>

                {showGuide && (
                  <pre className="import-modal__guide" id="import-guide" aria-label="Format guide">
                    {formatGuide}
                  </pre>
                )}

                <textarea
                  id="import-text"
                  className="import-modal__textarea"
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={"MTH101, 3, 75\nENG102, 2, A\nPHY103, 4, 68\nCSC201, 2, B"}
                  rows={6}
                  disabled={!institution}
                  spellCheck="false"
                  autoCorrect="off"
                  autoCapitalize="off"
                  aria-label="Paste course data here"
                  aria-describedby="import-guide"
                />
              </div>

              {previewResult && <ImportPreview result={previewResult} />}
            </>
          )}


          {/* ── FILE MODE ─────────────────────────────────────────────────── */}
          {inputMode === "file" && (
            <div className="import-modal__file-section">

              {/* File pick buttons */}
              <div className="import-modal__file-buttons">
                <label className={`btn btn-secondary import-modal__file-btn${!institution ? " btn--disabled" : ""}`}>
                  <IconExcel />
                  Excel (.xlsx)
                  <input
                    ref={xlsxInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={!institution}
                    onChange={e => handleFile(e.target.files?.[0], "xlsx")}
                    hidden
                  />
                </label>

                <label className={`btn btn-secondary import-modal__file-btn${!institution ? " btn--disabled" : ""}`}>
                  <IconPDF />
                  PDF transcript
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    disabled={!institution}
                    onChange={e => handleFile(e.target.files?.[0], "pdf")}
                    hidden
                  />
                </label>
              </div>

              {/* Parsing status */}
              {isParsingFile && (
                <div className="import-modal__file-status" role="status" aria-live="polite">
                  <span className="import-modal__spinner" aria-hidden="true" /> Detecting columns&hellip;
                </div>
              )}

              {/* File name display */}
              {parsedFileName && !isParsingFile && (
                <div className="import-modal__file-name">
                  <IconFile />
                  {parsedFileName}
                </div>
              )}

              {/* Error */}
              {fileError && (
                <div className="import-modal__file-error" role="alert">
                  <strong>Could not parse file.</strong> {fileError}
                </div>
              )}

              {/* Transcript preview */}
              {transcriptResult && !fileError && (
                <TranscriptPreview result={transcriptResult} />
              )}

              {/* Single-semester target selector — shown when only one block found */}
              {transcriptResult && !fileHasMultipleSemesters && (
                <div className="import-modal__field" style={{ marginTop: "var(--space-3)" }}>
                  <label className="label import-modal__label" htmlFor="import-file-target">
                    Import into
                  </label>
                  <select
                    id="import-file-target"
                    className="input-base import-modal__select"
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                  >
                    {semesters.map(sem => (
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
              )}

              {/* Help note about PDF worker CDN requirement */}
              {!transcriptResult && !isParsingFile && !fileError && (
                <p className="import-modal__file-hint">
                  Supports digital (text-based) PDF transcripts and Excel files with a
                  course code, credit units, and grade or score column. Scanned image
                  PDFs are not supported.
                </p>
              )}

            </div>
          )}

          {/* Import done feedback */}
          {importDone && (
            <div className="import-modal__success" role="status">
              <IconCheck /> Courses imported successfully.
            </div>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="modal__footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>

          {/* Paste mode confirm */}
          {inputMode === "paste" && (
            <button
              className="btn btn-primary"
              onClick={handlePasteConfirm}
              disabled={!canPasteImport}
              type="button"
              aria-label={
                canPasteImport
                  ? `Import ${previewResult.imported} courses into ${targetLabel}`
                  : "Import"
              }
            >
              {importDone ? (
                <><IconCheck /> Imported</>
              ) : canPasteImport ? (
                `Import ${previewResult.imported} ${previewResult.imported === 1 ? "Course" : "Courses"}`
              ) : (
                "Import"
              )}
            </button>
          )}

          {/* File mode — multi-semester */}
          {inputMode === "file" && fileHasMultipleSemesters && (
            <button
              className="btn btn-primary"
              onClick={handleImportAll}
              disabled={!canFileImport}
              type="button"
            >
              {importDone ? (
                <><IconCheck /> Imported</>
              ) : (
                `Import All ${transcriptResult.semesters.length} Semesters (${transcriptResult.totalCourses} Courses)`
              )}
            </button>
          )}

          {/* File mode — single semester */}
          {inputMode === "file" && transcriptResult && !fileHasMultipleSemesters && (
            <button
              className="btn btn-primary"
              onClick={() => handleFileSingleImport(transcriptResult.semesters[0].courses)}
              disabled={!canFileImport}
              type="button"
            >
              {importDone ? (
                <><IconCheck /> Imported</>
              ) : (
                `Import ${transcriptResult.totalCourses} ${transcriptResult.totalCourses === 1 ? "Course" : "Courses"}`
              )}
            </button>
          )}

          {/* File mode — nothing loaded yet */}
          {inputMode === "file" && !transcriptResult && (
            <button className="btn btn-primary" disabled type="button">
              Import
            </button>
          )}
        </div>

      </div>
    </>,
    document.body
  );
}


// ── Transcript Preview ────────────────────────────────────────────────────────

function TranscriptPreview({ result }) {
  const { semesters, skipped, totalCourses } = result;

  return (
    <div className="import-preview" aria-live="polite" aria-atomic="true">

      {/* Summary badges */}
      <div className="import-preview__summary">
        <span className="import-preview__badge import-preview__badge--good">
          {totalCourses} {totalCourses === 1 ? "course" : "courses"} detected
        </span>
        <span className="import-preview__badge import-preview__badge--good">
          {semesters.length} {semesters.length === 1 ? "semester" : "semesters"}
        </span>
        {skipped.length > 0 && (
          <span className="import-preview__badge import-preview__badge--skip">
            {skipped.length} {skipped.length === 1 ? "line" : "lines"} skipped
          </span>
        )}
      </div>

      {/* Semester blocks */}
      {semesters.map((sem, si) => (
        <div key={si} className="import-preview__semester">
          <div className="import-preview__semester-header">
            <span className="import-preview__semester-label">{sem.label}</span>
            <span className="import-preview__semester-meta">
              {sem.courses.length} {sem.courses.length === 1 ? "course" : "courses"}
              {sem.sourceGPA !== null && (
                <> &middot; GPA on transcript: {sem.sourceGPA.toFixed(2)}</>
              )}
            </span>
          </div>

          <div className="import-preview__courses" role="list" aria-label={`Courses in ${sem.label}`}>
            {sem.courses.map((course, ci) => (
              <div
                key={ci}
                className={`import-preview__course${course.gradePoint === 0 ? " import-preview__course--fail" : ""}`}
                role="listitem"
              >
                <span className="import-preview__course-name">{course.name}</span>
                <span className="import-preview__course-cu">{course.creditUnits} CU</span>
                <span className="import-preview__course-score">
                  {course.score !== null ? course.score : "—"}
                </span>
                <span className={`import-preview__course-grade${course.gradePoint === 0 ? " import-preview__course-grade--fail" : ""}`}>
                  {course.grade || "—"}
                </span>
                <span className="import-preview__course-qp">
                  {course.qualityPoint !== null
                    ? `${Number(course.qualityPoint).toFixed(2)} QP`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

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
                  <code>{s.text}</code>
                </span>
                <span className="import-preview__skip-reason">{s.reason}</span>
              </div>
            ))}
          </div>
        </details>
      )}

    </div>
  );
}


// ── Original paste-mode preview (unchanged) ───────────────────────────────────

function ImportPreview({ result }) {
  const { courses, skipped, imported, total } = result;
  if (total === 0) return null;

  return (
    <div className="import-preview" aria-live="polite" aria-atomic="true">
      <div className="import-preview__summary">
        <span className={`import-preview__badge import-preview__badge--${imported > 0 ? "good" : "empty"}`}>
          {imported} {imported === 1 ? "course" : "courses"} ready
        </span>
        {skipped.length > 0 && (
          <span className="import-preview__badge import-preview__badge--skip">
            {skipped.length} {skipped.length === 1 ? "line" : "lines"} skipped
          </span>
        )}
      </div>

      {courses.length > 0 && (
        <div className="import-preview__courses" role="list" aria-label="Courses to be imported">
          {courses.map((course, idx) => (
            <div
              key={idx}
              className={`import-preview__course${course.gradePoint === 0 ? " import-preview__course--fail" : ""}`}
              role="listitem"
            >
              <span className="import-preview__course-name">{course.name}</span>
              <span className="import-preview__course-cu">{course.creditUnits} CU</span>
              <span className="import-preview__course-score">
                {course.score !== null ? course.score : "—"}
              </span>
              <span className={`import-preview__course-grade${course.gradePoint === 0 ? " import-preview__course-grade--fail" : ""}`}>
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
                <span className="import-preview__skip-reason">{s.reason}</span>
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExcel() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 4.5l2 2.5-2 2.5M7.5 9.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconPDF() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 9V5h2a1.5 1.5 0 010 3H3.5M8 5h1.5a1.5 1.5 0 010 3H8V5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" focusable="false">
      <path d="M2 1.5A.5.5 0 012.5 1h5l3 3v7.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-10z"
        stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 1v3H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}