// ── projection.js ─────────────────────────────────────────────────────────────
// CGPA projection and forward simulation engine.
// All projection arithmetic is isolated here. No component does raw calculation.


// ── Backward Projection (Target CGPA) ────────────────────────────────────────

/**
 * Given a target CGPA, calculates the GPA required per remaining semester.
 *
 * Formula:
 *   neededTotalQP       = targetCGPA * (currentTotalCU + remainingSemesters * estimatedCUPerSem)
 *   neededFutureQP      = neededTotalQP - currentTotalQP
 *   neededGPAPerSemester = neededFutureQP / (remainingSemesters * estimatedCUPerSem)
 *
 * Feasibility is assessed relative to the institution's scale maximum.
 *
 * @param {Object} params
 * @param {number} params.targetCGPA
 * @param {number} params.currentTotalCU       - Cumulative credit units earned so far
 * @param {number} params.currentTotalQP       - Cumulative quality points earned so far
 * @param {number} params.remainingSemesters
 * @param {number} params.estimatedCUPerSem    - Estimated credit units per future semester
 * @param {number} params.scaleMax             - Institution's maximum grade point (4.0 or 5.0)
 *
 * @returns {ProjectionResult}
 */
export function computeProjection({
  targetCGPA,
  currentTotalCU,
  currentTotalQP,
  remainingSemesters,
  estimatedCUPerSem,
  scaleMax,
}) {
  // ── Input validation ──────────────────────────────────────────────────────
  const errors = validateProjectionInputs({
    targetCGPA,
    currentTotalCU,
    currentTotalQP,
    remainingSemesters,
    estimatedCUPerSem,
    scaleMax,
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // ── Edge: No remaining semesters ──────────────────────────────────────────
  if (remainingSemesters === 0) {
    const currentCGPA =
      currentTotalCU > 0
        ? round4(currentTotalQP / currentTotalCU)
        : null;

    const met = currentCGPA !== null && currentCGPA >= targetCGPA;

    return {
      valid: true,
      errors: [],
      noSemestersRemaining: true,
      targetMet: met,
      currentCGPA,
      targetCGPA,
      requiredGPAPerSemester: null,
      feasibility: met ? "achieved" : "not_achievable",
      feasibilityLabel: met
        ? "Target already achieved"
        : `No remaining semesters. Current CGPA is ${formatVal(currentCGPA)}. Target was ${formatVal(targetCGPA)}.`,
      maxReachableCGPA: currentCGPA,
    };
  }

  // ── Core calculation ──────────────────────────────────────────────────────
  const futureCU = remainingSemesters * estimatedCUPerSem;
  const totalFutureCU = currentTotalCU + futureCU;

  const neededTotalQP = targetCGPA * totalFutureCU;
  const neededFutureQP = neededTotalQP - currentTotalQP;
  const neededGPAPerSemester = neededFutureQP / futureCU;

  // ── Maximum reachable CGPA (if student earns scaleMax every future semester) ──
  const maxReachableQP = currentTotalQP + scaleMax * futureCU;
  const maxReachableCGPA = round4(maxReachableQP / totalFutureCU);

  // ── Feasibility ───────────────────────────────────────────────────────────
  const { feasibility, feasibilityLabel } = assessFeasibility(
    neededGPAPerSemester,
    scaleMax,
    maxReachableCGPA,
    targetCGPA
  );

  return {
    valid: true,
    errors: [],
    noSemestersRemaining: false,
    targetMet: false,
    currentCGPA: currentTotalCU > 0
      ? round4(currentTotalQP / currentTotalCU)
      : null,
    targetCGPA: round4(targetCGPA),
    futureCU,
    totalFutureCU,
    neededTotalQP: round4(neededTotalQP),
    neededFutureQP: round4(neededFutureQP),
    requiredGPAPerSemester: round4(neededGPAPerSemester),
    maxReachableCGPA,
    feasibility,
    feasibilityLabel,
  };
}


// ── Forward Simulation ────────────────────────────────────────────────────────

/**
 * Simulates the projected CGPA after one additional semester.
 *
 * Formula:
 *   projectedCGPA = (currentTotalQP + nextGPA * nextCU) / (currentTotalCU + nextCU)
 *
 * @param {Object} params
 * @param {number} params.currentTotalCU
 * @param {number} params.currentTotalQP
 * @param {number} params.nextSemGPA       - GPA the student expects in the next semester
 * @param {number} params.nextSemCU        - Credit units planned for the next semester
 * @param {Array}  params.classifications  - Institution's classifications array
 *
 * @returns {ForwardSimResult}
 */
export function computeForwardSimulation({
  currentTotalCU,
  currentTotalQP,
  nextSemGPA,
  nextSemCU,
  classifications,
}) {
  if (
    isNaN(nextSemGPA) || nextSemGPA === null ||
    isNaN(nextSemCU) || nextSemCU <= 0 ||
    isNaN(currentTotalCU)
  ) {
    return { valid: false, projectedCGPA: null, projectedClass: null };
  }

  const newQP = currentTotalQP + nextSemGPA * nextSemCU;
  const newCU = currentTotalCU + nextSemCU;
  const projectedCGPA = round4(newQP / newCU);

  let projectedClass = null;
  if (Array.isArray(classifications)) {
    const sorted = [...classifications].sort((a, b) => b.min - a.min);
    for (const entry of sorted) {
      if (projectedCGPA >= entry.min) {
        projectedClass = entry;
        break;
      }
    }
  }

  const delta = round4(
    projectedCGPA - (currentTotalCU > 0 ? round4(currentTotalQP / currentTotalCU) : 0)
  );

  return {
    valid: true,
    projectedCGPA,
    projectedClass,
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}


// ── Max Reachable CGPA ────────────────────────────────────────────────────────

/**
 * Computes the maximum CGPA theoretically reachable given remaining semesters,
 * assuming the student earns the scale maximum in every future semester.
 */
export function computeMaxReachableCGPA(
  currentTotalCU,
  currentTotalQP,
  remainingSemesters,
  estimatedCUPerSem,
  scaleMax
) {
  if (
    isNaN(currentTotalCU) || isNaN(currentTotalQP) ||
    isNaN(remainingSemesters) || remainingSemesters < 0 ||
    isNaN(estimatedCUPerSem) || estimatedCUPerSem <= 0 ||
    isNaN(scaleMax) || scaleMax <= 0
  ) {
    return null;
  }

  if (remainingSemesters === 0) {
    return currentTotalCU > 0 ? round4(currentTotalQP / currentTotalCU) : null;
  }

  const futureCU = remainingSemesters * estimatedCUPerSem;
  const maxQP = currentTotalQP + scaleMax * futureCU;
  const totalCU = currentTotalCU + futureCU;
  return round4(maxQP / totalCU);
}


// ── Grade Mix Suggestions ─────────────────────────────────────────────────────

/**
 * Given a required GPA per semester, returns the approximate grade distribution
 * a student needs to achieve it. Returns up to 2 suggestions.
 *
 * Primary suggestion: the two adjacent grade tiers that bracket the required GPA.
 * Alternative:        a mix using the grade one tier above primary (fewer
 *                     mid-tier grades, more top-tier grades needed).
 *
 * Suggestion shape:
 *   { type: 'single', hi: GradeEntry, nCourses: number|null }
 *   { type: 'split',  hi, lo, hiPct, loPct, hiCount, loCount, nCourses }
 *
 * @param {number} requiredGPA
 * @param {Array}  gradeTable         - institution grade table (GradeEntry[])
 * @param {number} [estimatedCUPerSem] - used to convert % into approximate course counts
 * @returns {Array}
 */
export function computeGradeMixSuggestions(requiredGPA, gradeTable, estimatedCUPerSem) {
  if (
    !Array.isArray(gradeTable) ||
    gradeTable.length === 0 ||
    requiredGPA == null ||
    isNaN(requiredGPA)
  ) return [];

  const rGPA = Math.round(requiredGPA * 100) / 100;

  // Passing grades only, sorted high to low
  const grades = [...gradeTable]
    .filter(g => typeof g.point === "number" && g.point > 0)
    .sort((a, b) => b.point - a.point);

  if (grades.length === 0) return [];

  // Approximate number of courses per semester — assumes 3 CU average per course
  const nCourses =
    estimatedCUPerSem > 0
      ? Math.max(2, Math.round(estimatedCUPerSem / 3))
      : null;

  // Build one split suggestion from a hi-lo grade pair
  function makeSplit(hi, lo) {
    if (hi.point === lo.point) return null;
    const hiRatio = (rGPA - lo.point) / (hi.point - lo.point);
    if (hiRatio < 0 || hiRatio > 1) return null;

    const hiPct = Math.round(hiRatio * 100);
    const loPct = 100 - hiPct;

    // Collapses to a single grade when ratio is exactly 0 or 1
    if (hiPct === 100) return { type: "single", hi, nCourses };
    if (hiPct === 0)   return { type: "single", hi: lo, nCourses };

    const hiCount = nCourses ? Math.max(1, Math.round(nCourses * hiRatio)) : null;
    const loCount = nCourses && hiCount !== null ? Math.max(0, nCourses - hiCount) : null;

    return { type: "split", hi, lo, hiPct, loPct, hiCount, loCount, nCourses };
  }

  // Edge: required GPA at or above the highest passing grade
  if (rGPA >= grades[0].point) {
    return [{ type: "single", hi: grades[0], nCourses }];
  }

  // Edge: required GPA at or below the lowest passing grade
  if (rGPA <= grades[grades.length - 1].point) {
    return [{ type: "single", hi: grades[grades.length - 1], nCourses }];
  }

  const suggestions = [];

  // Find the adjacent pair that brackets the required GPA
  for (let i = 0; i < grades.length - 1; i++) {
    const hi = grades[i];
    const lo = grades[i + 1];

    if (lo.point > rGPA) continue; // pair is entirely above required
    if (hi.point < rGPA) break;   // all remaining pairs are below required

    const primary = makeSplit(hi, lo);
    if (primary) suggestions.push(primary);

    // Alternative: replace hi with one tier higher (requires more top-grade effort)
    if (primary && primary.type === "split" && i > 0) {
      const altHi = grades[i - 1];
      const alt   = makeSplit(altHi, lo);
      if (alt && alt.type === "split") suggestions.push(alt);
    }

    break;
  }

  return suggestions.slice(0, 2);
}


// ── Feasibility Assessment ────────────────────────────────────────────────────

function assessFeasibility(requiredGPA, scaleMax, maxReachableCGPA, targetCGPA) {
  if (requiredGPA > scaleMax || maxReachableCGPA < targetCGPA) {
    return {
      feasibility: "not_achievable",
      feasibilityLabel: `Not achievable. Maximum reachable CGPA is ${formatVal(maxReachableCGPA)}.`,
    };
  }

  if (requiredGPA > scaleMax * 0.90) {
    return {
      feasibility: "very_challenging",
      feasibilityLabel: "Very challenging. Requires near-perfect performance every semester.",
    };
  }

  if (requiredGPA > scaleMax * 0.75) {
    return {
      feasibility: "challenging",
      feasibilityLabel: "Challenging but achievable with consistent strong performance.",
    };
  }

  return {
    feasibility: "achievable",
    feasibilityLabel: "Achievable with steady performance.",
  };
}


// ── Input Validation ──────────────────────────────────────────────────────────

function validateProjectionInputs({
  targetCGPA,
  currentTotalCU,
  currentTotalQP,
  remainingSemesters,
  estimatedCUPerSem,
  scaleMax,
}) {
  const errors = [];

  if (isNaN(targetCGPA) || targetCGPA === null) {
    errors.push("Target CGPA is required.");
  } else if (targetCGPA <= 0) {
    errors.push("Target CGPA must be greater than 0.");
  } else if (targetCGPA > scaleMax) {
    errors.push(
      `Target CGPA cannot exceed the maximum scale of ${formatVal(scaleMax)}.`
    );
  }

  if (isNaN(remainingSemesters) || remainingSemesters === null || remainingSemesters < 0) {
    errors.push("Remaining semesters must be 0 or more.");
  }

  if (remainingSemesters > 0) {
    if (isNaN(estimatedCUPerSem) || estimatedCUPerSem <= 0) {
      errors.push("Estimated credit units per semester must be greater than 0.");
    }
  }

  if (isNaN(currentTotalCU) || currentTotalCU < 0) {
    errors.push("Current total credit units are invalid.");
  }

  if (isNaN(currentTotalQP) || currentTotalQP < 0) {
    errors.push("Current total quality points are invalid.");
  }

  return errors;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function formatVal(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toFixed(2);
}