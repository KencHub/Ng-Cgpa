// ── calculator.js ─────────────────────────────────────────────────────────────
// All arithmetic for the NG CGPA application lives here.
// No component performs raw calculation. Components call these functions only.
//
// CRITICAL: CGPA is ALWAYS computed as:
//   total quality points across ALL semesters / total credit units across ALL semesters
//
// It is NOT the average of semester GPAs. That formula is mathematically wrong
// whenever credit unit loads differ between semesters. See computeCGPA below.


// ── Score to Grade ────────────────────────────────────────────────────────────

/**
 * Maps a numeric score to a grade entry using the institution's grade table.
 *
 * The table is iterated from highest min downward. The first entry whose
 * min is <= score is returned. This handles all scale groups correctly,
 * including custom schools with non-standard boundaries.
 *
 * @param {number} score - Numeric score 0–100
 * @param {Array}  gradeTable - Institution's gradeTable array
 * @returns {Object|null} Matching grade entry, or null if no match
 */
export function scoreToGrade(score, gradeTable) {
  if (score === null || score === undefined || isNaN(score)) return null;
  if (!Array.isArray(gradeTable) || gradeTable.length === 0) return null;

  const clamped = Math.round(Math.max(0, Math.min(100, score)));

  // Sort a copy highest-first so the function is order-independent of the input
  const sorted = [...gradeTable].sort((a, b) => b.min - a.min);

  for (const entry of sorted) {
    if (clamped >= entry.min && clamped <= entry.max) {
      return entry;
    }
  }

  return null;
}


// ── Grade to Minimum Score ────────────────────────────────────────────────────

/**
 * Returns the minimum score for a given grade letter.
 * Used to pre-fill the score field when a student selects a grade directly.
 *
 * @param {string} letter - Grade letter, e.g. "A", "B"
 * @param {Array}  gradeTable - Institution's gradeTable array
 * @returns {number|null} Minimum score for that grade, or null if not found
 */
export function gradeToMinScore(letter, gradeTable) {
  if (!letter || !Array.isArray(gradeTable)) return null;
  const entry = gradeTable.find(
    (g) => g.letter.toUpperCase() === letter.toUpperCase()
  );
  return entry ? entry.min : null;
}


// ── Grade Point from Letter ───────────────────────────────────────────────────

/**
 * Returns the grade point for a given grade letter.
 *
 * @param {string} letter - Grade letter
 * @param {Array}  gradeTable - Institution's gradeTable array
 * @returns {number|null} Grade point value, or null if not found
 */
export function gradeLetterToPoint(letter, gradeTable) {
  if (!letter || !Array.isArray(gradeTable)) return null;
  const entry = gradeTable.find(
    (g) => g.letter.toUpperCase() === letter.toUpperCase()
  );
  return entry !== undefined ? entry.point : null;
}


// ── Quality Point for One Course ──────────────────────────────────────────────

/**
 * Computes quality points for a single course.
 *   qualityPoint = creditUnits * gradePoint
 *
 * @param {number} creditUnits
 * @param {number} gradePoint
 * @returns {number}
 */
export function computeQualityPoint(creditUnits, gradePoint) {
  if (
    creditUnits === null || creditUnits === undefined || isNaN(creditUnits) ||
    gradePoint === null || gradePoint === undefined || isNaN(gradePoint)
  ) {
    return 0;
  }
  return creditUnits * gradePoint;
}


// ── Semester GPA ──────────────────────────────────────────────────────────────

/**
 * Computes the GPA for a single semester.
 *   semesterGPA = sum(qualityPoints) / sum(creditUnits)
 *
 * Returns null — not 0 — when there are no valid courses.
 * This distinction prevents false CGPA drag from empty or incomplete semesters.
 *
 * Only courses with both a valid creditUnits and a resolved gradePoint
 * (including 0 for F) are included.
 *
 * @param {Array} courses - Array of course objects for one semester
 * @param {Array} gradeTable - Institution's gradeTable array
 * @returns {number|null}
 */
export function computeSemesterGPA(courses, gradeTable) {
  if (!Array.isArray(courses) || courses.length === 0) return null;

  let totalQP = 0;
  let totalCU = 0;

  for (const course of courses) {
    const cu = parseFloat(course.creditUnits);
    if (isNaN(cu) || cu <= 0) continue;

    let gp = null;

    if (course.gradePoint !== null && course.gradePoint !== undefined && !isNaN(course.gradePoint)) {
      gp = course.gradePoint;
    } else if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
      const entry = scoreToGrade(course.score, gradeTable);
      gp = entry ? entry.point : null;
    } else if (course.grade) {
      gp = gradeLetterToPoint(course.grade, gradeTable);
    }

    if (gp === null) continue;

    totalQP += cu * gp;
    totalCU += cu;
  }

  if (totalCU === 0) return null;

  return round4(totalQP / totalCU);
}


