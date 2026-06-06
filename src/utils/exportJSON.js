// ── exportJSON.js ─────────────────────────────────────────────────────────────
// Handles full application state export and import as versioned JSON.
//
// Export produces a file the user can save, share, or reload later.
// Import reads the file back, migrates old schemas if needed, and returns
// a clean state object ready to load into useCGPA.
//
// Schema version: 2.0
// Older version (1.0) is automatically migrated on import.


import { getInstitutionById } from "../data/institutionRegistry.js";
import { computeCGPA, computeTotals, getClassification } from "./calculator.js";


// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Builds a complete JSON export object from the current application state.
 *
 * @param {Object} params
 * @param {Object|null}  params.institution
 * @param {Object}       params.student
 * @param {Array}        params.semesters
 * @param {number|null}  params.cgpa
 * @param {string|null}  params.degreeClass
 * @param {Object}       params.projection
 * @param {boolean}      params.useUILegacyScale
 *
 * @returns {Object} The complete export payload (not yet stringified)
 */
export function buildExportPayload({
  institution,
  student,
  semesters,
  cgpa,
  degreeClass,
  projection,
  useUILegacyScale = false,
}) {
  const now = new Date();

  const semestersExport = Array.isArray(semesters)
    ? semesters.map((sem) => exportSemester(sem, institution))
    : [];

  const totals = institution
    ? computeTotals(semesters || [], institution.gradeTable)
    : { totalCU: 0, totalQP: 0 };

  return {
    schema_version: "2.0",
    app: "NG CGPA",
    exported_at: now.toISOString(),
    exported_by: "Nonso [ELUSK]",

    institution: institution
      ? {
          id: institution.id,
          name: institution.name,
          shortName: institution.shortName,
          scale: institution.scale,
          scaleGroup: institution.scaleGroup,
          passmark: institution.passmark,
          // Embed grade table and classifications so custom schools round-trip correctly
          gradeTable: institution.gradeTable,
          classifications: institution.classifications,
          useUILegacyScale: useUILegacyScale,
        }
      : null,

    student: {
      name:             student?.name             || "",
      department:       student?.department       || "",
      faculty:          student?.faculty          || "",
      matric_number:    student?.matricNumber     || "",
      level:            student?.level            || "",
      academic_session: student?.academicSession  || "",
    },

    semesters: semestersExport,

    summary: {
      cgpa:                   cgpa ?? null,
      degreeClass:             degreeClass ?? null,
      totalSemesters:          semestersExport.length,
      totalCreditUnits:        totals.totalCU,
      totalQualityPoints:      round2(totals.totalQP),
    },

    projection: {
      targetCGPA:              projection?.targetCGPA              ?? null,
      remainingSemesters:      projection?.remainingSemesters      ?? null,
      estimatedCUPerSemester:  projection?.estimatedCUPerSemester  ?? null,
    },
  };
}


/**
 * Serialises the export payload to a JSON string and triggers a file download.
 *
 * @param {Object} payload    - Result of buildExportPayload
 * @param {string} institutionId
 */
export function downloadJSON(payload, institutionId) {
  const filename = buildJSONFilename(institutionId);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, filename);
}


/**
 * Convenience: build payload and download in one call.
 */
export function exportAndDownloadJSON(params) {
  const payload = buildExportPayload(params);
  downloadJSON(payload, params.institution?.id || "CUSTOM");
}


// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parses an imported JSON file (as text) and returns a clean application state.
 *
 * Steps:
 *  1. Parse the JSON.
 *  2. Read schema_version.
 *  3. If version is 1.0, run the migration function.
 *  4. Verify the institution ID against the registry.
 *     - Found: use registry data (keeps grade tables authoritative).
 *     - Not found: use the embedded grade table / custom school data.
 *  5. Return a state-ready object plus a human-readable summary.
 *
 * @param {string} jsonText - Raw file content
 * @returns {{ success: boolean, state?: Object, summary?: string, error?: string }}
 */
