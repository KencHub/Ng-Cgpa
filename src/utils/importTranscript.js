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

function groupItemsIntoRows(items, threshold = 10) {
  const buckets = new Map();

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

    const semLabel = detectSemesterLabel(trimmed);
    if (semLabel) {
      current = { label: semLabel, courses: [], sourceGPA: null };
      semesters.push(current);
      continue;
    }

    const gpa = extractGPAFromRow(trimmed);
    if (gpa !== null && current && current.sourceGPA === null) {
      current.sourceGPA = gpa;
      continue;
    }

    const result = parsePDFCourseRow(trimmed, gradeTable, generateId);
    if (result.valid) {
      if (!current) {
        current = { label: "Imported Semester", courses: [], sourceGPA: null };
        semesters.push(current);
      }
      current.courses.push(result.course);
    }
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

  // Scan rows above the column header for a semester label
  let preSemLabel = null;
  for (let i = 0; i < headerIndex; i++) {
    const flat    = rows[i].map(c => String(c).trim());
    const rowText = flat.join(" ").trim();
    const label   = detectSemesterLabel(rowText);
    if (label) preSemLabel = label;
  }
  if (preSemLabel) {
    current = { label: preSemLabel, courses: [], sourceGPA: null };
    semesters.push(current);
  }

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row     = rows[i];
    const flat    = row.map(c => String(c).trim());
    const rowText = flat.join(" ").trim();

    if (!rowText) continue;

    const semLabel = detectSemesterLabel(rowText);
    if (semLabel) {
      current = { label: semLabel, courses: [], sourceGPA: null };
      semesters.push(current);
      continue;
    }

    const gpa = extractGPAFromRow(rowText);
    if (gpa !== null && current && current.sourceGPA === null) {
      current.sourceGPA = gpa;
      continue;
    }

    const result = extractCourseFromRow(flat, colMap, gradeTable, generateId);
    if (result.valid) {
      if (!current) {
        current = { label: "Imported Semester", courses: [], sourceGPA: null };
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

    if (!map.code) {
      if (
        cell === "course code" || cell === "code" ||
        cell.startsWith("course code") ||
        (cell.includes("course") && !cell.includes("title"))
      ) {
        map.code = j;
      }
    }

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

    if (map.grade === undefined && cell === "grade") {
      map.grade = j;
    }

    if (map.score === undefined && (cell.includes("score") || cell.includes("mark"))) {
      map.score = j;
    }
  }

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
  if (!name) return { valid: false, reason: null };

  const cu = parseInt(rawCU, 10);
  if (isNaN(cu) || cu < 0 || cu > 6) {
    return { valid: false, reason: `Invalid credit units: "${rawCU}".` };
  }

  const thirdField = rawGrade.trim() || rawScore.trim();
  if (!thirdField) {
    return { valid: false, reason: "No grade or score found in this row." };
  }

  return resolveAndBuild(name, cu, thirdField, gradeTable, generateId);
}


// ── PDF: Course Row Extraction ────────────────────────────────────────────────
// CHANGED: n >= 0 and m >= 0 throughout to correctly handle 0-credit courses.

const COURSE_CODE_RE = /([A-Z]{2,7})\s*(\d{3}[A-Z]?)\b/;

function parsePDFCourseRow(rowText, gradeTable, generateId) {
  const match = rowText.match(COURSE_CODE_RE);
  if (!match) return { valid: false };

  const courseCode = `${match[1]} ${match[2]}`;
  const remainder  = rowText.slice(match.index + match[0].length).trim();
  const tokens     = remainder.split(/\s+/).filter(Boolean);

  let cu    = null;
  let grade = null;
  let score = null;

  // ── Pass 1: integer (0-9) immediately followed by a grade letter ──────────
  for (let i = 0; i < tokens.length - 1; i++) {
    const n    = parseInt(tokens[i], 10);
    const next = tokens[i + 1];
    if (
      !isNaN(n) && n >= 0 && n <= 9 &&
      String(n) === tokens[i] &&
      /^[A-Ha-h]$/.test(next)
    ) {
      cu    = n;
      grade = next.toUpperCase();
      break;
    }
  }

  // ── Pass 2: find grade letter, then search nearby tokens for CU ───────────
  if (!grade) {
    for (let i = 0; i < tokens.length; i++) {
      if (!/^[A-Ha-h]$/.test(tokens[i])) continue;

      // Search backward for CU (up to 4 positions back)
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const n = parseInt(tokens[j], 10);
        if (!isNaN(n) && n >= 0 && n <= 9 && String(n) === tokens[j]) {
          cu    = n;
          grade = tokens[i].toUpperCase();
          break;
        }
      }
      if (cu !== null) break;

      // Search forward for CU (up to 4 positions ahead)
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 4); j++) {
        const n = parseInt(tokens[j], 10);
        if (!isNaN(n) && n >= 0 && n <= 9 && String(n) === tokens[j]) {
          cu    = n;
          grade = tokens[i].toUpperCase();
          break;
        }
      }
      if (cu !== null) break;
    }
  }

  // ── Pass 3: score-based transcript (no grade letter, score 10-100) ────────
  if (!grade) {
    for (let i = 0; i < tokens.length; i++) {
      const n = parseInt(tokens[i], 10);
      if (isNaN(n) || n <= 9 || n > 100 || String(n) !== tokens[i]) continue;
      score = n;

      // Look for CU before the score
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const m = parseInt(tokens[j], 10);
        if (!isNaN(m) && m >= 0 && m <= 9 && String(m) === tokens[j]) {
          cu = m; break;
        }
      }
      // Or CU after the score
      if (cu === null) {
        for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 3); j++) {
          const m = parseInt(tokens[j], 10);
          if (!isNaN(m) && m >= 0 && m <= 9 && String(m) === tokens[j]) {
            cu = m; break;
          }
        }
      }
      if (cu !== null) break;
    }

    if (score !== null && cu !== null) {
      return resolveAndBuild(courseCode, cu, String(score), gradeTable, generateId);
    }
  }

  if (!grade || cu === null) return { valid: false };

  return resolveAndBuild(courseCode, cu, grade, gradeTable, generateId);
}


// ── Shared: Grade / Score Resolution ─────────────────────────────────────────

function resolveAndBuild(name, cu, thirdField, gradeTable, generateId) {
  const trimmed = thirdField.trim();

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

const SEM_ORDINAL_RE = /(first|second|1st|2nd)\s+semester/i;
const SEM_LEVEL_RE   = /(\d{3})\s*(?:level|l)?\b/i;

function detectSemesterLabel(text) {
  if (text.length > 70) return null;

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