// ── responseRenderer.js ───────────────────────────────────────────────────────
// Builds the context object passed to every knowledge base generateResponse().
//
// Takes the full useCGPA state (or the subset passed to useChat) and returns
// a flat context object with all values pre-computed and pre-formatted.
//
// Every field is either a string, number, boolean, or null.
// Knowledge base functions must handle null values gracefully — they always
// receive this context, even when the user has no data entered yet.
//
// No React. No side effects. Pure transformation.


/**
 * Build the full context object from the current application state.
 *
 * @param   {Object} state  Values from useCGPA (or the subset passed to useChat)
 * @returns {Object}        ctx — passed to every generateResponse(ctx) call
 */
export function buildContext(state) {
  const {
    institution           = null,
    student               = {},
    cgpa                  = null,
    degreeClass           = null,
    degreeClassShort      = null,
    degreeClassEntry      = null,
    totals                = { totalCU: 0, totalQP: 0 },
    semesterSummaries     = [],
    semesters             = [],
    activeClassifications = [],
    activeScale           = 5.0,
    activePassmark        = 40,
    projection            = {},
    projectionResult      = null,
  } = state;

  const hasData        = cgpa !== null && totals.totalCU > 0;
  const hasInstitution = institution !== null;
  const hasSemesters   = semesters.length > 0;

  // ── Sort classifications high → low ────────────────────────────────────────
  const sortedClasses = [...(activeClassifications || [])].sort(
    (a, b) => b.min - a.min
  );

  const firstClassEntry   = sortedClasses[0]   || null;
  const firstClassMinRaw  = firstClassEntry?.min ?? null;
  const currentClassEntry = degreeClassEntry    || null;

  // ── Next class above current CGPA ───────────────────────────────────────────
  let nextClassEntry = null;
  if (cgpa !== null) {
    for (const cls of sortedClasses) {
      if (cgpa < cls.min) {
        nextClassEntry = cls;
        break;
      }
    }
  }

  // ── Third class boundary ─────────────────────────────────────────────────────
  const thirdClassEntry = sortedClasses.find(
    c => c.label?.toLowerCase().includes("third")
  ) || null;

  // ── Deficit and cushion ──────────────────────────────────────────────────────
  const deficitRaw = nextClassEntry && cgpa !== null
    ? r2(nextClassEntry.min - cgpa) : null;

  const cushionRaw = currentClassEntry && cgpa !== null
    ? r2(cgpa - currentClassEntry.min) : null;

  // ── Semester analysis ────────────────────────────────────────────────────────
  const validSems = semesterSummaries.filter(s => s.gpa !== null);

  const bestSem  = validSems.length > 0
    ? validSems.reduce((b, s) => s.gpa > b.gpa ? s : b) : null;
  const worstSem = validSems.length > 0
    ? validSems.reduce((w, s) => s.gpa < w.gpa ? s : w) : null;

  let trend = "stable";
  if (validSems.length >= 2) {
    const last = validSems[validSems.length - 1].gpa;
    const prev = validSems[validSems.length - 2].gpa;
    if (last > prev + 0.10) trend = "improving";
    else if (last < prev - 0.10) trend = "declining";
  }

  // ── Failed courses ───────────────────────────────────────────────────────────
  const failedCourses = [];
  for (const sem of semesters) {
    for (const c of sem.courses || []) {
      if (c.status === "failed" || c.gradePoint === 0) {
        failedCourses.push({ ...c, semesterLabel: sem.label || "Unknown semester" });
      }
    }
  }

  // ── Projection assumptions ───────────────────────────────────────────────────
  const remSems     = projection?.remainingSemesters     || 4;
  const estCUPerSem = projection?.estimatedCUPerSemester || 18;
  const futureCU    = remSems * estCUPerSem;

  // Required GPA to reach first class
  let reqGPAFirstClass = null;
  if (firstClassMinRaw !== null && hasData && futureCU > 0) {
    const needed = firstClassMinRaw * (totals.totalCU + futureCU) - totals.totalQP;
    reqGPAFirstClass = r2(needed / futureCU);
  }

  // Required GPA to reach next class
  let reqGPANextClass = null;
  if (nextClassEntry && hasData && futureCU > 0) {
    const needed = nextClassEntry.min * (totals.totalCU + futureCU) - totals.totalQP;
    reqGPANextClass = r2(needed / futureCU);
  }

  // ── Return ───────────────────────────────────────────────────────────────────
  return {
    // Institution
    school:      institution?.name                         || null,
    schoolShort: institution?.shortName || institution?.id || null,
    scale:       activeScale,
    scaleGroup:  institution?.scaleGroup                   || null,
    passmark:    activePassmark,

    // Student profile
    studentName:     student?.name            || null,
    department:      student?.department      || null,
    faculty:         student?.faculty         || null,
    level:           student?.level           || null,
    matricNumber:    student?.matricNumber    || null,
    academicSession: student?.academicSession || null,

    // CGPA and totals
    cgpa:      cgpa !== null ? cgpa.toFixed(2) : null,
    cgpaRaw:   cgpa,
    degreeClass,
    degreeClassShort,
    totalCU:     totals.totalCU,
    totalQP:     Math.round(totals.totalQP * 100) / 100,
    semesterCount: semesters.length,
    courseCount:   semesters.reduce((n, s) => n + (s.courses?.length || 0), 0),

    // Classification boundaries
    firstClassMin:   firstClassMinRaw !== null ? firstClassMinRaw.toFixed(2) : null,
    isFirstClass:    cgpa !== null && firstClassMinRaw !== null && cgpa >= firstClassMinRaw,
    nextClassLabel:  nextClassEntry?.label                         || null,
    nextClassMin:    nextClassEntry ? nextClassEntry.min.toFixed(2) : null,
    currentClassMin: currentClassEntry ? currentClassEntry.min.toFixed(2) : null,
    thirdClassMin:   thirdClassEntry  ? thirdClassEntry.min.toFixed(2)  : null,
    deficit:  deficitRaw !== null ? deficitRaw.toFixed(2) : null,
    cushion:  cushionRaw !== null ? cushionRaw.toFixed(2) : null,

    // Semester performance
    validSemCount: validSems.length,
    bestSemLabel:  bestSem?.label            || null,
    bestSemGPA:    bestSem  ? bestSem.gpa.toFixed(2)  : null,
    worstSemLabel: worstSem?.label           || null,
    worstSemGPA:   worstSem ? worstSem.gpa.toFixed(2) : null,
    trend,

    // Failed courses
    failedCourses,
    failedCount: failedCourses.length,

    // Projection
    remSems,
    estCUPerSem,
    futureCU,
    requiredGPAForFirstClass: reqGPAFirstClass !== null ? reqGPAFirstClass.toFixed(2) : null,
    requiredGPAForNextClass:  reqGPANextClass  !== null ? reqGPANextClass.toFixed(2)  : null,
    projectionResult,

    // Flags
    hasData,
    hasInstitution,
    hasSemesters,
  };
}


// ── Internal ──────────────────────────────────────────────────────────────────

function r2(n) {
  return Math.round(n * 100) / 100;
}