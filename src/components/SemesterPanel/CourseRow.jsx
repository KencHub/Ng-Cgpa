// ── CourseRow.jsx ─────────────────────────────────────────────────────────────
// A single editable course entry in the semester course table.
//
// NC badge lives inline to the right of the course name input — never inside
// the CU cell. InfoPopover renders via ReactDOM.createPortal into document.body
// so it is never clipped by any parent overflow:hidden.
//
// Styles live in SemesterPanel.css.
//
// CHANGED: credit unit maximum raised from 6 to 8.
// Some technology and professional courses at Nigerian universities carry
// 7 or 8 credit units. Validation, error messages, and the input max
// attribute all reflect this.

import React, { useState, useEffect, useRef, useId } from "react";
import ReactDOM from "react-dom";
import { gradeToMinScore } from "../../utils/calculator.js";


// ── InfoPopover ────────────────────────────────────────────────────────────────

function InfoPopover({ anchorRef, open, onClose, children, width = 240 }) {
  const [coords, setCoords] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null);
      return;
    }

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
      ) {
        onClose();
      }
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
      <div
        className="info-popover__arrow"
        style={{ left: coords.arrowLeft }}
      />
    </div>,
    document.body
  );
}


// ── CourseRow ─────────────────────────────────────────────────────────────────