export function importFromJSON(jsonText) {
  let raw;

  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { success: false, error: "The file is not valid JSON." };
  }

  if (!raw || typeof raw !== "object") {
    return { success: false, error: "The file does not contain a valid NG CGPA export." };
  }

  // ── Schema migration ───────────────────────────────────────────────────────
  let data;
  const version = raw.schema_version || raw.schemaVersion || "1.0";

  if (version === "2.0") {
    data = raw;
  } else if (version === "1.0") {
    data = migrateV1toV2(raw);
  } else {
    return {
      success: false,
      error: `Unrecognised schema version "${version}". This file may be from a newer version of NG CGPA.`,
    };
  }

  // ── Institution resolution ─────────────────────────────────────────────────
  let institution = null;
  const useUILegacyScale = data.institution?.useUILegacyScale || false;

  if (data.institution?.id) {
    const fromRegistry = getInstitutionById(data.institution.id);

    if (fromRegistry) {
      // Use registry data as authoritative source for grading rules
      institution = fromRegistry;
    } else if (
      data.institution.gradeTable &&
      data.institution.classifications
    ) {
      // Custom school: reconstruct from embedded export data
      institution = {
        id:              data.institution.id || "CUSTOM",
        name:            data.institution.name || "Custom University",
        shortName:       data.institution.shortName || "CUSTOM",
        type:            "Custom",
        location:        "",
        website:         "",
        logoUrl:         null,
        scale:           data.institution.scale || 5.0,
        scaleGroup:      data.institution.scaleGroup || "CUSTOM",
        passmark:        data.institution.passmark || 40,
        gradeTable:      data.institution.gradeTable,
        classifications: data.institution.classifications,
        legacyScale:     null,
        notes:           "Loaded from exported file.",
        samePatternAs:   [],
        website_verified: false,
        last_updated:    "",
        status:          "active",
      };
    }
  }

  // ── Semesters ──────────────────────────────────────────────────────────────
  const semesters = Array.isArray(data.semesters)
    ? data.semesters.map(importSemester)
    : [];

  // ── Student ────────────────────────────────────────────────────────────────
  const student = {
    name:             data.student?.name             || "",
    department:       data.student?.department       || "",
    faculty:          data.student?.faculty          || "",
    matricNumber:     data.student?.matric_number    || "",
    level:            data.student?.level            || "",
    academicSession:  data.student?.academic_session || "",
  };

  // ── Projection ─────────────────────────────────────────────────────────────
  const projection = {
    targetCGPA:             data.projection?.targetCGPA             ?? null,
    remainingSemesters:     data.projection?.remainingSemesters     ?? null,
    estimatedCUPerSemester: data.projection?.estimatedCUPerSemester ?? null,
  };

  // ── Summary message ────────────────────────────────────────────────────────
  const totalCourses = semesters.reduce(
    (acc, s) => acc + (s.courses?.length || 0),
    0
  );
  const exportedAt = data.exported_at
    ? formatImportDate(data.exported_at)
    : "unknown date";

  const summary =
    `Loaded ${semesters.length} ${semesters.length === 1 ? "semester" : "semesters"}, ` +
    `${totalCourses} ${totalCourses === 1 ? "course" : "courses"}. ` +
    `Institution: ${institution?.name || "Unknown"}. ` +
    `CGPA: ${data.summary?.cgpa?.toFixed(2) ?? "—"}. ` +
    `Last export: ${exportedAt}.`;

  return {
    success: true,
    state: {
      institution,
      useUILegacyScale,
      student,
      semesters,
      projection,
    },
    summary,
  };
}


// ── Schema Migration ──────────────────────────────────────────────────────────

/**
 * Converts a v1.0 export structure to v2.0 shape.
 * Field names in v1 differed; this normalises them.
 *
 * @param {Object} v1
 * @returns {Object} v2-shaped object
 */