// ── CGPA ──────────────────────────────────────────────────────────────────────

/**
 * Computes cumulative CGPA across ALL semesters.
 *
 *   CGPA = sum(all qualityPoints) / sum(all creditUnits)
 *
 * NOT the average of semester GPAs. That formula produces incorrect results
 * whenever credit unit loads differ between semesters.
 *
 * Returns null when no valid data exists across any semester.
 *
 * @param {Array} semesters - Array of semester objects, each with a courses array
 * @param {Array} gradeTable - Institution's gradeTable array
 * @returns {number|null}
 */
export function computeCGPA(semesters, gradeTable) {
  if (!Array.isArray(semesters) || semesters.length === 0) return null;

  let totalQP = 0;
  let totalCU = 0;

  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;

    for (const course of semester.courses) {
      const cu = parseFloat(course.creditUnits);
      if (isNaN(cu) || cu <= 0) continue;

      let gp = null;

      if (course.gradePoint !== null && course.gradePoint !== undefined && !isNaN(course.gradePoint)) {
        gp = course.gradePoint;
      } else if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
        const entry = scoreToGrade(course.score, gradeTable);
        gp = entry ? entry.point : null;
      } else if (course.grade) {
        gp = gradeLetterToPoint(course.grade, gradeTable);
      }

      if (gp === null) continue;

      totalQP += cu * gp;
      totalCU += cu;
    }
  }

  if (totalCU === 0) return null;

  return round4(totalQP / totalCU);
}


// ── Running Totals ────────────────────────────────────────────────────────────

/**
 * Returns the total credit units and total quality points across all semesters.
 * Only courses with a resolved grade point are counted.
 *
 * @param {Array} semesters
 * @param {Array} gradeTable
 * @returns {{ totalCU: number, totalQP: number }}
 */
export function computeTotals(semesters, gradeTable) {
  if (!Array.isArray(semesters)) return { totalCU: 0, totalQP: 0 };

  let totalCU = 0;
  let totalQP = 0;

  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;

    for (const course of semester.courses) {
      const cu = parseFloat(course.creditUnits);
      if (isNaN(cu) || cu <= 0) continue;

      let gp = null;

      if (course.gradePoint !== null && course.gradePoint !== undefined && !isNaN(course.gradePoint)) {
        gp = course.gradePoint;
      } else if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
        const entry = scoreToGrade(course.score, gradeTable);
        gp = entry ? entry.point : null;
      } else if (course.grade) {
        gp = gradeLetterToPoint(course.grade, gradeTable);
      }

      if (gp === null) continue;

      totalQP += cu * gp;
      totalCU += cu;
    }
  }

  return { totalCU, totalQP };
}


// ── Degree Classification ─────────────────────────────────────────────────────

/**
 * Returns the classification entry for a given CGPA.
 *
 * Iterates the classifications array from highest to lowest.
 * If CGPA is exactly on a boundary, it is assigned to the higher class.
 * This matches standard Nigerian university practice.
 *
 * @param {number|null} cgpa
 * @param {Array} classifications - Institution's classifications array
 * @returns {Object|null} Matching classification entry, or null
 */
export function getClassification(cgpa, classifications) {
  if (cgpa === null || cgpa === undefined || isNaN(cgpa)) return null;
  if (!Array.isArray(classifications) || classifications.length === 0) return null;

  // Sort a copy highest-first so the function is order-independent of input
  const sorted = [...classifications].sort((a, b) => b.min - a.min);

  for (const entry of sorted) {
    if (cgpa >= entry.min) {
      return entry;
    }
  }

  return null;
}


// ── Resolved Course Data ──────────────────────────────────────────────────────

/**
 * Takes a raw course object and resolves its grade, gradePoint, and qualityPoint
 * from the institution's grade table. Returns a new object — never mutates input.
 *
 * Priority: gradePoint already set > score > grade letter
 *
 * @param {Object} course
 * @param {Array}  gradeTable
 * @returns {Object} Course with resolved grade, gradePoint, qualityPoint, status
 */
export function resolveCourse(course, gradeTable) {
  const cu = parseFloat(course.creditUnits);
  const validCU = !isNaN(cu) && cu > 0;

  let gradeEntry = null;

  if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
    gradeEntry = scoreToGrade(course.score, gradeTable);
  } else if (course.grade) {
    gradeEntry = gradeTable.find(
      (g) => g.letter.toUpperCase() === course.grade.toUpperCase()
    ) || null;
  }

  const gradePoint = gradeEntry ? gradeEntry.point : null;
  const gradeLetter = gradeEntry ? gradeEntry.letter : (course.grade || null);
  const qualityPoint = (validCU && gradePoint !== null) ? cu * gradePoint : null;
  const status = gradeEntry
    ? (gradeEntry.point === 0 ? "failed" : "passed")
    : "pending";

  return {
    ...course,
    grade: gradeLetter,
    gradePoint,
    qualityPoint,
    status,
  };
}


