// ── importParser.js ───────────────────────────────────────────────────────────
// Parses bulk course import text.
//
// Accepts comma-separated lines in two formats:
//   Format A (score):  MTH101, 3, 75
//   Format B (grade):  MTH101, 3, A
//
// Mixed formats within a single import are accepted.
// Each line is evaluated independently.
//
// Returns a structured result object with valid courses and a skip report.


// ── Main Parser ───────────────────────────────────────────────────────────────

/**
 * Parses multi-line import text into a list of course objects.
 *
 * @param {string} rawText         - The pasted import text
 * @param {Array}  gradeTable      - Institution's gradeTable array
 * @param {Function} generateId   - ID generator function (returns a unique string)
 *
 * @returns {ImportResult}
 * {
 *   courses:  Array of valid course objects ready to add to a semester
 *   skipped:  Array of { line, lineNumber, reason } for the summary display
 *   total:    Total lines attempted
 *   imported: Count of successfully parsed courses
 * }
 */
export function parseImportText(rawText, gradeTable, generateId) {
  if (!rawText || typeof rawText !== "string") {
    return emptyResult();
  }

  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return emptyResult();

  const courses = [];
  const skipped = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const result = parseLine(line, gradeTable, generateId);

    if (result.valid) {
      courses.push(result.course);
    } else {
      skipped.push({
        line,
        lineNumber,
        reason: result.reason,
      });
    }
  }

  return {
    courses,
    skipped,
    total: lines.length,
    imported: courses.length,
  };
}


// ── Line Parser ───────────────────────────────────────────────────────────────

/**
 * Parses a single line of import text.
 *
 * Expected format: "CourseName, CreditUnits, ScoreOrGrade"
 * Also accepts tab-separated fields.
 *
 * @param {string}   line
 * @param {Array}    gradeTable
 * @param {Function} generateId
 * @returns {{ valid: boolean, course?: Object, reason?: string }}
 */
