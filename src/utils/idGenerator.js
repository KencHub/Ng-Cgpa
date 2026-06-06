// ── idGenerator.js ────────────────────────────────────────────────────────────
// Generates stable, unique IDs for semesters, courses, and any other
// entity that needs a persistent key.
//
// Design requirements:
//   1. IDs must be unique across the session and across page reloads.
//   2. IDs must be safe to use as React keys and localStorage keys.
//   3. IDs must be human-readable enough to aid debugging.
//   4. No external dependency — pure JS.
//
// Format:
//   Semester:  sem-[base36 timestamp]-[4 random hex chars]
//   Course:    c-[base36 timestamp]-[4 random hex chars]
//   Generic:   id-[base36 timestamp]-[4 random hex chars]
//
// The base36 timestamp encodes the millisecond epoch in a short string.
// The random suffix prevents collisions when multiple IDs are generated
// within the same millisecond.


// ── Internal counter ──────────────────────────────────────────────────────────
// Provides strict monotonic ordering even within the same millisecond.
let _counter = 0;

function tick() {
  _counter = (_counter + 1) % 65536;
  return _counter.toString(16).padStart(4, "0");
}

function tsBase36() {
  return Date.now().toString(36);
}


// ── Public Generators ─────────────────────────────────────────────────────────

/**
 * Generates a unique semester ID.
 * Example: "sem-lq5k7p2f-0001"
 *
 * @returns {string}
 */
export function generateSemesterId() {
  return `sem-${tsBase36()}-${tick()}`;
}

/**
 * Generates a unique course ID.
 * Example: "c-lq5k7p2f-0002"
 *
 * @returns {string}
 */
export function generateCourseId() {
  return `c-${tsBase36()}-${tick()}`;
}

/**
 * Generates a generic unique ID with a custom prefix.
 * Example: generateId("msg") → "msg-lq5k7p2f-0003"
 *
 * @param {string} [prefix="id"]
 * @returns {string}
 */
export function generateId(prefix = "id") {
  const safe = String(prefix).replace(/[^a-z0-9]/gi, "").toLowerCase() || "id";
  return `${safe}-${tsBase36()}-${tick()}`;
}

/**
 * Generates a default label for a new semester based on the current count.
 *
 * Returns labels like:
 *   1 → "100L First Semester"
 *   2 → "100L Second Semester"
 *   3 → "200L First Semester"
 *   4 → "200L Second Semester"
 *   ... up to 8 (400L Second Semester)
 *   9+ → "Semester 9"
 *
 * @param {number} count - Total number of semesters including this new one (1-indexed)
 * @returns {string}
 */
export function generateSemesterLabel(count) {
  const labels = [
    "100L First Semester",
    "100L Second Semester",
    "200L First Semester",
    "200L Second Semester",
    "300L First Semester",
    "300L Second Semester",
    "400L First Semester",
    "400L Second Semester",
    "500L First Semester",
    "500L Second Semester",
  ];

  if (count >= 1 && count <= labels.length) {
    return labels[count - 1];
  }

  return `Semester ${count}`;
}

/**
 * Returns a factory function that generates course IDs.
 * Used by importParser.js to pass a generator without importing
 * the full module.
 *
 * @returns {Function}
 */
export function makeCourseIdFactory() {
  return generateCourseId;
}

/**
 * Returns a factory function that generates semester IDs.
 *
 * @returns {Function}
 */
export function makeSemesterIdFactory() {
  return generateSemesterId;
}


// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Returns true if the string looks like a valid NG CGPA-generated ID.
 * Used during import to detect IDs that need regeneration.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isValidGeneratedId(id) {
  if (!id || typeof id !== "string") return false;
  // Matches: prefix-base36ts-hexcounter
  return /^[a-z]+-[0-9a-z]+-[0-9a-f]{4}$/.test(id);
}

/**
 * Regenerates an ID if it is missing, invalid, or came from an import
 * (import- prefixed IDs from exportJSON.js should be replaced with
 * fresh IDs on actual import).
 *
 * @param {string|undefined} id
 * @param {"semester"|"course"|string} type
 * @returns {string}
 */
export function ensureId(id, type = "id") {
  if (!id || typeof id !== "string" || id.startsWith("import-") || id.startsWith("preview-")) {
    if (type === "semester") return generateSemesterId();
    if (type === "course")   return generateCourseId();
    return generateId(type);
  }
  return id;
}