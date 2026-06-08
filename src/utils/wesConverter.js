// ── wesConverter.js ───────────────────────────────────────────────────────────
// WES (World Education Services) international scale conversion utility.
//
// Two exports:
//   convertToWES         — Classification-based conversion (whole transcript)
//   convertCoursesToWES  — Per-course breakdown (individual grade mapping)
//
// METHODOLOGY:
//   Classification-based: WES maps by degree class band, not a raw formula.
//   Course-by-course: each Nigerian grade point value maps to a WES Canadian
//   grade and US 4.0 GPA equivalent, sourced from WES's Nigeria conversion guide.
//   Weighted WES GPA = sum(wesGPA × creditUnits) / sum(creditUnits) — the same
//   weighted formula used for CGPA, applied to WES GPA values.
//
// Lookup is by gradePoint (number), not letter grade. gradePoint is always
// present in state regardless of whether the student entered a score or a
// grade letter directly.
//
// Both functions are pure and read-only. They never mutate state.
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_GROUPS = ["NUC_5", "FOUR_POINT", "SEVEN_POINT"];

const SCALE_LABELS = {
  NUC_5:       "NUC 5.0 Standard Scale",
  FOUR_POINT:  "4.0 Scale",
  SEVEN_POINT: "University of Ibadan Legacy 7.0 Scale (pre-2016/2017)",
};

// ── Classification-based WES tables ──────────────────────────────────────────
//
// Maps entire degree classification bands to WES equivalents.
// Used by convertToWES (the "International Equivalent" view).

const WES_TABLES = {

  NUC_5: [
    {
      classKeys:     ["first"],
      nigerianRange: "4.50 – 5.00",
      nigerianClass: "First Class Honours",
      canadianGrade: "A",
      usGPA:         "4.0",
      usGPANum:      4.0,
      admissionNote:
        "Meets or exceeds the minimum GPA requirement for most graduate programs " +
        "in Canada and the United States. Competitive for research-focused and " +
        "funded programs.",
    },
    {
      classKeys:     ["upper", "2:1"],
      nigerianRange: "3.50 – 4.49",
      nigerianClass: "Second Class Honours Upper (2:1)",
      canadianGrade: "B+",
      usGPA:         "3.5",
      usGPANum:      3.5,
      admissionNote:
        "Meets the minimum GPA requirement for most graduate programs in Canada " +
        "and the United States. Many competitive programs list 3.0 as the floor, " +
        "so a 2:1 positions you well above the threshold.",
    },
    {
      classKeys:     ["lower", "2:2"],
      nigerianRange: "2.40 – 3.49",
      nigerianClass: "Second Class Honours Lower (2:2)",
      canadianGrade: "B",
      usGPA:         "3.0",
      usGPANum:      3.0,
      admissionNote:
        "Meets the minimum GPA floor for many graduate programs. Some competitive " +
        "or research-intensive programs may set their cutoff higher. A strong " +
        "statement of purpose and references can help offset the GPA.",
    },
    {
      classKeys:     ["third"],
      nigerianRange: "1.50 – 2.39",
      nigerianClass: "Third Class Honours",
      canadianGrade: "C",
      usGPA:         "2.0",
      usGPANum:      2.0,
      admissionNote:
        "Below the minimum GPA threshold for most graduate programs. A postgraduate " +
        "diploma or bridging program with strong results is typically required before " +
        "a direct master's application.",
    },
    {
      classKeys:     ["pass"],
      nigerianRange: "1.00 – 1.49",
      nigerianClass: "Pass",
      canadianGrade: "D",
      usGPA:         "1.0",
      usGPANum:      1.0,
      admissionNote:
        "Generally does not meet graduate admission requirements. Additional " +
        "qualifications such as a postgraduate diploma would be needed before a " +
        "graduate application is realistic.",
    },
  ],

  FOUR_POINT: [
    {
      classKeys:     ["first"],
      nigerianRange: "3.50 – 4.00",
      nigerianClass: "First Class Honours",
      canadianGrade: "A",
      usGPA:         "4.0",
      usGPANum:      4.0,
      admissionNote:
        "Meets or exceeds the minimum GPA requirement for most graduate programs " +
        "in Canada and the United States. Competitive for research-focused and " +
        "funded programs.",
    },
    {
      classKeys:     ["upper", "2:1"],
      nigerianRange: "3.00 – 3.49",
      nigerianClass: "Second Class Honours Upper (2:1)",
      canadianGrade: "B+",
      usGPA:         "3.5",
      usGPANum:      3.5,
      admissionNote:
        "Meets the minimum GPA requirement for most graduate programs in Canada " +
        "and the United States. Positions you well above the typical 3.0 cutoff.",
    },
    {
      classKeys:     ["lower", "2:2"],
      nigerianRange: "2.00 – 2.99",
      nigerianClass: "Second Class Honours Lower (2:2)",
      canadianGrade: "B",
      usGPA:         "3.0",
      usGPANum:      3.0,
      admissionNote:
        "Meets the minimum GPA floor for many graduate programs. Competitive or " +
        "research-intensive programs may set their cutoff higher.",
    },
    {
      classKeys:     ["third"],
      nigerianRange: "1.00 – 1.99",
      nigerianClass: "Third Class Honours",
      canadianGrade: "C",
      usGPA:         "2.0",
      usGPANum:      2.0,
      admissionNote:
        "Below the minimum GPA threshold for most graduate programs. A postgraduate " +
        "diploma or bridging program is typically required before a direct master's " +
        "application.",
    },
  ],

  SEVEN_POINT: [
    {
      classKeys:     ["first"],
      nigerianRange: "5.00 – 7.00",
      nigerianClass: "First Class Honours",
      canadianGrade: "A",
      usGPA:         "4.0",
      usGPANum:      4.0,
      admissionNote:
        "Meets or exceeds the minimum GPA requirement for most graduate programs " +
        "in Canada and the United States.",
    },
    {
      classKeys:     ["upper", "2:1"],
      nigerianRange: "3.50 – 4.99",
      nigerianClass: "Second Class Honours Upper (2:1)",
      canadianGrade: "B+",
      usGPA:         "3.5",
      usGPANum:      3.5,
      admissionNote:
        "Meets the minimum GPA requirement for most graduate programs in Canada " +
        "and the United States.",
    },
    {
      classKeys:     ["lower", "2:2"],
      nigerianRange: "2.40 – 3.49",
      nigerianClass: "Second Class Honours Lower (2:2)",
      canadianGrade: "B",
      usGPA:         "3.0",
      usGPANum:      3.0,
      admissionNote:
        "Meets the minimum GPA floor for many graduate programs. Competitive " +
        "programs may set their cutoff higher.",
    },
    {
      classKeys:     ["third"],
      nigerianRange: "1.50 – 2.39",
      nigerianClass: "Third Class Honours",
      canadianGrade: "C",
      usGPA:         "2.0",
      usGPANum:      2.0,
      admissionNote:
        "Below the minimum GPA threshold for most graduate programs. Additional " +
        "qualification is typically required before a direct master's application.",
    },
    {
      classKeys:     ["pass"],
      nigerianRange: "1.00 – 1.49",
      nigerianClass: "Pass",
      canadianGrade: "D",
      usGPA:         "1.0",
      usGPANum:      1.0,
      admissionNote:
        "Generally does not meet graduate admission requirements without significant " +
        "additional qualification.",
    },
  ],
};

