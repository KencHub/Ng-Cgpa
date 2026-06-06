// ── ImportModal.jsx ───────────────────────────────────────────────────────────
// Portal modal for bulk-importing courses.
//
// FLOW (paste and file modes):
//   1. User enters data / uploads file → sees live preview.
//   2. User clicks "Import X Courses" → diff is computed against the target
//      semester's existing courses → diff review panel is shown.
//   3. User reads the review (new / updated / identical) → clicks "Confirm".
//   4. mergeImportCourses or importCoursesToSemester is called → modal closes.
//
// Duplicate detection rules (via computeImportDiff in importParser.js):
//   • Same course name, same grade, same CU  →  identical, skipped silently.
//   • Same course name, different grade or CU →  updated, replaces existing.
//   • Course name not in semester             →  new, appended.
//
// Required prop added in this version:
//   onMergeImport(semesterId, diffResult)  — from useCGPA.mergeImportCourses
//
// CSS: Modal.css (Batch 25). New .import-diff classes listed at the bottom
// of this file as a comment block to paste into Modal.css.


import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal }                                from "react-dom";
import {
  previewImport,
  parseImportText,
  getFormatGuide,
  computeImportDiff,
  computeMultiSemesterDiff,
}                                                      from "../../utils/importParser.js";
import {
  parseXLSXTranscript,
  parsePDFTranscript,
}                                                      from "../../utils/importTranscript.js";
import { makeCourseIdFactory }                         from "../../utils/idGenerator.js";


const NEW_SEM = "__new__";


// ── Main component ────────────────────────────────────────────────────────────

