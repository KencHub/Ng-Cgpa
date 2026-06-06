// ── CourseRow.jsx ─────────────────────────────────────────────────────────────
// A single editable course entry in the semester course table.
//
// Score and grade fields are mutually linked:
//   Typing a score → grade auto-derives via resolveCourse in useCGPA
//   Selecting a grade → score sets to the minimum for that grade
//
// Local state buffers the name and score inputs so the parent is not
// updated on every keystroke — syncing happens on blur. This prevents
// flickering grade values while a score is being typed.
//
// Styles live in SemesterPanel.css (Batch 17).


import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { gradeToMinScore } from "../../utils/calculator.js";


// ── CourseRow ─────────────────────────────────────────────────────────────────

const CourseRow = React.forwardRef(function CourseRow(
  {
    course,
    activeGradeTable,
    onUpdate,
    onRemove,
    rowIndex,
  },
  ref
) {
  // ── Local input state ───────────────────────────────────────────────────────
  // Buffers typing so parent is not spammed with interim values.

  const [localName,  setLocalName]  = useState(course.name  ?? "");
  const [localScore, setLocalScore] = useState(
    course.score !== null && course.score !== undefined
      ? String(course.score)
      : ""
  );

  const nameFocused  = useRef(false);
  const scoreFocused = useRef(false);

  // Sync from parent when the field is not currently focused.
  // This handles the case where grade selection updates the score externally.
  useEffect(() => {
    if (!nameFocused.current)  setLocalName(course.name ?? "");
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

  // IDs for aria relationships
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


  // ── Credit units ─────────────────────────────────────────────────────────────

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
      if (n >= 1 && n <= 6) setCUError("");
    }
  }

  function handleCUBlur() {
    const n = parseInt(course.creditUnits, 10);
    if (course.creditUnits === "" || isNaN(n) || n < 1 || n > 6 || !Number.isInteger(n)) {
      setCUError("1 to 6");
    } else {
      setCUError("");
    }
  }


  // ── Score ────────────────────────────────────────────────────────────────────

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
      // Clear both score and grade when score is wiped
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
      // resolveCourse in useCGPA will derive grade automatically
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

    // Pre-fill score with the minimum score for this grade
    const minScore = gradeToMinScore(grade, activeGradeTable);
    onUpdate(course.id, { grade, score: minScore });
  }


  // ── Derived values ────────────────────────────────────────────────────────

  const isCarryover = (
    course.gradePoint === 0 &&
    (course.grade !== null && course.grade !== undefined && course.grade !== "")
  );

  const gpDisplay = course.gradePoint !== null && course.gradePoint !== undefined
    ? String(course.gradePoint)
    : "—";

  const qpDisplay = course.qualityPoint !== null && course.qualityPoint !== undefined
    ? (Math.round(course.qualityPoint * 100) / 100).toFixed(2)
    : "—";

  const scoreDisplay = localScore;
  const gradeValue   = course.grade || "";


  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={ref}
      className={`course-row${isCarryover ? " course-row--carryover" : ""}`}
      role="row"
      aria-rowindex={rowIndex + 2} /* +2 because header is row 1 */
    >

      {/* ── Course name ──────────────────────────────────────────────────── */}
      <div className="course-row__cell course-row__cell--name" role="cell">
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
        <input
          type="number"
          className={`course-input course-input--center${cuError ? " course-input--error" : ""}`}
          value={course.creditUnits ?? ""}
          onChange={handleCUChange}
          onBlur={handleCUBlur}
          min={1}
          max={6}
          step={1}
          placeholder="—"
          aria-label={`Credit units, row ${rowIndex + 1}`}
          aria-invalid={cuError ? "true" : "false"}
          aria-describedby={cuError ? `${uid}-cu-err` : undefined}
        />
        {cuError && (
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
          className={`course-input course-input--center${scoreError ? " course-input--error" : ""}`}
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
        className={`course-row__cell course-row__cell--gp course-row__derived${isCarryover ? " course-row__derived--fail" : ""}`}
        role="cell"
        aria-label={`Grade point: ${gpDisplay}`}
      >
        {gpDisplay}
      </div>


      {/* ── Quality point (read-only derived) ────────────────────────────── */}
      <div
        className={`course-row__cell course-row__cell--qp course-row__derived${isCarryover ? " course-row__derived--fail" : ""}`}
        role="cell"
        aria-label={`Quality points: ${qpDisplay}`}
      >
        {qpDisplay}
      </div>


      {/* ── Carryover badge ───────────────────────────────────────────────── */}
      {isCarryover && (
        <div className="course-row__cell course-row__cell--badge" role="cell">
          <span className="tooltip-anchor carryover-badge">
            <span className="carryover-badge__label">F</span>
            <div
              className="tooltip-box carryover-badge__tooltip"
              role="tooltip"
            >
              This F grade contributes 0 quality points but still counts
              toward your total credit units, pulling your CGPA down.
              {course.creditUnits && parseInt(course.creditUnits) >= 1 && (
                <> Retaking a {course.creditUnits}-unit course and earning
                a C adds {(parseInt(course.creditUnits) * 3).toFixed(0)} quality
                points to your total without increasing your credit unit count.</>
              )}
            </div>
          </span>
        </div>
      )}


      {/* ── Delete ────────────────────────────────────────────────────────── */}
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
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.6 7.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-7.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M5.5 6.5v3M8.5 6.5v3"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}