// ── Course-by-course grade maps ───────────────────────────────────────────────
//
// Maps each Nigerian grade point value to a WES Canadian grade + US GPA.
// Keyed by scaleGroup. Lookup is by gradePoint (number), which is always
// present in state regardless of how the grade was entered.
//
// NUC 5.0 source:  WES Nigeria guide — A→A, B→B+, C→B, D→C+, E→C, F→F
// 4.0 source:      WES Nigeria guide — A→A, B→B+, C→B, D→C, F→F
// 7.0 source:      WES legacy UI mapping — A-H grades to full Canadian scale

const COURSE_GRADE_MAPS = {

  NUC_5: [
    { gradePoint: 5, letter: "A", canadianGrade: "A",  usGPA: 4.0 },
    { gradePoint: 4, letter: "B", canadianGrade: "B+", usGPA: 3.5 },
    { gradePoint: 3, letter: "C", canadianGrade: "B",  usGPA: 3.0 },
    { gradePoint: 2, letter: "D", canadianGrade: "C+", usGPA: 2.5 },
    { gradePoint: 1, letter: "E", canadianGrade: "C",  usGPA: 2.0 },
    { gradePoint: 0, letter: "F", canadianGrade: "F",  usGPA: 0.0 },
  ],

  FOUR_POINT: [
    { gradePoint: 4, letter: "A", canadianGrade: "A",  usGPA: 4.0 },
    { gradePoint: 3, letter: "B", canadianGrade: "B+", usGPA: 3.5 },
    { gradePoint: 2, letter: "C", canadianGrade: "B",  usGPA: 3.0 },
    { gradePoint: 1, letter: "D", canadianGrade: "C",  usGPA: 2.0 },
    { gradePoint: 0, letter: "F", canadianGrade: "F",  usGPA: 0.0 },
  ],

  // UI legacy 7.0 — 8 grade letters, full Canadian scale coverage
  SEVEN_POINT: [
    { gradePoint: 7, letter: "A", canadianGrade: "A",  usGPA: 4.0 },
    { gradePoint: 6, letter: "B", canadianGrade: "B+", usGPA: 3.5 },
    { gradePoint: 5, letter: "C", canadianGrade: "B",  usGPA: 3.0 },
    { gradePoint: 4, letter: "D", canadianGrade: "B-", usGPA: 2.7 },
    { gradePoint: 3, letter: "E", canadianGrade: "C+", usGPA: 2.3 },
    { gradePoint: 2, letter: "F", canadianGrade: "C",  usGPA: 2.0 },
    { gradePoint: 1, letter: "G", canadianGrade: "D",  usGPA: 1.0 },
    { gradePoint: 0, letter: "H", canadianGrade: "F",  usGPA: 0.0 },
  ],
};