function parseLine(line, gradeTable, generateId) {
  // Normalise separators: allow commas or tabs
  const parts = line
    .split(/,|\t/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Must have at least 3 fields
  if (parts.length < 3) {
    return {
      valid: false,
      reason: `Expected 3 fields (name, credit units, score or grade) but found ${parts.length}.`,
    };
  }

  const rawName   = parts[0];
  const rawCU     = parts[1];
  const rawThird  = parts[2];

  // ── Course name ───────────────────────────────────────────────────────────
  const name = rawName.trim();
  if (name.length < 1) {
    return { valid: false, reason: "Course name is empty." };
  }
  if (name.length > 50) {
    return {
      valid: false,
      reason: `Course name "${name.slice(0, 20)}..." exceeds 50 characters.`,
    };
  }

  // ── Credit units ──────────────────────────────────────────────────────────
  const cu = parseInt(rawCU, 10);
  if (isNaN(cu) || cu < 1 || cu > 6 || !Number.isInteger(cu)) {
    return {
      valid: false,
      reason: `Credit units "${rawCU}" is invalid. Must be a whole number between 1 and 6.`,
    };
  }

  // ── Third field: score or grade ───────────────────────────────────────────
  const inputType = detectInputType(rawThird);

  if (inputType === "invalid") {
    return {
      valid: false,
      reason: `"${rawThird}" is not a recognised score (0–100) or grade letter.`,
    };
  }

  if (inputType === "score") {
    const score = Math.round(parseFloat(rawThird));

    if (isNaN(score) || score < 0 || score > 100) {
      return {
        valid: false,
        reason: `Score "${rawThird}" is out of range. Must be between 0 and 100.`,
      };
    }

    // Resolve grade from score using the institution's grade table
    const gradeEntry = resolveGradeFromScore(score, gradeTable);
    if (!gradeEntry) {
      return {
        valid: false,
        reason: `Score ${score} could not be mapped to a grade with the selected institution's grading table.`,
      };
    }

    return {
      valid: true,
      course: buildCourse({
        id: generateId(),
        name,
        creditUnits: cu,
        score,
        grade: gradeEntry.letter,
        gradePoint: gradeEntry.point,
        qualityPoint: cu * gradeEntry.point,
        status: gradeEntry.point === 0 ? "failed" : "passed",
      }),
    };
  }

  if (inputType === "grade") {
    const letter = rawThird.trim().toUpperCase();

    const gradeEntry = gradeTable.find(
      (g) => g.letter.toUpperCase() === letter
    );

    if (!gradeEntry) {
      const validLetters = gradeTable.map((g) => g.letter).join(", ");
      return {
        valid: false,
        reason: `"${letter}" is not a valid grade letter for the selected institution. Valid grades: ${validLetters}.`,
      };
    }

    // Use the minimum score for the grade as a representative value
    const score = gradeEntry.min;

    return {
      valid: true,
      course: buildCourse({
        id: generateId(),
        name,
        creditUnits: cu,
        score,
        grade: gradeEntry.letter,
        gradePoint: gradeEntry.point,
        qualityPoint: cu * gradeEntry.point,
        status: gradeEntry.point === 0 ? "failed" : "passed",
      }),
    };
  }

  return { valid: false, reason: "Unrecognised line format." };
}


// ── Input Type Detection ──────────────────────────────────────────────────────

/**
 * Detects whether the third field of an import line is a score or a grade letter.
 *
 * Rules:
 *  - If the trimmed value is a finite number: "score"
 *  - If the trimmed value is 1–2 letters covering all supported grade systems
 *    (A–H for 7.0 scale, A–F for 5.0/4.0, AB/BC for AUN): "grade"
 *  - Otherwise: "invalid"
 *
 * @param {string} value
 * @returns {"score" | "grade" | "invalid"}
 */
export function detectInputType(value) {
  if (!value || typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed === "") return "invalid";

  // Numeric check: handles integers and decimals
  if (!isNaN(trimmed) && trimmed !== "") return "score";

  // Grade letter check: 1–2 characters, letters only
  // Covers A–H (7.0 legacy scale), A–F (standard), AB/BC (AUN American)
  if (/^[A-Ha-h]{1,2}$/.test(trimmed)) return "grade";

  return "invalid";
}


// ── Preview Generator ─────────────────────────────────────────────────────────

/**
 * Generates a lightweight preview of what would be imported.
 * Used in the import modal before the user confirms.
 *
 * Returns the same structure as parseImportText but for display only —
 * IDs in the preview are temporary and will be regenerated on actual import.
 *
 * @param {string} rawText
 * @param {Array}  gradeTable
 * @returns {ImportResult}
 */
export function previewImport(rawText, gradeTable) {
  let counter = 0;
  const tempId = () => `preview-${++counter}`;
  return parseImportText(rawText, gradeTable, tempId);
}


// ── Import Summary Message ────────────────────────────────────────────────────

/**
 * Builds the human-readable summary shown after import completes.
 *
 * @param {ImportResult} result
 * @returns {string}
 */
export function buildImportSummary(result) {
  const { imported, skipped, total } = result;

  if (total === 0) return "No lines found in the pasted text.";

  let msg = `${imported} ${imported === 1 ? "course" : "courses"} imported.`;

  if (skipped.length > 0) {
    msg +=
      ` ${skipped.length} ${skipped.length === 1 ? "line was" : "lines were"} skipped:`;
    for (const skip of skipped) {
      msg += `\n  Line ${skip.lineNumber}: "${skip.line}" — ${skip.reason}`;
    }
  }

  return msg;
}


// ── Format Guide ─────────────────────────────────────────────────────────────

/**
 * Returns the format guide string shown in the ImportModal.
 * Kept here so the guide and the parser are always in sync.
 *
 * @param {Array} gradeTable - Institution's gradeTable (used to show valid grades)
 * @returns {string}
 */
export function getFormatGuide(gradeTable) {
  const validGrades = Array.isArray(gradeTable)
    ? gradeTable.map((g) => g.letter).join(", ")
    : "A, B, C, D, E, F";

  return (
    `Paste one course per line.\n\n` +
    `Score format:   CourseName, CreditUnits, Score\n` +
    `                Example: MTH101, 3, 75\n\n` +
    `Grade format:   CourseName, CreditUnits, Grade\n` +
    `                Example: MTH101, 3, A\n\n` +
    `Valid grades for your institution: ${validGrades}\n` +
    `Credit units must be a whole number between 1 and 6.\n` +
    `Score must be between 0 and 100.\n` +
    `Both formats can be mixed in the same import.`
  );
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveGradeFromScore(score, gradeTable) {
  if (!Array.isArray(gradeTable)) return null;
  const sorted = [...gradeTable].sort((a, b) => b.min - a.min);
  for (const entry of sorted) {
    if (score >= entry.min && score <= entry.max) return entry;
  }
  return null;
}

function buildCourse(fields) {
  return {
    id:           fields.id,
    name:         fields.name,
    creditUnits:  fields.creditUnits,
    score:        fields.score ?? null,
    grade:        fields.grade ?? null,
    gradePoint:   fields.gradePoint ?? null,
    qualityPoint: fields.qualityPoint ?? null,
    status:       fields.status ?? "pending",
  };
}

function emptyResult() {
  return { courses: [], skipped: [], total: 0, imported: 0 };
}