// ── importTranscript.js ───────────────────────────────────────────────────────
// Parses Excel (.xlsx / .xls) and PDF academic transcripts.
// Detects semester blocks automatically. Returns courses grouped by semester.
//
// Required packages — run once in your project root:
//   npm install xlsx
//   npm install pdfjs-dist
//
// Both public functions return TranscriptResult:
// {
//   semesters: Array<{
//     label:     string,
//     courses:   Course[],      // same shape as buildCourse() in importParser.js
//     sourceGPA: number | null, // GPA printed on the transcript, for verification
//   }>,
//   skipped:     Array<{ text: string, reason: string }>,
//   totalCourses: number,
// }


// ── Library loaders (lazy, cached) ───────────────────────────────────────────

let _xlsx  = null;
let _pdfjs = null;

async function getXLSX() {
  if (_xlsx) return _xlsx;
  try {
    _xlsx = await import("xlsx");
    return _xlsx;
  } catch {
    throw new Error(
      "xlsx package not found. Run: npm install xlsx"
    );
  }
}

async function getPDFLib() {
  if (_pdfjs) return _pdfjs;
  try {
    _pdfjs = await import("pdfjs-dist");
    // Resolve the worker from the locally installed package.
    // new URL(..., import.meta.url) is a Vite-native pattern — Vite
    // bundles the worker file and returns a local URL, so no CDN or
    // network request is needed and the version always matches exactly.
    _pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).href;
    return _pdfjs;
  } catch {
    throw new Error(
      "pdfjs-dist package not found. Run: npm install pdfjs-dist"
    );
  }
}


// ── Public: Excel Parser ──────────────────────────────────────────────────────

export async function parseXLSXTranscript(file, gradeTable, generateId) {
  const XLSX   = await getXLSX();
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: "array" });

  const allSemesters = [];
  const skipped      = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    // header:1 → array of arrays. defval:"" fills empty cells.
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const found = parseSheetForSemesters(rows, gradeTable, generateId, sheetName, skipped);
    allSemesters.push(...found);
  }

  const totalCourses = allSemesters.reduce((n, s) => n + s.courses.length, 0);

  if (totalCourses === 0) {
    throw new Error(
      "No course data detected. Ensure the spreadsheet has columns for " +
      "course code, credit units, and grade or score."
    );
  }

  return { semesters: allSemesters, skipped, totalCourses };
}


// ── Public: PDF Parser ────────────────────────────────────────────────────────

export async function parsePDFTranscript(file, gradeTable, generateId) {
  const pdfjsLib = await getPDFLib();
  const buffer   = await file.arrayBuffer();
  const pdfDoc   = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allRows = [];

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page    = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const rows    = groupItemsIntoRows(content.items);
    allRows.push(...rows);
  }

  const skipped      = [];
  const semesters    = parsePDFRowsIntoSemesters(allRows, gradeTable, generateId, skipped);
  const totalCourses = semesters.reduce((n, s) => n + s.courses.length, 0);

  if (totalCourses === 0) {
    throw new Error(
      "No course data extracted. Only digital (text-based) PDFs are supported. " +
      "Scanned image transcripts cannot be parsed."
    );
  }

  return { semesters, skipped, totalCourses };
}


// ── PDF: Row Grouping ─────────────────────────────────────────────────────────
// Groups text items by Y-coordinate to reconstruct table rows.
// threshold=3 handles minor vertical misalignment within a row.

function groupItemsIntoRows(items, threshold = 3) {
  const buckets = new Map(); // roundedY → [{ x, text }]

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const rawY = item.transform[5];
    const x    = item.transform[4];

    let bucketY = null;
    for (const y of buckets.keys()) {
      if (Math.abs(y - rawY) <= threshold) { bucketY = y; break; }
    }
    if (bucketY === null) {
      bucketY = rawY;
      buckets.set(bucketY, []);
    }
    buckets.get(bucketY).push({ x, text });
  }

  // PDF Y-axis starts from bottom; sort descending to read top-to-bottom.
  return [...buckets.entries()]
    .sort(([ya], [yb]) => yb - ya)
    .map(([, cells]) =>
      cells
        .sort((a, b) => a.x - b.x)
        .map(c => c.text)
        .join(" ")
    );
}


// ── PDF: Semester Block Parser ────────────────────────────────────────────────

function parsePDFRowsIntoSemesters(rows, gradeTable, generateId, skipped) {
  const semesters = [];
  let current     = null;

  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) continue;

    // Semester header
    const semLabel = detectSemesterLabel(trimmed);
    if (semLabel) {
      current = { label: semLabel, courses: [], sourceGPA: null };
      semesters.push(current);
      continue;
    }

    // Semester / cumulative GPA row — attach to current semester for display
    const gpa = extractGPAFromRow(trimmed);
    if (gpa !== null && current && current.sourceGPA === null) {
      current.sourceGPA = gpa;
      continue;
    }

    // Course row
    const result = parsePDFCourseRow(trimmed, gradeTable, generateId);
    if (result.valid) {
      if (!current) {
        current = { label: "Imported Semester", courses: [], sourceGPA: null };
        semesters.push(current);
      }
      current.courses.push(result.course);
    }
    // Non-matching rows (headers, footers, student info) are silently skipped
    // to avoid noise in the skip report.
  }

  return semesters.filter(s => s.courses.length > 0);
}


