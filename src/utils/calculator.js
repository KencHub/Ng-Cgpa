// ── calculator.js ─────────────────────────────────────────────────────────────
// All arithmetic for the NG CGPA application lives here.
// No component performs raw calculation. Components call these functions only.
//
// CRITICAL: CGPA is ALWAYS computed as:
//   total quality points across ALL semesters / total credit units across ALL semesters
//
// It is NOT the average of semester GPAs. That formula is mathematically wrong
// whenever credit unit loads differ between semesters. See computeCGPA below.
//
// registeredCU vs totalCU:
//   registeredCU — all courses with valid CU > 0, graded or not. Used for display.
//   totalCU      — graded courses only. Used as the GPA/CGPA denominator.


// ── Score to Grade ────────────────────────────────────────────────────────────

/**
 * Maps a numeric score to a grade entry using the institution's grade table.
 *
 * @param {number} score - Numeric score 0–100
 * @param {Array}  gradeTable - Institution's gradeTable array
 * @returns {Object|null} Matching grade entry, or null if no match
 */
export function scoreToGrade(score, gradeTable) {
  if (score === null || score === undefined || isNaN(score)) return null;
  if (!Array.isArray(gradeTable) || gradeTable.length === 0) return null;

  const clamped = Math.round(Math.max(0, Math.min(100, score)));
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
 *
 * @param {string} letter
 * @param {Array}  gradeTable
 * @returns {number|null}
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
 * @param {string} letter
 * @param {Array}  gradeTable
 * @returns {number|null}
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
 * Returns null when there are no valid graded courses.
 * Ungraded courses and courses with 0 credit units are excluded from this sum.
 *
 * @param {Array} courses
 * @param {Array} gradeTable
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
 * NOT the average of semester GPAs.
 * Ungraded courses and courses with 0 credit units are excluded from both sums.
 *
 * @param {Array} semesters
 * @param {Array} gradeTable
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
 * Returns total credit units, total quality points, and registered credit units
 * across all semesters.
 *
 * totalCU      — graded courses only. Used as the CGPA denominator.
 * totalQP      — quality points for graded courses only.
 * registeredCU — all courses with valid CU > 0, graded or not. Used for display.
 *
 * @param {Array} semesters
 * @param {Array} gradeTable
 * @returns {{ totalCU: number, totalQP: number, registeredCU: number }}
 */
export function computeTotals(semesters, gradeTable) {
  if (!Array.isArray(semesters)) return { totalCU: 0, totalQP: 0, registeredCU: 0 };

  let totalCU      = 0;
  let totalQP      = 0;
  let registeredCU = 0;

  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;

    for (const course of semester.courses) {
      const cu = parseFloat(course.creditUnits);
      if (isNaN(cu) || cu <= 0) continue;

      registeredCU += cu; // count all courses with a valid CU, graded or not

      let gp = null;

      if (course.gradePoint !== null && course.gradePoint !== undefined && !isNaN(course.gradePoint)) {
        gp = course.gradePoint;
      } else if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
        const entry = scoreToGrade(course.score, gradeTable);
        gp = entry ? entry.point : null;
      } else if (course.grade) {
        gp = gradeLetterToPoint(course.grade, gradeTable);
      }

      if (gp === null) continue; // skip ungraded for arithmetic only

      totalQP += cu * gp;
      totalCU += cu;
    }
  }

  return { totalCU, totalQP, registeredCU };
}


// ── Degree Classification ─────────────────────────────────────────────────────

/**
 * Returns the classification entry for a given CGPA.
 * If CGPA is exactly on a boundary, it is assigned to the higher class.
 *
 * @param {number|null} cgpa
 * @param {Array} classifications
 * @returns {Object|null}
 */
export function getClassification(cgpa, classifications) {
  if (cgpa === null || cgpa === undefined || isNaN(cgpa)) return null;
  if (!Array.isArray(classifications) || classifications.length === 0) return null;

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
 * Takes a raw course object and resolves grade, gradePoint, qualityPoint,
 * status, and nonContributing flag. Returns a new object — never mutates input.
 *
 * KEY BEHAVIOUR FOR 0 CU COURSES:
 * - nonContributing is set to true
 * - qualityPoint is 0 (not null)
 * - status is still "passed" or "failed" based on the actual grade
 *   because a 0 CU course can still be compulsory and the student's
 *   result matters even though it does not affect CGPA
 * - The cu <= 0 guards in computeSemesterGPA, computeCGPA, and computeTotals
 *   ensure these courses never enter any GPA or CGPA sum
 *
 * @param {Object} course
 * @param {Array}  gradeTable
 * @returns {Object}
 */
export function resolveCourse(course, gradeTable) {
  const cu = parseFloat(course.creditUnits);
  const validCU = !isNaN(cu) && cu >= 0;
  const isZeroCU = validCU && cu === 0;

  let gradeEntry = null;

  if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
    gradeEntry = scoreToGrade(course.score, gradeTable);
  } else if (course.grade) {
    gradeEntry = gradeTable.find(
      (g) => g.letter.toUpperCase() === course.grade.toUpperCase()
    ) || null;
  }

  const gradePoint  = gradeEntry ? gradeEntry.point : null;
  const gradeLetter = gradeEntry ? gradeEntry.letter : (course.grade || null);

  // 0 CU courses get qualityPoint = 0, not null.
  // Non-zero CU courses get cu * gradePoint if both are resolved, else null.
  const qualityPoint = isZeroCU
    ? 0
    : (validCU && gradePoint !== null) ? cu * gradePoint : null;

  // Status reflects the actual grade result regardless of credit units.
  // A student can pass or fail a 0 CU compulsory course.
  const status = gradeEntry
    ? (gradeEntry.point === 0 ? "failed" : "passed")
    : "pending";

  return {
    ...course,
    grade: gradeLetter,
    gradePoint,
    qualityPoint,
    status,
    nonContributing: isZeroCU,
  };
}


