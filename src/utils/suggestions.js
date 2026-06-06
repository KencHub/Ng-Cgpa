// ── suggestions.js ────────────────────────────────────────────────────────────
// Rule-based suggestion engine. Called after every state change.
// Returns an array of suggestion objects — zero or more.
// Components render whatever this returns. No suggestion logic lives in components.
//
// Each suggestion:
// {
//   id:      string   — stable key for React, used to track dismissal
//   type:    "info" | "warning" | "danger" | "success"
//   message: string
// }


import { computeCGPA, computeTotals, scoreToGrade, gradeLetterToPoint } from "./calculator.js";


// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Computes all active suggestions for the current application state.
 *
 * @param {Object} params
 * @param {Object|null}  params.institution    - Active institution object
 * @param {Array}        params.semesters      - All semester objects
 * @param {number|null}  params.cgpa           - Current computed CGPA
 * @param {Array}        params.semesterGPAs   - Array of { semesterId, label, gpa } objects
 * @param {Set}          params.dismissed      - Set of dismissed suggestion IDs
 *
 * @returns {Array} Array of active, non-dismissed suggestion objects
 */
export function computeSuggestions({
  institution,
  semesters,
  cgpa,
  semesterGPAs,
  dismissed = new Set(),
}) {
  const suggestions = [];

  // Rule 9: No school selected but courses exist
  if (!institution) {
    const hasCourses = Array.isArray(semesters) &&
      semesters.some(
        (s) => Array.isArray(s.courses) && s.courses.length > 0
      );
    if (hasCourses) {
      suggestions.push({
        id: "no-school-selected",
        type: "danger",
        message:
          "No university selected. Calculations may be incorrect. Please select your institution before entering courses.",
      });
    }
    return filterDismissed(suggestions, dismissed);
  }

  const gradeTable = institution.gradeTable;
  const classifications = institution.classifications;
  const scaleMax = institution.scale;

  if (!Array.isArray(semesters) || semesters.length === 0) {
    return [];
  }

  const hasCourses = semesters.some(
    (s) => Array.isArray(s.courses) && s.courses.length > 0
  );
  if (!hasCourses) return [];

  // ── Rule 1: Any F grade in any semester ────────────────────────────────────
  const failedCourses = collectFailedCourses(semesters, gradeTable);
  for (const fc of failedCourses) {
    suggestions.push({
      id: `f-grade-${fc.semesterId}-${fc.courseId}`,
      type: "danger",
      message:
        `${fc.courseName} has an F grade. It contributes 0 quality points but ` +
        `still counts toward your total credit units, pulling your CGPA down. ` +
        `Retaking it is important.`,
    });
  }

  // ── Rule 2: High-credit course with low (non-F) grade ─────────────────────
  // 5.0 scale: D (2pts) or E (1pt)
  // 4.0 scale: D (1pt)
  const lowGradeThreshold = scaleMax >= 5 ? 2 : 1;
  const lowGradeCourses = collectLowGradeHighCreditCourses(
    semesters,
    gradeTable,
    lowGradeThreshold
  );
  for (const lc of lowGradeCourses) {
    suggestions.push({
      id: `low-grade-${lc.semesterId}-${lc.courseId}`,
      type: "warning",
      message:
        `${lc.courseName} carries ${lc.creditUnits} credit units and earned a ` +
        `${lc.gradeLetter} grade. High-credit courses have a larger impact on ` +
        `your CGPA than low-credit ones.`,
    });
  }

  // ── Rules 3–6: CGPA-level rules (only when CGPA is available) ─────────────
  if (cgpa !== null && cgpa !== undefined) {

    // Rule 3: CGPA below 1.50 — at risk of no degree
    if (cgpa < 1.50) {
      suggestions.push({
        id: "cgpa-at-risk",
        type: "danger",
        message:
          "Your current CGPA puts you at risk of not earning a degree. " +
          "Focus on passing every course before aiming for high grades.",
      });
    }

    // Rules 4–6: Boundary proximity rules derived from classification table
    const boundaryRules = buildBoundaryRules(classifications, cgpa, scaleMax);
    suggestions.push(...boundaryRules);
  }

  // ── Rules 7–8: Recent semester performance vs CGPA ────────────────────────
  if (
    cgpa !== null &&
    Array.isArray(semesterGPAs) &&
    semesterGPAs.length > 0
  ) {
    const mostRecent = semesterGPAs[semesterGPAs.length - 1];
    if (mostRecent && mostRecent.gpa !== null) {
      const diff = mostRecent.gpa - cgpa;

      // Rule 7: Most recent semester pulled average down
      if (diff < -0.80) {
        suggestions.push({
          id: `semester-drag-${mostRecent.semesterId}`,
          type: "warning",
          message:
            `Your most recent semester GPA (${mostRecent.gpa.toFixed(2)}) is ` +
            `significantly lower than your CGPA (${cgpa.toFixed(2)}). ` +
            `This semester is dragging your average down.`,
        });
      }

      // Rule 8: Most recent semester boosted the average
      if (diff > 0.80) {
        suggestions.push({
          id: `semester-boost-${mostRecent.semesterId}`,
          type: "success",
          message:
            `Your most recent semester (${mostRecent.gpa.toFixed(2)} GPA) was ` +
            `your strongest. This is the kind of performance that moves your ` +
            `CGPA meaningfully.`,
        });
      }
    }
  }

  return filterDismissed(suggestions, dismissed);
}