export default function ImportModal({
  semesters,
  activeTab,
  activeGradeTable,
  institution,
  onImport,            // plain append — used for new semesters
  onMergeImport,       // smart merge  — used for existing semesters
  onAddSemester,
  onSetSemesterLabel,  // optional
  onClose,
}) {
  const defaultTarget = activeTab || (semesters.length > 0 ? semesters[0].id : NEW_SEM);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState("paste"); // "paste" | "file"

  // ── Paste-mode state ──────────────────────────────────────────────────────
  const [targetId,  setTargetId]  = useState(defaultTarget);
  const [rawText,   setRawText]   = useState("");
  const [showGuide, setShowGuide] = useState(false);

  // ── File-mode state ───────────────────────────────────────────────────────
  const [transcriptResult, setTranscriptResult] = useState(null);
  const [fileError,        setFileError]        = useState(null);
  const [isParsingFile,    setIsParsingFile]    = useState(false);
  const [parsedFileName,   setParsedFileName]   = useState(null);

  // ── Diff review state ─────────────────────────────────────────────────────
  // pendingDiff is set when the user clicks "Import X Courses".
  // While it is non-null the diff review panel replaces the input panel.
  //
  // Shape (type "single"):
  //   { type: "single", semId, diff: DiffResult, targetLabel }
  //
  // Shape (type "multi"):
  //   { type: "multi", multiDiff: MultiDiffEntry[] }
  const [pendingDiff, setPendingDiff] = useState(null);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [importDone, setImportDone] = useState(false);

  const xlsxInputRef = useRef(null);
  const pdfInputRef  = useRef(null);

  const showingDiff = pendingDiff !== null;


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


  // ── Clear diff review when inputs change ─────────────────────────────────

  useEffect(() => {
    setPendingDiff(null);
  }, [rawText, targetId, transcriptResult]);


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
    const sem = semesters.find((s) => s.id === targetId);
    return sem ? sem.label : "the selected semester";
  }, [targetId, semesters]);


  // ── Mode switch ───────────────────────────────────────────────────────────

  function switchMode(mode) {
    setInputMode(mode);
    setImportDone(false);
    setPendingDiff(null);
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
    setPendingDiff(null);

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
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
      if (pdfInputRef.current)  pdfInputRef.current.value  = "";
    }
  }


  // ── Diff computation — paste mode ─────────────────────────────────────────

  function handlePasteReview() {
    if (!previewResult || previewResult.imported === 0) return;

    const generateId = makeCourseIdFactory();
    const parsed     = parseImportText(rawText, activeGradeTable, generateId);
    if (parsed.imported === 0) return;

    const existingCourses =
      targetId === NEW_SEM
        ? []
        : semesters.find((s) => s.id === targetId)?.courses || [];

    const diff = computeImportDiff(existingCourses, parsed.courses);

    setPendingDiff({ type: "single", semId: targetId, diff, targetLabel });
  }


  // ── Diff computation — file mode, single semester ─────────────────────────

  function handleFileSingleReview() {
    if (!transcriptResult || transcriptResult.semesters.length === 0) return;
    const courses = transcriptResult.semesters[0].courses;

    const existingCourses =
      targetId === NEW_SEM
        ? []
        : semesters.find((s) => s.id === targetId)?.courses || [];

    const diff = computeImportDiff(existingCourses, courses);

    setPendingDiff({ type: "single", semId: targetId, diff, targetLabel });
  }


  // ── Diff computation — file mode, multiple semesters ─────────────────────

  function handleFileMultiReview() {
    if (!transcriptResult) return;
    const multiDiff = computeMultiSemesterDiff(
      semesters,
      transcriptResult.semesters
    );
    setPendingDiff({ type: "multi", multiDiff });
  }


  // ── Unified review trigger ────────────────────────────────────────────────

  function handleReview() {
    if (importDone) return;

    if (inputMode === "paste") {
      handlePasteReview();
    } else if (inputMode === "file") {
      if (fileHasMultipleSemesters) {
        handleFileMultiReview();
      } else {
        handleFileSingleReview();
      }
    }
  }


  // ── Confirm import (after diff review) ───────────────────────────────────

  function handleConfirmImport() {
    if (!pendingDiff || importDone) return;

    if (pendingDiff.type === "single") {
      let semId = pendingDiff.semId;

      if (semId === NEW_SEM) {
        // New semester: no existing courses, so diff.added contains everything
        semId = onAddSemester();
        if (!semId) return;
        onImport(semId, pendingDiff.diff.added);
      } else {
        // Existing semester: smart merge (replace updated, append new, skip dups)
        onMergeImport(semId, pendingDiff.diff);
      }

    } else {
      // Multi-semester from transcript
      for (const semDiff of pendingDiff.multiDiff) {
        if (semDiff.isNew) {
          const semId = onAddSemester();
          if (!semId) continue;
          if (onSetSemesterLabel && semDiff.label) {
            onSetSemesterLabel(semId, semDiff.label);
          }
          onImport(semId, semDiff.diff.added);
        } else {
          onMergeImport(semDiff.existingSemId, semDiff.diff);
        }
      }
    }

    setImportDone(true);
    setTimeout(() => onClose(), 400);
  }


  // ── Derived flags ─────────────────────────────────────────────────────────

  const canPasteImport =
    inputMode === "paste" &&
    !!previewResult &&
    previewResult.imported > 0 &&
    !importDone;

  const canFileImport =
    inputMode === "file" &&
    !!transcriptResult &&
    transcriptResult.totalCourses > 0 &&
    !importDone;

  const canReview =
    (inputMode === "paste" && canPasteImport) ||
    (inputMode === "file"  && canFileImport);

  const fileHasMultipleSemesters =
    transcriptResult && transcriptResult.semesters.length > 1;

  // Total changes that will actually be applied (excludes duplicates)
  const pendingChangeCount = useMemo(() => {
    if (!pendingDiff) return 0;
    if (pendingDiff.type === "single") {
      return pendingDiff.diff.added.length + pendingDiff.diff.updated.length;
    }
    return pendingDiff.multiDiff.reduce(
      (n, s) => n + s.diff.added.length + s.diff.updated.length,
      0
    );
  }, [pendingDiff]);

  // How many courses the primary "Import" button label advertises
  const reviewButtonCount =
    inputMode === "paste"
      ? previewResult?.imported ?? 0
      : transcriptResult?.totalCourses ?? 0;


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
            {showingDiff ? "Review before importing" : "Import Courses"}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close" type="button">
            <IconX />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="modal__body import-modal__body">

          {/* ── DIFF REVIEW PANEL ─────────────────────────────────────────── */}
          {showingDiff && (
            <>
              {pendingDiff.type === "single" && (
                <DiffReview
                  diff={pendingDiff.diff}
                  targetLabel={pendingDiff.targetLabel}
                />
              )}
              {pendingDiff.type === "multi" && (
                <MultiDiffReview multiDiff={pendingDiff.multiDiff} />
              )}
            </>
          )}

          {/* ── INPUT PANEL (hidden while reviewing diff) ─────────────────── */}
          {!showingDiff && (
            <>
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

              {/* ── PASTE MODE ──────────────────────────────────────────────── */}
              {inputMode === "paste" && (
                <>
                  <div className="import-modal__field">
                    <label className="label import-modal__label" htmlFor="import-target-sem">
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

                  <div className="import-modal__field">
                    <div className="import-modal__paste-header">
                      <label className="label import-modal__label" htmlFor="import-text">
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

                    {showGuide && (
                      <pre
                        className="import-modal__guide"
                        id="import-guide"
                        aria-label="Format guide"
                      >
                        {formatGuide}
                      </pre>
                    )}

                    <textarea
                      id="import-text"
                      className="import-modal__textarea"
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
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

              {/* ── FILE MODE ────────────────────────────────────────────────── */}
              {inputMode === "file" && (
                <div className="import-modal__file-section">
                  <div className="import-modal__file-buttons">
                    <label className={`btn btn-secondary import-modal__file-btn${!institution ? " btn--disabled" : ""}`}>
                      <IconExcel />
                      Excel (.xlsx)
                      <input
                        ref={xlsxInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        disabled={!institution}
                        onChange={(e) => handleFile(e.target.files?.[0], "xlsx")}
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
                        onChange={(e) => handleFile(e.target.files?.[0], "pdf")}
                        hidden
                      />
                    </label>
                  </div>

                  {isParsingFile && (
                    <div className="import-modal__file-status" role="status" aria-live="polite">
                      <span className="import-modal__spinner" aria-hidden="true" /> Detecting columns&hellip;
                    </div>
                  )}

                  {parsedFileName && !isParsingFile && (
                    <div className="import-modal__file-name">
                      <IconFile />
                      {parsedFileName}
                    </div>
                  )}

                  {fileError && (
                    <div className="import-modal__file-error" role="alert">
                      <strong>Could not parse file.</strong> {fileError}
                    </div>
                  )}

                  {transcriptResult && !fileError && (
                    <TranscriptPreview result={transcriptResult} />
                  )}

                  {transcriptResult && !fileHasMultipleSemesters && (
                    <div className="import-modal__field" style={{ marginTop: "var(--space-3)" }}>
                      <label className="label import-modal__label" htmlFor="import-file-target">
                        Import into
                      </label>
                      <select
                        id="import-file-target"
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
                  )}

                  {!transcriptResult && !isParsingFile && !fileError && (
                    <p className="import-modal__file-hint">
                      Supports digital (text-based) PDF transcripts and Excel files with a
                      course code, credit units, and grade or score column. Scanned image
                      PDFs are not supported.
                    </p>
                  )}
                </div>
              )}

              {importDone && (
                <div className="import-modal__success" role="status">
                  <IconCheck /> Courses imported successfully.
                </div>
              )}
            </>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="modal__footer">

          {/* Normal input state */}
          {!showingDiff && (
            <>
              <button className="btn btn-secondary" onClick={onClose} type="button">
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleReview}
                disabled={!canReview}
                type="button"
              >
                {canReview
                  ? `Import ${reviewButtonCount} ${reviewButtonCount === 1 ? "Course" : "Courses"}`
                  : "Import"}
              </button>
            </>
          )}

          {/* Diff review state */}
          {showingDiff && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setPendingDiff(null)}
                type="button"
              >
                <IconBack /> Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={pendingChangeCount === 0 || importDone}
                type="button"
              >
                {importDone ? (
                  <><IconCheck /> Imported</>
                ) : pendingChangeCount === 0 ? (
                  "Nothing to import"
                ) : (
                  `Confirm · ${pendingChangeCount} ${pendingChangeCount === 1 ? "course" : "courses"}`
                )}
              </button>
            </>
          )}

        </div>

      </div>
    </>,
    document.body
  );
}