function migrateV1toV2(v1) {
  const semesters = Array.isArray(v1.semesters)
    ? v1.semesters.map((sem) => ({
        id:       sem.id || sem.semesterId || generateTempId(),
        label:    sem.label || sem.name || "Semester",
        courses:  Array.isArray(sem.courses)
          ? sem.courses.map((c) => ({
              id:           c.id || c.courseId || generateTempId(),
              name:         c.name || c.courseName || c.code || "",
              creditUnits:  c.creditUnits || c.units || c.cu || 0,
              score:        c.score ?? null,
              grade:        c.grade ?? null,
              gradePoint:   c.gradePoint ?? c.gp ?? null,
              qualityPoint: c.qualityPoint ?? c.qp ?? null,
              status:       c.status ?? "passed",
            }))
          : [],
      }))
    : [];

  return {
    schema_version: "2.0",
    app: "NG CGPA",
    exported_at: v1.exportedAt || v1.exported_at || new Date().toISOString(),
    exported_by: "Nonso [ELUSK]",
    institution: {
      id:              v1.institution?.id        || v1.schoolId    || null,
      name:            v1.institution?.name      || v1.schoolName  || "",
      shortName:       v1.institution?.shortName || "",
      scale:           v1.institution?.scale     || v1.scale       || 5.0,
      scaleGroup:      v1.institution?.scaleGroup || "NUC_5",
      passmark:        v1.institution?.passmark  || 40,
      gradeTable:      v1.institution?.gradeTable      || null,
      classifications: v1.institution?.classifications || null,
    },
    student: {
      name:             v1.student?.name             || "",
      department:       v1.student?.department       || "",
      faculty:          v1.student?.faculty          || "",
      matric_number:    v1.student?.matricNumber     || v1.student?.matric_number || "",
      level:            v1.student?.level            || "",
      academic_session: v1.student?.academicSession  || v1.student?.academic_session || "",
    },
    semesters,
    summary: {
      cgpa:             v1.cgpa             ?? null,
      degreeClass:      v1.degreeClass      ?? null,
      totalSemesters:   semesters.length,
      totalCreditUnits: v1.totalCreditUnits ?? 0,
      totalQualityPoints: v1.totalQualityPoints ?? 0,
    },
    projection: {
      targetCGPA:             v1.projection?.targetCGPA             ?? null,
      remainingSemesters:     v1.projection?.remainingSemesters     ?? null,
      estimatedCUPerSemester: v1.projection?.estimatedCUPerSemester ?? null,
    },
  };
}


// ── Semester Serialisation ────────────────────────────────────────────────────

function exportSemester(sem, institution) {
  const courses = Array.isArray(sem.courses)
    ? sem.courses.map((c) => exportCourse(c, institution))
    : [];

  const totalCU = courses.reduce((a, c) => a + (c.creditUnits || 0), 0);
  const totalQP = courses.reduce((a, c) => a + (c.qualityPoint || 0), 0);
  const gpa     = totalCU > 0 ? round4(totalQP / totalCU) : null;

  return {
    id:                sem.id,
    label:             sem.label || "Semester",
    courses,
    totalCreditUnits:  totalCU,
    totalQualityPoints: round2(totalQP),
    gpa:               gpa !== null ? round4(gpa) : null,
  };
}

function exportCourse(course, institution) {
  return {
    id:           course.id,
    name:         course.name || "",
    creditUnits:  course.creditUnits ?? 0,
    score:        course.score ?? null,
    grade:        course.grade ?? null,
    gradePoint:   course.gradePoint ?? null,
    qualityPoint: course.qualityPoint ?? null,
    status:       course.status || "passed",
  };
}

function importSemester(raw) {
  return {
    id:          raw.id || generateTempId(),
    label:       raw.label || "Semester",
    isCollapsed: false,
    courses:     Array.isArray(raw.courses)
      ? raw.courses.map(importCourse)
      : [],
  };
}

function importCourse(raw) {
  return {
    id:           raw.id || generateTempId(),
    name:         raw.name || "",
    creditUnits:  raw.creditUnits ?? "",
    score:        raw.score ?? null,
    grade:        raw.grade ?? null,
    gradePoint:   raw.gradePoint ?? null,
    qualityPoint: raw.qualityPoint ?? null,
    status:       raw.status || "passed",
  };
}


// ── Filename Builder ──────────────────────────────────────────────────────────

/**
 * Builds the export filename.
 * Format: NGCGPA_[institutionID]_[YYYYMMDD_HHMMSS].json
 */
function buildJSONFilename(institutionId) {
  const id = (institutionId || "EXPORT").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ts = buildTimestamp();
  return `NGCGPA_${id}_${ts}.json`;
}

function buildTimestamp() {
  const now = new Date();
  const Y  = now.getFullYear();
  const M  = String(now.getMonth() + 1).padStart(2, "0");
  const D  = String(now.getDate()).padStart(2, "0");
  const h  = String(now.getHours()).padStart(2, "0");
  const m  = String(now.getMinutes()).padStart(2, "0");
  const s  = String(now.getSeconds()).padStart(2, "0");
  return `${Y}${M}${D}_${h}${m}${s}`;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function formatImportDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

let tempCounter = 0;
function generateTempId() {
  return `import-${Date.now()}-${++tempCounter}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}