// ── checkWESReadiness — data sufficiency gate ─────────────────────────────────
//
// Determines whether the student has entered enough data for the WES
// conversion to be meaningful. The trigger button is hidden until the
// threshold is met.
//
// Gate: 15 graded credit units minimum.
// 15 CU ≈ one full Nigerian semester. Below this the CGPA is based on too
// few courses to represent the student's academic standing, and showing a
// conversion would be misleading.
//
// Returns:
//   { visible: false, completedSemesters, totalGradedCU, message }
//   { visible: true,  completedSemesters, totalGradedCU, message: null }

export function checkWESReadiness(semesters) {
  if (!semesters || semesters.length === 0) {
    return {
      visible:            false,
      completedSemesters: 0,
      totalGradedCU:      0,
      message:
        "Enter your courses and grades first to unlock international conversion.",
    };
  }

  let completedSemesters = 0;
  let totalGradedCU      = 0;

  for (const sem of semesters) {
    if (!sem.courses || sem.courses.length === 0) continue;

    const gradedCourses = sem.courses.filter(
      (c) => c.grade !== null && c.grade !== undefined
    );

    if (gradedCourses.length === 0) continue;

    completedSemesters++;
    for (const course of gradedCourses) {
      totalGradedCU += course.creditUnits || 0;
    }
  }

  if (totalGradedCU < 15) {
    const remaining = 15 - totalGradedCU;
    return {
      visible:            false,
      completedSemesters,
      totalGradedCU,
      message:
        remaining === 1
          ? "Add 1 more credit unit of graded courses to unlock international conversion."
          : `Add ${remaining} more credit units of graded courses to unlock international conversion.`,
    };
  }

  return {
    visible:            true,
    completedSemesters,
    totalGradedCU,
    message: null,
  };
}



// ── convertToWES — classification-based ──────────────────────────────────────

/**
 * @param {object}  params
 * @param {number}  params.cgpa
 * @param {object}  params.degreeClassEntry  - From getClassification()
 * @param {object}  params.institution       - Full institution object
 * @param {boolean} params.useUILegacyScale
 * @param {number}  params.semesterCount
 * @returns {object}
 */
export function convertToWES({
  cgpa,
  degreeClassEntry,
  institution,
  useUILegacyScale = false,
  semesterCount = 0,
}) {

  if (!institution || !SUPPORTED_GROUPS.includes(institution.scaleGroup)) {
    return {
      supported: false,
      reason:
        "WES conversion is not available for custom universities or unrecognised " +
        "grading scales. Select one of the supported Nigerian institutions from " +
        "the institution list to use this feature.",
    };
  }

  if (cgpa === null || cgpa === undefined) {
    return {
      supported: false,
      reason:
        "Add your courses and grades first to generate a CGPA before running " +
        "the international conversion.",
    };
  }

  if (!degreeClassEntry) {
    return {
      supported: false,
      reason:
        "Your CGPA could not be matched to a recognised degree classification. " +
        "Check that your course entries are complete and your institution is correctly selected.",
    };
  }

  const shortLower = (
    degreeClassEntry.short || degreeClassEntry.label || ""
  ).toLowerCase();

  const isNoDegree =
    shortLower.includes("no degree") ||
    shortLower.includes("fail")      ||
    shortLower.includes("no award");

  if (isNoDegree) {
    return {
      supported: false,
      reason:
        "A CGPA in the 'No Degree Awarded' range cannot be converted. WES " +
        "evaluations require a completed, conferred degree. Improve your CGPA " +
        "above the minimum threshold before attempting a conversion.",
    };
  }

  const resolvedGroup = useUILegacyScale ? "SEVEN_POINT" : institution.scaleGroup;
  const table         = WES_TABLES[resolvedGroup];

  const entry = table.find((row) =>
    row.classKeys.some((key) => shortLower.includes(key.toLowerCase()))
  );

  if (!entry) {
    return {
      supported: false,
      reason:
        "Your degree classification could not be matched to a WES conversion row. " +
        "This may be a data issue. Try re-selecting your institution.",
    };
  }

  let warning = null;
  if (semesterCount === 1) {
    warning =
      "You have data for only 1 semester. This conversion is a very early estimate. " +
      "Results become more reliable after 4 or more semesters of data.";
  } else if (semesterCount <= 3) {
    warning =
      `You have ${semesterCount} semesters of data. The estimate will grow more ` +
      "accurate as you enter more results across your full programme.";
  }

  return {
    supported:     true,
    warning,
    scaleGroup:    resolvedGroup,
    scaleLabel:    SCALE_LABELS[resolvedGroup],
    entry,
    degreeClass:   entry.nigerianClass,
    nigerianRange: entry.nigerianRange,
    canadianGrade: entry.canadianGrade,
    usGPA:         entry.usGPA,
    usGPANum:      entry.usGPANum,
    admissionNote: entry.admissionNote,
  };
}