// ── Excel: Sheet Parser ───────────────────────────────────────────────────────

function parseSheetForSemesters(rows, gradeTable, generateId, sheetName, skipped) {
  const headerInfo = findHeaderRow(rows);

  if (!headerInfo) {
    skipped.push({
      text: sheetName,
      reason:
        "Could not detect column headers. Expected columns like: " +
        "Course Code, Credit Units, Grade.",
    });
    return [];
  }

  const { headerIndex, colMap } = headerInfo;
  const semesters = [];
  let current     = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row     = rows[i];
    const flat    = row.map(c => String(c).trim());
    const rowText = flat.join(" ").trim();

    if (!rowText) continue;

    // Semester header
    const semLabel = detectSemesterLabel(rowText);
    if (semLabel) {
      current = { label: semLabel, courses: [], sourceGPA: null };
      semesters.push(current);
      continue;
    }

    // GPA row
    const gpa = extractGPAFromRow(rowText);
    if (gpa !== null && current && current.sourceGPA === null) {
      current.sourceGPA = gpa;
      continue;
    }

    // Course row
    const result = extractCourseFromRow(flat, colMap, gradeTable, generateId);
    if (result.valid) {
      if (!current) {
        current = { label: sheetName || "Imported Semester", courses: [], sourceGPA: null };
        semesters.push(current);
      }
      current.courses.push(result.course);
    } else if (result.reason && rowText.length > 2) {
      skipped.push({ text: rowText.slice(0, 80), reason: result.reason });
    }
  }

  return semesters.filter(s => s.courses.length > 0);
}


// ── Excel: Header Detection ───────────────────────────────────────────────────

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const normalized = rows[i].map(c => String(c).toLowerCase().trim());
    const colMap     = mapHeaderColumns(normalized);
    if (colMap) return { headerIndex: i, colMap };
  }
  return null;
}

function mapHeaderColumns(row) {
  const map = {};

  for (let j = 0; j < row.length; j++) {
    const cell = row[j];

    // Course code column
    if (!map.code) {
      if (
        cell === "course code" || cell === "code" ||
        cell.startsWith("course code") ||
        (cell.includes("course") && !cell.includes("title"))
      ) {
        map.code = j;
      }
    }

    // Credit units column — prefer explicit "credit unit" over bare "unit"
    if (map.cu === undefined) {
      if (
        cell.includes("credit unit") || cell.includes("credit hours") ||
        cell === "cu" || cell === "ch"
      ) {
        map.cu = j;
      } else if (cell === "unit" || cell === "units") {
        map.cu = j;
      }
    }

    // Grade column — must be exactly "grade", not "grade point" or "grade points"
    if (map.grade === undefined && cell === "grade") {
      map.grade = j;
    }

    // Score / mark column
    if (map.score === undefined && (cell.includes("score") || cell.includes("mark"))) {
      map.score = j;
    }
  }

  // Require at minimum: code + CU + (grade or score)
  if (map.code === undefined || map.cu === undefined) return null;
  if (map.grade === undefined && map.score === undefined) return null;

  return map;
}


// ── Excel: Course Row Extraction ──────────────────────────────────────────────

function extractCourseFromRow(flat, colMap, gradeTable, generateId) {
  const rawCode  = flat[colMap.code]  ?? "";
  const rawCU    = flat[colMap.cu]    ?? "";
  const rawGrade = colMap.grade !== undefined ? (flat[colMap.grade] ?? "") : "";
  const rawScore = colMap.score !== undefined ? (flat[colMap.score] ?? "") : "";

  const name = rawCode.trim();
  if (!name) return { valid: false, reason: null }; // empty row, silent

  const cu = parseInt(rawCU, 10);
  if (isNaN(cu) || cu < 0 || cu > 6) {
    return { valid: false, reason: `Invalid credit units: "${rawCU}".` };
  }

  // Prefer grade column over score column when both are present
  const thirdField = rawGrade.trim() || rawScore.trim();
  if (!thirdField) {
    return { valid: false, reason: "No grade or score found in this row." };
  }

  return resolveAndBuild(name, cu, thirdField, gradeTable, generateId);
}


// ── PDF: Course Row Extraction ────────────────────────────────────────────────
// Nigerian course codes: 2-7 uppercase letters + space + 3 digits + optional letter.
// Examples: "GST 111", "MATHS 101", "CHEM 108", "RAD 206", "BIOSTAT 204"
//
// Row text after grouping: "GST 111 [optional title words] 2 A 5 10"
//
// Strategy: match the code prefix, then scan tokens for the first integer
// in 0-6 range that is immediately followed by a grade letter (A-H).

const COURSE_CODE_RE = /^([A-Z]{2,7})\s+(\d{3}[A-Z]?)\b/;