// ── DiffReview — single semester ──────────────────────────────────────────────

function DiffReview({ diff, targetLabel }) {
  const { added, updated, duplicates } = diff;
  const totalChanges = added.length + updated.length;

  return (
    <div className="import-diff">

      <p className="import-diff__into">
        Destination: <strong>{targetLabel}</strong>
      </p>

      {/* Summary badges */}
      <div className="import-preview__summary" style={{ marginBottom: "var(--space-4)" }}>
        {added.length > 0 && (
          <span className="import-preview__badge import-preview__badge--good">
            {added.length} new
          </span>
        )}
        {updated.length > 0 && (
          <span
            className="import-preview__badge"
            style={{
              background: "var(--color-warning-light)",
              color:      "var(--color-warning)",
            }}
          >
            {updated.length} updated
          </span>
        )}
        {duplicates.length > 0 && (
          <span
            className="import-preview__badge"
            style={{
              background: "var(--color-surface-3)",
              color:      "var(--color-text-secondary)",
            }}
          >
            {duplicates.length} identical · skipped
          </span>
        )}
        {totalChanges === 0 && duplicates.length === 0 && (
          <span
            className="import-preview__badge"
            style={{
              background: "var(--color-surface-3)",
              color:      "var(--color-text-muted)",
            }}
          >
            No changes
          </span>
        )}
      </div>

      {/* New courses */}
      {added.length > 0 && (
        <div className="import-diff__group">
          <div className="import-diff__group-title">New courses</div>
          <div className="import-preview__courses" role="list">
            {added.map((c, i) => (
              <div
                key={i}
                className={`import-preview__course${c.gradePoint === 0 ? " import-preview__course--fail" : ""}`}
                role="listitem"
              >
                <span className="import-preview__course-name">{c.name}</span>
                <span className="import-preview__course-cu">{c.creditUnits} CU</span>
                {c.score !== null && (
                  <span className="import-preview__course-score">{c.score}</span>
                )}
                <span className={`import-preview__course-grade${c.gradePoint === 0 ? " import-preview__course-grade--fail" : ""}`}>
                  {c.grade || "—"}
                </span>
                <span className="import-preview__course-qp">
                  {c.qualityPoint !== null
                    ? `${Number(c.qualityPoint).toFixed(2)} QP`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Updated courses */}
      {updated.length > 0 && (
        <div className="import-diff__group">
          <div className="import-diff__group-title" style={{ color: "var(--color-warning)" }}>
            Updated · existing data will be replaced
          </div>
          <div className="import-preview__courses" role="list">
            {updated.map(({ existing, incoming }, i) => (
              <div
                key={i}
                className="import-preview__course"
                style={{ background: "var(--color-warning-light)", borderRadius: "var(--radius-sm)" }}
                role="listitem"
              >
                <span className="import-preview__course-name">{incoming.name}</span>
                <span className="import-preview__course-cu">{incoming.creditUnits} CU</span>
                <span
                  style={{
                    fontSize:   "12px",
                    color:      "var(--color-warning)",
                    fontWeight: 600,
                    marginLeft: "auto",
                    flexShrink: 0,
                  }}
                >
                  {describeChange(existing, incoming)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identical / skipped */}
      {duplicates.length > 0 && (
        <div className="import-diff__group">
          <div
            className="import-diff__group-title"
            style={{ color: "var(--color-text-muted)" }}
          >
            Already identical · no change
          </div>
          <div className="import-preview__courses" role="list">
            {duplicates.map(({ existing }, i) => (
              <div
                key={i}
                className="import-preview__course"
                style={{ opacity: 0.45 }}
                role="listitem"
              >
                <span className="import-preview__course-name">{existing.name}</span>
                <span className="import-preview__course-cu">{existing.creditUnits} CU</span>
                <span className="import-preview__course-grade">{existing.grade || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}


// ── MultiDiffReview — multiple semesters ──────────────────────────────────────

function MultiDiffReview({ multiDiff }) {
  const totalNew     = multiDiff.reduce((n, s) => n + s.diff.added.length,      0);
  const totalUpdated = multiDiff.reduce((n, s) => n + s.diff.updated.length,    0);
  const totalDups    = multiDiff.reduce((n, s) => n + s.diff.duplicates.length, 0);

  return (
    <div className="import-diff">

      {/* Overall summary */}
      <div className="import-preview__summary" style={{ marginBottom: "var(--space-4)" }}>
  <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginRight: "var(--space-2)" }}>
    {multiDiff.length} {multiDiff.length === 1 ? "semester" : "semesters"}
  </span>
  {totalNew > 0 && (
    <span className="import-preview__badge import-preview__badge--good">
      {totalNew} new
    </span>
  )}
  {totalUpdated > 0 && (
          <span
            className="import-preview__badge"
            style={{
              background: "var(--color-warning-light)",
              color:      "var(--color-warning)",
            }}
          >
            {totalUpdated} updated
          </span>
        )}
        {totalDups > 0 && (
          <span
            className="import-preview__badge"
            style={{
              background: "var(--color-surface-3)",
              color:      "var(--color-text-secondary)",
            }}
          >
            {totalDups} identical · skipped
          </span>
        )}
      </div>

      {/* Per-semester summary rows */}
      {multiDiff.map((semDiff, i) => (
        <div key={i} className="import-preview__semester">
          <div className="import-preview__semester-header">
            <span className="import-preview__semester-label">
              {semDiff.label}
              {semDiff.isNew && (
                <span
                  className="import-preview__badge import-preview__badge--good"
                  style={{ marginLeft: "var(--space-2)" }}
                >
                  new
                </span>
              )}
            </span>
            <span className="import-preview__semester-meta">
              {[
                semDiff.diff.added.length      > 0 && `${semDiff.diff.added.length} new`,
                semDiff.diff.updated.length    > 0 && `${semDiff.diff.updated.length} updated`,
                semDiff.diff.duplicates.length > 0 && `${semDiff.diff.duplicates.length} skipped`,
              ]
                .filter(Boolean)
                .join(" · ") || "no changes"}
            </span>
          </div>
        </div>
      ))}

    </div>
  );
}


// ── Describe a course change for the "Updated" row ────────────────────────────

function describeChange(existing, incoming) {
  const parts = [];

  if (Number(existing.creditUnits) !== Number(incoming.creditUnits)) {
    parts.push(`${existing.creditUnits}CU → ${incoming.creditUnits}CU`);
  }
  if ((existing.grade ?? null) !== (incoming.grade ?? null)) {
    parts.push(`${existing.grade || "—"} → ${incoming.grade || "—"}`);
  }

  return parts.join(" · ") || "data updated";
}


// ── Transcript Preview ────────────────────────────────────────────────────────

function TranscriptPreview({ result }) {
  const { semesters, skipped, totalCourses } = result;

  return (
    <div className="import-preview" aria-live="polite" aria-atomic="true">
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

      {skipped.length > 0 && (
        <details className="import-preview__skipped">
          <summary className="import-preview__skipped-summary">
            {skipped.length} skipped {skipped.length === 1 ? "line" : "lines"}
          </summary>
          <div className="import-preview__skipped-list">
            {skipped.map((s, idx) => (
              <div key={idx} className="import-preview__skip-item">
                <span className="import-preview__skip-line"><code>{s.text}</code></span>
                <span className="import-preview__skip-reason">{s.reason}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}


// ── Original paste-mode preview ───────────────────────────────────────────────

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

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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