// ── Semester Summary ──────────────────────────────────────────────────────────

/**
 * Returns a summary object for a single semester.
 *
 * @param {Object} semester - Semester with courses array
 * @param {Array}  gradeTable
 * @returns {{ totalCU, totalQP, gpa }}
 */
export function computeSemesterSummary(semester, gradeTable) {
  if (!semester || !Array.isArray(semester.courses)) {
    return { totalCU: 0, totalQP: 0, gpa: null };
  }

  let totalCU = 0;
  let totalQP = 0;

  for (const course of semester.courses) {
    const resolved = resolveCourse(course, gradeTable);
    const cu = parseFloat(resolved.creditUnits);
    if (isNaN(cu) || cu <= 0 || resolved.gradePoint === null) continue;
    totalCU += cu;
    totalQP += resolved.qualityPoint;
  }

  const gpa = totalCU > 0 ? round4(totalQP / totalCU) : null;
  return { totalCU, totalQP, gpa };
}


// ── Carryover Impact ──────────────────────────────────────────────────────────

/**
 * Calculates the CGPA impact of retaking a failed course.
 *
 * Shows: "If you retake [course] and earn a [targetGrade], your CGPA
 * would increase by approximately [delta]."
 *
 * @param {Object} failedCourse   - The course with grade F (gradePoint = 0)
 * @param {string} targetGrade    - Target grade letter, e.g. "C"
 * @param {number} currentTotalCU - Total credit units already in the CGPA
 * @param {number} currentTotalQP - Total quality points already in the CGPA
 * @param {Array}  gradeTable     - Institution's gradeTable array
 * @returns {{ currentCGPA, projectedCGPA, delta, targetGradePoint } | null}
 */
export function computeCarryoverImpact(
  failedCourse,
  targetGrade,
  currentTotalCU,
  currentTotalQP,
  gradeTable
) {
  const cu = parseFloat(failedCourse.creditUnits);
  if (isNaN(cu) || cu <= 0) return null;
  if (currentTotalCU <= 0) return null;

  const targetEntry = gradeTable.find(
    (g) => g.letter.toUpperCase() === targetGrade.toUpperCase()
  );
  if (!targetEntry) return null;

  const currentCGPA = currentTotalCU > 0
    ? round4(currentTotalQP / currentTotalCU)
    : null;

  // After retake, the failed course now contributes targetGradePoint * cu
  // instead of 0. Total CU stays the same.
  const gainedQP = targetEntry.point * cu;
  const newTotalQP = currentTotalQP + gainedQP;
  const projectedCGPA = round4(newTotalQP / currentTotalCU);
  const delta = round4(projectedCGPA - (currentCGPA || 0));

  return {
    currentCGPA,
    projectedCGPA,
    delta,
    targetGradePoint: targetEntry.point,
    targetGradeLetter: targetEntry.letter,
    creditUnits: cu,
  };
}


// ── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Returns true if a score value is valid for the app.
 * @param {*} value
 * @returns {boolean}
 */
export function isValidScore(value) {
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0 && n <= 100;
}

/**
 * Returns true if the credit unit value is valid.
 * @param {*} value
 * @returns {boolean}
 */
export function isValidCreditUnit(value) {
  const n = parseInt(value, 10);
  return !isNaN(n) && n >= 1 && n <= 6 && Number.isInteger(n);
}

/**
 * Returns true if the grade letter is valid for the given grade table.
 * @param {string} letter
 * @param {Array}  gradeTable
 * @returns {boolean}
 */
export function isValidGradeLetter(letter, gradeTable) {
  if (!letter || !Array.isArray(gradeTable)) return false;
  return gradeTable.some(
    (g) => g.letter.toUpperCase() === letter.toUpperCase()
  );
}


// ── Rounding ──────────────────────────────────────────────────────────────────

/**
 * Rounds a number to 4 decimal places.
 * Used internally to prevent floating-point drift in CGPA.
 */
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Rounds a number to 2 decimal places for display.
 * @param {number} n
 * @returns {number}
 */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Formats a CGPA or GPA number to 2 decimal places as a string.
 * Returns "—" if null or NaN.
 * @param {number|null} n
 * @returns {string}
 */
export function formatGPA(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toFixed(2);
}