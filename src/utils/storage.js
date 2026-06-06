// ── storage.js ────────────────────────────────────────────────────────────────
// localStorage persistence layer for NG CGPA.
//
// All reads and writes go through this module.
// No component or hook accesses localStorage directly.
//
// Storage keys:
//   ngcgpa_state            — full application state
//   ngcgpa_dismissed        — set of dismissed suggestion IDs
//   ngcgpa_custom_school    — user-defined custom institution data
//   ngcgpa_schema_version   — schema version string for migration checks
//
// Design rules:
//   1. Every read is wrapped in try/catch. A corrupt or missing value
//      returns null. The app falls back to default state silently.
//   2. Every write is wrapped in try/catch. If localStorage is full
//      or unavailable (private browsing on some browsers), the write
//      fails silently and the app continues working in-memory.
//   3. Institution data is stored by ID only. The full object is
//      resolved from the registry at load time, keeping storage lean
//      and ensuring grade tables stay authoritative.


const SCHEMA_VERSION  = "2.0";
const KEY_STATE       = "ngcgpa_state";
const KEY_DISMISSED   = "ngcgpa_dismissed";
const KEY_CUSTOM      = "ngcgpa_custom_school";
const KEY_VERSION     = "ngcgpa_schema_version";


// ── Availability Check ────────────────────────────────────────────────────────

/**
 * Returns true if localStorage is available and writable.
 * Some private browsing modes block writes entirely.
 */