// ── Boundary Proximity Rules ──────────────────────────────────────────────────

/**
 * Builds contextual suggestions when a student is within 0.10 of a
 * classification boundary. Works across all scale groups by reading the
 * institution's classifications array directly.
 *
 * @param {Array}  classifications
 * @param {number} cgpa
 * @param {number} scaleMax
 * @returns {Array} Suggestion objects
 */
function buildBoundaryRules(classifications, cgpa, scaleMax) {
  if (!Array.isArray(classifications) || classifications.length === 0) return [];

  const suggestions = [];
  const PROXIMITY = 0.10;

  // Sort highest-first
  const sorted = [...classifications].sort((a, b) => b.min - a.min);

  for (const entry of sorted) {
    const boundary = entry.min;

    // Student is below this boundary but within 0.10 of it
    if (cgpa < boundary && cgpa >= boundary - PROXIMITY) {
      const gap = parseFloat((boundary - cgpa).toFixed(4));

      // Approaching First Class
      if (entry.label.toLowerCase().includes("first class")) {
        suggestions.push({
          id: `approaching-first-class`,
          type: "success",
          message:
            `You are ${gap.toFixed(2)} points below First Class. ` +
            `This is the most important range. A semester of mostly ` +
            `${scaleMax >= 5 ? "As" : "As"} is enough to get there.`,
        });
      }
      // Approaching 2:1
      else if (
        entry.label.toLowerCase().includes("upper") ||
        entry.short === "2:1"
      ) {
        suggestions.push({
          id: `approaching-upper-second`,
          type: "success",
          message:
            `You are ${gap.toFixed(2)} points below a Second Class Upper (2:1). ` +
            `One strong semester can cross that boundary.`,
        });
      }
      // Approaching 2:2 (student is in Third Class or lower, approaching 2:2)
      else if (
        entry.label.toLowerCase().includes("lower") ||
        entry.short === "2:2"
      ) {
        suggestions.push({
          id: `approaching-lower-second`,
          type: "info",
          message:
            `You are ${gap.toFixed(2)} points below a Second Class Lower (2:2). ` +
            `Consistent performance next semester can move you up.`,
        });
      }
    }

    // Student is in the lower range of this class — between min and min + 0.20
    if (
      cgpa >= boundary &&
      cgpa < boundary + 0.20 &&
      (entry.short === "2:2" || entry.label.toLowerCase().includes("lower"))
    ) {
      suggestions.push({
        id: `lower-second-consolidate`,
        type: "info",
        message:
          `You are in the lower range of a Second Class Lower. Consistent ` +
          `Bs next semester can consolidate your position or push you toward a 2:1.`,
      });
    }
  }

  return suggestions;
}


// ── Course Collectors ─────────────────────────────────────────────────────────

/**
 * Collects all courses with grade F across all semesters.
 * Returns enough data to build the suggestion message and a stable ID.
 */
function collectFailedCourses(semesters, gradeTable) {
  const failed = [];
  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;
    for (const course of semester.courses) {
      const gp = resolveGradePoint(course, gradeTable);
      if (gp === 0 && hasGradeData(course)) {
        failed.push({
          semesterId: semester.id,
          courseId: course.id,
          courseName: course.name || "Unnamed course",
          creditUnits: course.creditUnits,
        });
      }
    }
  }
  return failed;
}

/**
 * Collects courses where creditUnits >= 3 and gradePoint > 0 but <= threshold.
 * Excludes F grades (those are covered by Rule 1).
 */
function collectLowGradeHighCreditCourses(semesters, gradeTable, threshold) {
  const results = [];
  for (const semester of semesters) {
    if (!Array.isArray(semester.courses)) continue;
    for (const course of semester.courses) {
      const cu = parseInt(course.creditUnits, 10);
      if (isNaN(cu) || cu < 3) continue;
      const gp = resolveGradePoint(course, gradeTable);
      if (gp === null || gp === 0) continue; // exclude F and unresolved
      if (gp <= threshold) {
        const entry = gradeTable.find((g) => g.point === gp);
        results.push({
          semesterId: semester.id,
          courseId: course.id,
          courseName: course.name || "Unnamed course",
          creditUnits: cu,
          gradeLetter: entry ? entry.letter : "low",
          gradePoint: gp,
        });
      }
    }
  }
  return results;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveGradePoint(course, gradeTable) {
  if (course.gradePoint !== null && course.gradePoint !== undefined && !isNaN(course.gradePoint)) {
    return course.gradePoint;
  }
  if (course.score !== null && course.score !== undefined && !isNaN(course.score)) {
    const entry = scoreToGrade(course.score, gradeTable);
    return entry ? entry.point : null;
  }
  if (course.grade) {
    return gradeLetterToPoint(course.grade, gradeTable);
  }
  return null;
}

function hasGradeData(course) {
  return (
    (course.score !== null && course.score !== undefined && !isNaN(course.score)) ||
    (course.grade !== null && course.grade !== undefined && course.grade !== "") ||
    (course.gradePoint !== null && course.gradePoint !== undefined)
  );
}

function filterDismissed(suggestions, dismissed) {
  if (!dismissed || dismissed.size === 0) return suggestions;
  return suggestions.filter((s) => !dismissed.has(s.id));
}