// ── convertCoursesToWES — course-by-course ────────────────────────────────────

/**
 * Maps every graded course to its WES Canadian grade and US GPA equivalent.
 * Computes a weighted WES GPA: sum(wesGPA × creditUnits) / sum(creditUnits).
 *
 * Only courses with a non-null grade field are included. Ungraded courses
 * (grade is null) are silently skipped — they have no meaningful WES value.
 *
 * @param {object}  params
 * @param {Array}   params.semesters         - Full semesters array from state
 * @param {object}  params.institution       - Full institution object
 * @param {boolean} params.useUILegacyScale
 * @returns {object}
 */
export function convertCoursesToWES({
  semesters,
  institution,
  useUILegacyScale = false,
}) {

  if (!institution || !SUPPORTED_GROUPS.includes(institution.scaleGroup)) {
    return {
      supported: false,
      reason:
        "Course-by-course conversion is not available for custom universities. " +
        "Select a supported Nigerian institution to use this feature.",
    };
  }

  if (!semesters || semesters.length === 0) {
    return {
      supported: false,
      reason:
        "No semesters found. Add your courses and grades first to see the " +
        "course-by-course breakdown.",
    };
  }

  const resolvedGroup = useUILegacyScale ? "SEVEN_POINT" : institution.scaleGroup;
  const gradeMap      = COURSE_GRADE_MAPS[resolvedGroup];

  const processedSemesters = [];
  let totalGradedCourses   = 0;
  let failCount            = 0;
  let totalWesQP           = 0;   // sum(wesGPANum × creditUnits)
  let totalCU              = 0;   // sum of creditUnits for graded courses only

  for (const sem of semesters) {
    if (!sem.courses || sem.courses.length === 0) continue;

    const processedCourses = [];

    for (const course of sem.courses) {

      // Skip courses that have not been graded yet
      if (!course.grade) continue;

      totalGradedCourses++;

      // Look up WES equivalent by gradePoint value
      const mapping = gradeMap.find((m) => m.gradePoint === course.gradePoint);

      const wesGrade = mapping ? mapping.canadianGrade : "—";
      const wesGPA   = mapping ? mapping.usGPA         : null;
      const isFail   = course.gradePoint === 0;

      if (isFail) failCount++;

      // Accumulate weighted totals — only when both values are valid
      if (wesGPA !== null && course.creditUnits > 0) {
        totalWesQP += wesGPA * course.creditUnits;
        totalCU    += course.creditUnits;
      }

      processedCourses.push({
        id:          course.id,
        name:        course.name,
        creditUnits: course.creditUnits,
        grade:       course.grade,      // Nigerian letter grade: A, B, C, D, E, F
        gradePoint:  course.gradePoint,
        wesGrade,
        wesGPA,
        isFail,
      });
    }

    // Only include semesters that have at least one graded course
    if (processedCourses.length > 0) {
      processedSemesters.push({
        id:      sem.id,
        label:   sem.label,
        courses: processedCourses,
      });
    }
  }

  if (processedSemesters.length === 0) {
    return {
      supported: false,
      reason:
        "No graded courses found. Enter your course grades first to see the " +
        "course-by-course international breakdown.",
    };
  }

  // Weighted WES GPA — same formula as CGPA, applied to WES GPA values
  const weightedWesGPA = totalCU > 0
    ? Math.round((totalWesQP / totalCU) * 100) / 100
    : null;

  return {
    supported:  true,
    scaleGroup: resolvedGroup,
    scaleLabel: SCALE_LABELS[resolvedGroup],
    semesters:  processedSemesters,
    totals: {
      gradedCourses: totalGradedCourses,
      semesterCount: processedSemesters.length,
      failCount,
      weightedWesGPA,
      totalCU,
    },
  };
}