const CourseRow = React.forwardRef(function CourseRow(
  {
    course,
    activeGradeTable,
    institution,
    onUpdate,
    onRemove,
    rowIndex,
  },
  ref
) {

  // ── Local input state ───────────────────────────────────────────────────────

  const [localName,  setLocalName]  = useState(course.name  ?? "");
  const [localScore, setLocalScore] = useState(
    course.score !== null && course.score !== undefined
      ? String(course.score)
      : ""
  );

  const nameFocused  = useRef(false);
  const scoreFocused = useRef(false);

  useEffect(() => {
    if (!nameFocused.current) setLocalName(course.name ?? "");
  }, [course.name]);

  useEffect(() => {
    if (!scoreFocused.current) {
      setLocalScore(
        course.score !== null && course.score !== undefined
          ? String(course.score)
          : ""
      );
    }
  }, [course.score]);

  // ── Validation errors ───────────────────────────────────────────────────────

  const [nameError,  setNameError]  = useState("");
  const [cuError,    setCUError]    = useState("");
  const [scoreError, setScoreError] = useState("");

  // ── Popover state ───────────────────────────────────────────────────────────

  const [ncOpen, setNcOpen] = useState(false);
  const [fOpen,  setFOpen]  = useState(false);
  const ncAnchorRef = useRef(null);
  const fAnchorRef  = useRef(null);

  const uid = useId();


  // ── Name ────────────────────────────────────────────────────────────────────

  function handleNameChange(e) {
    const val = e.target.value.slice(0, 50);
    setLocalName(val);
    if (nameError && val.trim().length >= 2) setNameError("");
  }

  function handleNameBlur() {
    nameFocused.current = false;
    const trimmed = localName.trim();
    if (trimmed.length > 0 && trimmed.length < 2) {
      setNameError("Must be at least 2 characters.");
      return;
    }
    setNameError("");
    if (trimmed !== course.name) {
      onUpdate(course.id, { name: trimmed });
    }
  }

  function handleNameFocus() {
    nameFocused.current = true;
  }


  // ── Credit units ───────────────────────────────────────────────────────────
  // Maximum is 8. Some technology and professional programmes carry 7–8 units.

  function handleCUChange(e) {
    const raw = e.target.value;
    if (raw === "") {
      onUpdate(course.id, { creditUnits: "" });
      setCUError("");
      return;
    }
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      onUpdate(course.id, { creditUnits: n });
      if (n >= 0 && n <= 8) setCUError("");
    }
  }

  function handleCUBlur() {
    const n = parseInt(course.creditUnits, 10);
    if (
      course.creditUnits === "" ||
      isNaN(n) ||
      n < 0 ||
      n > 8 ||
      !Number.isInteger(n)
    ) {
      setCUError("0 to 8");
    } else {
      setCUError("");
    }
  }


  // ── Score ─────────────────────────────────────────────────────────────────

  function handleScoreChange(e) {
    scoreFocused.current = true;
    setLocalScore(e.target.value);
    if (scoreError) setScoreError("");
  }

  function handleScoreFocus() {
    scoreFocused.current = true;
  }

  function handleScoreBlur() {
    scoreFocused.current = false;
    const raw = localScore.trim();

    if (raw === "") {
      onUpdate(course.id, { score: null, grade: null });
      setScoreError("");
      return;
    }

    const num = Math.round(parseFloat(raw));

    if (isNaN(num) || num < 0 || num > 100) {
      setScoreError("0 – 100");
      setLocalScore(
        course.score !== null && course.score !== undefined
          ? String(course.score)
          : ""
      );
      return;
    }

    setScoreError("");
    setLocalScore(String(num));
    if (num !== course.score) {
      onUpdate(course.id, { score: num });
    }
  }

  function handleScoreKeyDown(e) {
    if (e.key === "Enter") e.target.blur();
  }


  // ── Grade ─────────────────────────────────────────────────────────────────

  function handleGradeChange(e) {
    const grade = e.target.value;
    if (!grade) {
      onUpdate(course.id, { grade: null, score: null });
      return;
    }
    const minScore = gradeToMinScore(grade, activeGradeTable);
    onUpdate(course.id, { grade, score: minScore });
  }


  // ── Derived values ────────────────────────────────────────────────────────

  const isNonContributing =
    course.nonContributing === true || parseInt(course.creditUnits) === 0;

  const isCarryover =
    !isNonContributing &&
    course.gradePoint === 0 &&
    course.grade !== null &&
    course.grade !== undefined &&
    course.grade !== "";

  const isFailed = course.status === "failed";

  const gpDisplay =
    course.gradePoint !== null && course.gradePoint !== undefined
      ? String(course.gradePoint)
      : "—";

  const qpDisplay = isNonContributing
    ? "0"
    : course.qualityPoint !== null && course.qualityPoint !== undefined
      ? (Math.round(course.qualityPoint * 100) / 100).toFixed(2)
      : "—";

  const scoreDisplay = localScore;
  const gradeValue   = course.grade || "";

  const rowClass = [
    "course-row",
    isCarryover                   ? "course-row--carryover"       : "",
    isNonContributing             ? "course-row--noncontrib"      : "",
    isNonContributing && isFailed ? "course-row--noncontrib-fail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const schoolName = institution?.shortName || null;


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={ref}
      className={rowClass}
      role="row"
      aria-rowindex={rowIndex + 2}
    >

      {/* ── Course name + NC badge ────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--name" role="cell">
        <div className="course-name-wrap">
          <input
            type="text"
            className={`course-input${nameError ? " course-input--error" : ""}`}
            value={localName}
            onChange={handleNameChange}
            onFocus={handleNameFocus}
            onBlur={handleNameBlur}
            placeholder="Course code / name"
            maxLength={50}
            aria-label={`Course name, row ${rowIndex + 1}`}
            aria-invalid={nameError ? "true" : "false"}
            aria-describedby={nameError ? `${uid}-name-err` : undefined}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
          />

          {isNonContributing && (
            <>
              <button
                ref={ncAnchorRef}
                className="cu-nc-badge"
                type="button"
                onClick={() => setNcOpen((v) => !v)}
                aria-expanded={ncOpen}
                aria-label="Non-contributing course. Tap for details."
              >
                NC
                <IconInfo />
              </button>

              <InfoPopover
                anchorRef={ncAnchorRef}
                open={ncOpen}
                onClose={() => setNcOpen(false)}
                width={240}
              >
                0 credit units. This course is recorded and graded but does
                not affect your GPA or CGPA.
                {schoolName
                  ? ` Common for general studies courses at ${schoolName}.`
                  : " Common for general studies courses."}
              </InfoPopover>
            </>
          )}
        </div>

        {nameError && (
          <span
            id={`${uid}-name-err`}
            className="course-row__field-error"
            role="alert"
          >
            {nameError}
          </span>
        )}
      </div>


      {/* ── Credit units ─────────────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--cu" role="cell">
        <div className="cu-input-wrap">
          <input
            type="number"
            className={[
              "course-input course-input--center",
              cuError && !isNonContributing ? "course-input--error" : "",
              isNonContributing             ? "course-input--warn"  : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={course.creditUnits ?? ""}
            onChange={handleCUChange}
            onBlur={handleCUBlur}
            min={0}
            max={8}
            step={1}
            placeholder="—"
            aria-label={`Credit units, row ${rowIndex + 1}`}
            aria-invalid={
              cuError && !isNonContributing ? "true" : "false"
            }
          />
        </div>

        {cuError && !isNonContributing && (
          <span
            id={`${uid}-cu-err`}
            className="course-row__field-error"
            role="alert"
          >
            {cuError}
          </span>
        )}
      </div>


      {/* ── Score ────────────────────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--score" role="cell">
        <input
          type="text"
          inputMode="numeric"
          className={`course-input course-input--center${
            scoreError ? " course-input--error" : ""
          }`}
          value={scoreDisplay}
          onChange={handleScoreChange}
          onFocus={handleScoreFocus}
          onBlur={handleScoreBlur}
          onKeyDown={handleScoreKeyDown}
          placeholder="0–100"
          maxLength={3}
          aria-label={`Score, row ${rowIndex + 1}`}
          aria-invalid={scoreError ? "true" : "false"}
          aria-describedby={scoreError ? `${uid}-score-err` : undefined}
        />
        {scoreError && (
          <span
            id={`${uid}-score-err`}
            className="course-row__field-error"
            role="alert"
          >
            {scoreError}
          </span>
        )}
      </div>


      {/* ── Grade selector ───────────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--grade" role="cell">
        <select
          className="course-input course-input--center course-input--select"
          value={gradeValue}
          onChange={handleGradeChange}
          aria-label={`Grade, row ${rowIndex + 1}`}
        >
          <option value="">—</option>
          {activeGradeTable.map((g) => (
            <option key={g.letter} value={g.letter}>
              {g.letter}
            </option>
          ))}
        </select>
      </div>


      {/* ── Grade point (read-only derived) ──────────────────────────────── */}
      <div
        className={[
          "course-row__cell course-row__cell--gp course-row__derived",
          isCarryover       ? "course-row__derived--fail"  : "",
          isNonContributing ? "course-row__derived--muted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="cell"
        aria-label={`Grade point: ${gpDisplay}`}
      >
        {gpDisplay}
      </div>


      {/* ── Quality point (read-only derived) ────────────────────────────── */}
      <div
        className={[
          "course-row__cell course-row__cell--qp course-row__derived",
          isCarryover       ? "course-row__derived--fail"  : "",
          isNonContributing ? "course-row__derived--muted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="cell"
        aria-label={`Quality points: ${qpDisplay}`}
      >
        {qpDisplay}
      </div>


      {/* ── Carryover badge ───────────────────────────────────────────────── */}
      {isCarryover && (
        <div className="course-row__cell course-row__cell--badge" role="cell">
          <button
            ref={fAnchorRef}
            className="carryover-badge"
            type="button"
            onClick={() => setFOpen((v) => !v)}
            aria-expanded={fOpen}
            aria-label="Failed course. Tap to see CGPA impact."
          >
            <span className="carryover-badge__label">F</span>
          </button>

          <InfoPopover
            anchorRef={fAnchorRef}
            open={fOpen}
            onClose={() => setFOpen(false)}
            width={240}
          >
            This F grade contributes 0 quality points but still counts toward
            your total credit units, pulling your CGPA down.
            {course.creditUnits && parseInt(course.creditUnits) >= 1 && (
              <>
                {" "}Retaking this {course.creditUnits}-unit course and earning
                a C adds{" "}
                {(parseInt(course.creditUnits) * 3).toFixed(0)} quality points
                without changing your credit unit count.
              </>
            )}
          </InfoPopover>
        </div>
      )}


      {/* ── Delete ───────────────────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--delete" role="cell">
        <button
          className="course-row__delete-btn"
          onClick={() => onRemove(course.id)}
          aria-label={`Remove ${localName || "this course"}`}
          title="Remove course"
          type="button"
        >
          <IconTrash />
        </button>
      </div>

    </div>
  );
});

export default CourseRow;


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.6 7.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-7.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M5.5 6.5v3M8.5 6.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="4.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 4.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="3" r="0.6" fill="currentColor" />
    </svg>
  );
}