function parsePDFCourseRow(rowText, gradeTable, generateId) {
  const match = rowText.match(COURSE_CODE_RE);
  if (!match) return { valid: false };

  const courseCode = `${match[1]} ${match[2]}`;
  const remainder  = rowText.slice(match[0].length).trim();
  const tokens     = remainder.split(/\s+/);

  let cuIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const n = parseInt(tokens[i], 10);
    // Must be a clean integer 0-6 (no decimal), followed by a grade letter
    if (!isNaN(n) && n >= 0 && n <= 6 && String(n) === tokens[i]) {
      const next = tokens[i + 1] ?? "";
      if (/^[A-Ha-h]$/.test(next)) {
        cuIndex = i;
        break;
      }
    }
  }

  if (cuIndex === -1) return { valid: false };

  const cu    = parseInt(tokens[cuIndex], 10);
  const grade = tokens[cuIndex + 1].toUpperCase();

  return resolveAndBuild(courseCode, cu, grade, gradeTable, generateId);
}


// ── Shared: Grade / Score Resolution ─────────────────────────────────────────

function resolveAndBuild(name, cu, thirdField, gradeTable, generateId) {
  const trimmed = thirdField.trim();

  // Numeric → treat as score
  if (!isNaN(trimmed) && trimmed !== "") {
    const score = Math.round(parseFloat(trimmed));
    if (score < 0 || score > 100) {
      return { valid: false, reason: `Score ${score} is out of range (0-100).` };
    }
    const entry = resolveGradeFromScore(score, gradeTable);
    if (!entry) {
      return {
        valid: false,
        reason: `Score ${score} could not be mapped with the current grade table.`,
      };
    }
    return {
      valid:  true,
      course: buildTranscriptCourse({
        id: generateId(), name, creditUnits: cu,
        score, grade: entry.letter, gradePoint: entry.point,
        qualityPoint: cu === 0 ? 0 : cu * entry.point,
      }),
    };
  }

  // Letter → treat as grade
  const letter = trimmed.toUpperCase();
  const entry  = gradeTable.find(g => g.letter.toUpperCase() === letter);

  if (!entry) {
    const valid = gradeTable.map(g => g.letter).join(", ");
    return {
      valid: false,
      reason: `"${letter}" is not a valid grade. Valid grades: ${valid}.`,
    };
  }

  return {
    valid:  true,
    course: buildTranscriptCourse({
      id: generateId(), name, creditUnits: cu,
      score: entry.min, grade: entry.letter, gradePoint: entry.point,
      qualityPoint: cu === 0 ? 0 : cu * entry.point,
    }),
  };
}


// ── Semester Label Detection ──────────────────────────────────────────────────
// Matches: "100 LEVEL — FIRST SEMESTER", "100L FIRST SEMESTER",
//          "200 LEVEL SECOND SEMESTER", "FIRST SEMESTER", etc.
// Short-circuits on long lines to avoid false positives in course titles.

const SEM_ORDINAL_RE = /(first|second|1st|2nd)\s+semester/i;
const SEM_LEVEL_RE   = /(\d{3})\s*(?:level|l)?\b/i;

function detectSemesterLabel(text) {
  if (text.length > 70) return null; // too long to be a header

  const ordMatch = text.match(SEM_ORDINAL_RE);
  if (!ordMatch) return null;

  const levMatch = text.match(SEM_LEVEL_RE);

  let ordWord = ordMatch[1].toLowerCase();
  if (ordWord === "1st") ordWord = "first";
  if (ordWord === "2nd") ordWord = "second";
  const semPart = `${ordWord.charAt(0).toUpperCase() + ordWord.slice(1)} Semester`;

  return levMatch ? `${levMatch[1]}L ${semPart}` : semPart;
}


// ── GPA Row Detection ─────────────────────────────────────────────────────────

const GPA_RE = /(?:semester\s+gpa|cumulative\s+gpa|sgpa|cgpa|gpa)\s*[=:—]?\s*([\d.]+)/i;

function extractGPAFromRow(text) {
  const m = text.match(GPA_RE);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return isNaN(val) ? null : val;
}


// ── Score → Grade Resolver ────────────────────────────────────────────────────

function resolveGradeFromScore(score, gradeTable) {
  const sorted = [...gradeTable].sort((a, b) => b.min - a.min);
  for (const entry of sorted) {
    if (score >= entry.min && score <= entry.max) return entry;
  }
  return null;
}


// ── Course Builder ────────────────────────────────────────────────────────────
// Matches the shape produced by buildCourse() in importParser.js exactly.

function buildTranscriptCourse({ id, name, creditUnits, score, grade, gradePoint, qualityPoint }) {
  return {
    id,
    name,
    creditUnits,
    score:           score         ?? null,
    grade:           grade         ?? null,
    gradePoint:      gradePoint    ?? null,
    qualityPoint:    qualityPoint  ?? null,
    status:          creditUnits === 0 ? "non_contributing"
                     : gradePoint === 0 ? "failed"
                     : "passed",
    nonContributing: creditUnits === 0,
  };
}