// ── Semester Summary ──────────────────────────────────────────────────────────

/**
 * Returns a summary object for a single semester.
 *
 * totalCU      — graded courses only. Used as the GPA denominator.
 * totalQP      — quality points for graded courses only.
 * gpa          — semester GPA, or null if no graded courses.
 * registeredCU — all courses with valid CU > 0. Used for the display total.
 *
 * @param {Object} semester
 * @param {Array}  gradeTable
 * @returns {{ totalCU, totalQP, gpa, registeredCU }}
 */
export function computeSemesterSummary(semester, gradeTable) {
  if (!semester || !Array.isArray(semester.courses)) {
    return { totalCU: 0, totalQP: 0, gpa: null, registeredCU: 0 };
  }

  let totalCU      = 0; // graded courses only — GPA denominator
  let totalQP      = 0;
  let registeredCU = 0; // all courses with valid CU — display total

  for (const course of semester.courses) {
    const resolved = resolveCourse(course, gradeTable);
    const cu = parseFloat(resolved.creditUnits);
    if (isNaN(cu) || cu <= 0) continue;

    registeredCU += cu;                         // count regardless of grade

    if (resolved.gradePoint === null) continue; // skip ungraded for GPA only
    totalCU += cu;
    totalQP += resolved.qualityPoint;
  }

  const gpa = totalCU > 0 ? round4(totalQP / totalCU) : null;
  return { totalCU, totalQP, gpa, registeredCU };
}


// ── Carryover Impact ──────────────────────────────────────────────────────────

/**
 * Calculates the CGPA impact of retaking a failed course.
 *
 * @param {Object} failedCourse
 * @param {string} targetGrade
 * @param {number} currentTotalCU
 * @param {number} currentTotalQP
 * @param {Array}  gradeTable
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

  const gainedQP      = targetEntry.point * cu;
  const newTotalQP    = currentTotalQP + gainedQP;
  const projectedCGPA = round4(newTotalQP / currentTotalCU);
  const delta         = round4(projectedCGPA - (currentCGPA || 0));

  return {
    currentCGPA,
    projectedCGPA,
    delta,
    targetGradePoint:  targetEntry.point,
    targetGradeLetter: targetEntry.letter,
    creditUnits: cu,
  };
}


// ── What-if CGPA ──────────────────────────────────────────────────────────────

/**
 * Computes a hypothetical CGPA by substituting what-if grade letters
 * for specific courses. Used by the What-if Course Editor.
 * whatIfGrades shape: { courseId: gradeLetter }
 *
 * @param {Array}  semesters    - All semester data
 * @param {Array}  gradeTable   - Active institution grade table
 * @param {Object} whatIfGrades - Map of { courseId: gradeLetter } overrides
 * @returns {number|null}
 */
export function computeWhatIfCGPA(semesters, gradeTable, whatIfGrades) {
  if (!Array.isArray(semesters) || !whatIfGrades) return null;
  if (Object.keys(whatIfGrades).length === 0) return null;

  let totalCU = 0;
  let totalQP = 0;

  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;
    for (const course of semester.courses) {
      const cu = parseFloat(course.creditUnits);
      if (isNaN(cu) || cu <= 0) continue;

      let gp;

      if (course.id in whatIfGrades) {
        const letter = whatIfGrades[course.id];
        if (!letter) continue;
        gp = gradeLetterToPoint(letter, gradeTable);
        if (gp === null) continue;
      } else if (
        course.gradePoint !== null &&
        course.gradePoint !== undefined &&
        !isNaN(course.gradePoint)
      ) {
        gp = course.gradePoint;
      } else if (
        course.score !== null &&
        course.score !== undefined &&
        !isNaN(course.score)
      ) {
        const entry = scoreToGrade(course.score, gradeTable);
        gp = entry ? entry.point : null;
      } else if (course.grade) {
        gp = gradeLetterToPoint(course.grade, gradeTable);
      } else {
        continue;
      }

      if (gp === null || gp === undefined) continue;
      totalQP += cu * gp;
      totalCU += cu;
    }
  }

  if (totalCU === 0) return null;
  return round4(totalQP / totalCU);
}


// ── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Returns true if a score value is valid.
 * @param {*} value
 * @returns {boolean}
 */
export function isValidScore(value) {
  const n = parseFloat(value);
  return !isNaN(n) && n >= 0 && n <= 100;
}

/**
 * Returns true if the credit unit value is valid.
 * 0 is allowed for non-contributing courses.
 * @param {*} value
 * @returns {boolean}
 */
export function isValidCreditUnit(value) {
  const n = parseInt(value, 10);
  return !isNaN(n) && n >= 0 && n <= 6 && Number.isInteger(n);
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

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function formatGPA(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toFixed(2);
}