export function isStorageAvailable() {
  try {
    const test = "__ngcgpa_test__";
    localStorage.setItem(test, "1");
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}


// ── Save State ────────────────────────────────────────────────────────────────

/**
 * Persists the full application state to localStorage.
 *
 * Only the institution ID is stored, not the full registry object.
 * Custom schools embed their gradeTable and classifications directly.
 *
 * @param {Object} params
 * @param {Object|null}  params.institution
 * @param {boolean}      params.useUILegacyScale
 * @param {Object}       params.student
 * @param {Array}        params.semesters
 * @param {Object}       params.projection
 * @param {string|null}  params.activeTab
 *
 * @returns {boolean} true if saved successfully, false if storage unavailable
 */
export function saveState({
  institution,
  useUILegacyScale = false,
  student,
  semesters,
  projection,
  activeTab = null,
}) {
  try {
    const payload = {
      schema_version:       SCHEMA_VERSION,
      saved_at:             new Date().toISOString(),
      institution_id:       institution?.id || null,
      use_ui_legacy_scale:  useUILegacyScale,
      student:              sanitiseStudent(student),
      semesters:            sanitiseSemesters(semesters),
      projection:           sanitiseProjection(projection),
      active_tab:           activeTab,
      // Only embed gradeTable/classifications for custom schools
      custom_institution:   institution?.scaleGroup === "CUSTOM"
        ? {
            id:              institution.id,
            name:            institution.name,
            shortName:       institution.shortName,
            scale:           institution.scale,
            scaleGroup:      institution.scaleGroup,
            passmark:        institution.passmark,
            gradeTable:      institution.gradeTable,
            classifications: institution.classifications,
          }
        : null,
    };

    localStorage.setItem(KEY_STATE, JSON.stringify(payload));
    localStorage.setItem(KEY_VERSION, SCHEMA_VERSION);
    return true;
  } catch (err) {
    // QuotaExceededError or SecurityError — continue in-memory
    console.warn("[NG CGPA] Could not save to localStorage:", err.message);
    return false;
  }
}


// ── Load State ────────────────────────────────────────────────────────────────

/**
 * Loads the saved application state from localStorage.
 *
 * Returns null if nothing is saved, storage is unavailable, or the
 * stored data is corrupt. The caller should fall back to default state.
 *
 * @returns {Object|null} Parsed state object, or null
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY_STATE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Version check — migrate if needed
    const version = parsed.schema_version || "1.0";
    const data    = version === SCHEMA_VERSION
      ? parsed
      : migrateStoredState(parsed, version);

    if (!data) return null;

    return {
      institutionId:      data.institution_id   || null,
      useUILegacyScale:   data.use_ui_legacy_scale || false,
      student:            restoreStudent(data.student),
      semesters:          restoreSemesters(data.semesters),
      projection:         restoreProjection(data.projection),
      activeTab:          data.active_tab        || null,
      customInstitution:  data.custom_institution || null,
    };
  } catch (err) {
    console.warn("[NG CGPA] Could not load from localStorage:", err.message);
    return null;
  }
}


// ── Clear State ───────────────────────────────────────────────────────────────

/**
 * Removes all NG CGPA data from localStorage.
 * Called when the user confirms the "Clear all data" action.
 */
export function clearState() {
  try {
    localStorage.removeItem(KEY_STATE);
    localStorage.removeItem(KEY_DISMISSED);
    localStorage.removeItem(KEY_CUSTOM);
    localStorage.removeItem(KEY_VERSION);
  } catch {
    // Silent — nothing to do if storage is unavailable
  }
}


// ── Dismissed Suggestions ─────────────────────────────────────────────────────

/**
 * Saves the set of dismissed suggestion IDs.
 *
 * @param {Set<string>} dismissed
 */
export function saveDismissed(dismissed) {
  try {
    const arr = Array.from(dismissed);
    localStorage.setItem(KEY_DISMISSED, JSON.stringify(arr));
  } catch {
    // Silent
  }
}

/**
 * Loads the set of dismissed suggestion IDs.
 *
 * @returns {Set<string>}
 */
export function loadDismissed() {
  try {
    const raw = localStorage.getItem(KEY_DISMISSED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}


// ── Custom Institution ────────────────────────────────────────────────────────

/**
 * Saves a custom institution object separately.
 * Allows the custom school to persist across sessions even when
 * the main state is cleared and reloaded.
 *
 * @param {Object} institution
 */
export function saveCustomInstitution(institution) {
  try {
    if (!institution || institution.scaleGroup !== "CUSTOM") return;
    localStorage.setItem(KEY_CUSTOM, JSON.stringify(institution));
  } catch {
    // Silent
  }
}

/**
 * Loads a previously saved custom institution.
 *
 * @returns {Object|null}
 */
export function loadCustomInstitution() {
  try {
    const raw = localStorage.getItem(KEY_CUSTOM);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}


// ── Storage Usage ─────────────────────────────────────────────────────────────

/**
 * Returns an approximate localStorage usage summary for NG CGPA keys.
 * Useful for debugging or showing a "storage low" warning.
 *
 * @returns {{ usedBytes: number, usedKB: string }}
 */
export function getStorageUsage() {
  const keys = [KEY_STATE, KEY_DISMISSED, KEY_CUSTOM, KEY_VERSION];
  let total = 0;

  try {
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) total += key.length + val.length;
    }
  } catch {
    // Unavailable
  }

  return {
    usedBytes: total * 2, // UTF-16 encoding: 2 bytes per char
    usedKB:    ((total * 2) / 1024).toFixed(1),
  };
}


// ── Schema Migration ──────────────────────────────────────────────────────────

/**
 * Migrates a stored state object from an older schema version to 2.0.
 *
 * @param {Object} old
 * @param {string} fromVersion
 * @returns {Object|null}
 */
function migrateStoredState(old, fromVersion) {
  try {
    if (fromVersion === "1.0") {
      return {
        schema_version:       SCHEMA_VERSION,
        saved_at:             old.savedAt || new Date().toISOString(),
        institution_id:       old.institutionId || old.schoolId || null,
        use_ui_legacy_scale:  old.useUILegacyScale || false,
        student: {
          name:             old.student?.name             || "",
          department:       old.student?.department       || "",
          faculty:          old.student?.faculty          || "",
          matric_number:    old.student?.matricNumber     || "",
          level:            old.student?.level            || "",
          academic_session: old.student?.academicSession  || "",
        },
        semesters:    Array.isArray(old.semesters) ? old.semesters : [],
        projection: {
          targetCGPA:             old.projection?.targetCGPA             ?? null,
          remainingSemesters:     old.projection?.remainingSemesters     ?? null,
          estimatedCUPerSemester: old.projection?.estimatedCUPerSemester ?? null,
        },
        active_tab:           old.activeTab || null,
        custom_institution:   old.customInstitution || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}


// ── Sanitise Helpers (outbound — before writing) ──────────────────────────────

function sanitiseStudent(student) {
  if (!student) return blankStudent();
  return {
    name:             String(student.name             || "").slice(0, 100),
    department:       String(student.department       || "").slice(0, 100),
    faculty:          String(student.faculty          || "").slice(0, 100),
    matric_number:    String(student.matricNumber     || "").slice(0, 50),
    level:            String(student.level            || "").slice(0, 30),
    academic_session: String(student.academicSession  || "").slice(0, 30),
  };
}

function sanitiseSemesters(semesters) {
  if (!Array.isArray(semesters)) return [];
  return semesters.map((sem) => ({
    id:          sem.id || "",
    label:       String(sem.label || "Semester").slice(0, 60),
    isCollapsed: Boolean(sem.isCollapsed),
    courses:     Array.isArray(sem.courses)
      ? sem.courses.map(sanitiseCourse)
      : [],
  }));
}

function sanitiseCourse(course) {
  return {
    id:           course.id || "",
    name:         String(course.name || "").slice(0, 50),
    creditUnits:  course.creditUnits ?? "",
    score:        course.score        !== undefined ? course.score        : null,
    grade:        course.grade        !== undefined ? course.grade        : null,
    gradePoint:   course.gradePoint   !== undefined ? course.gradePoint   : null,
    qualityPoint: course.qualityPoint !== undefined ? course.qualityPoint : null,
    status:       course.status || "passed",
  };
}

function sanitiseProjection(projection) {
  if (!projection) return blankProjection();
  return {
    targetCGPA:             projection.targetCGPA             ?? null,
    remainingSemesters:     projection.remainingSemesters     ?? null,
    estimatedCUPerSemester: projection.estimatedCUPerSemester ?? null,
  };
}


// ── Restore Helpers (inbound — after reading) ─────────────────────────────────

function restoreStudent(raw) {
  if (!raw) return blankStudent();
  return {
    name:             raw.name             || "",
    department:       raw.department       || "",
    faculty:          raw.faculty          || "",
    matricNumber:     raw.matric_number    || "",
    level:            raw.level            || "",
    academicSession:  raw.academic_session || "",
  };
}

function restoreSemesters(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((sem) => ({
    id:          sem.id    || "",
    label:       sem.label || "Semester",
    isCollapsed: Boolean(sem.isCollapsed),
    courses:     Array.isArray(sem.courses)
      ? sem.courses.map(restoreCourse)
      : [],
  }));
}

function restoreCourse(raw) {
  return {
    id:           raw.id           || "",
    name:         raw.name         || "",
    creditUnits:  raw.creditUnits  ?? "",
    score:        raw.score        ?? null,
    grade:        raw.grade        ?? null,
    gradePoint:   raw.gradePoint   ?? null,
    qualityPoint: raw.qualityPoint ?? null,
    status:       raw.status       || "passed",
  };
}

function restoreProjection(raw) {
  if (!raw) return blankProjection();
  return {
    targetCGPA:             raw.targetCGPA             ?? null,
    remainingSemesters:     raw.remainingSemesters     ?? null,
    estimatedCUPerSemester: raw.estimatedCUPerSemester ?? null,
  };
}


// ── Default Shapes ────────────────────────────────────────────────────────────

function blankStudent() {
  return {
    name: "", department: "", faculty: "",
    matricNumber: "", level: "", academicSession: "",
  };
}

function blankProjection() {
  return {
    targetCGPA: null,
    remainingSemesters: null,
    estimatedCUPerSemester: null,
  };
}