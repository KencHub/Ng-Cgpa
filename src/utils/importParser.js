// ── importParser.js ───────────────────────────────────────────────────────────
// Parses bulk course import text.
//
// Accepts comma-separated lines in two formats:
//   Format A (score):  MTH101, 3, 75
//   Format B (grade):  MTH101, 3, A
//
// Mixed formats within a single import are accepted.
// Each line is evaluated independently.
//
// Credit units of 0 are accepted for non-contributing courses (e.g. GST115).
// Credit units up to 8 are accepted (some technology/professional courses carry
// 7–8 units). Values above 8 are rejected.
//
// Returns a structured result object with valid courses and a skip report.


// ── Main Parser ───────────────────────────────────────────────────────────────

export function parseImportText(rawText, gradeTable, generateId) {
  if (!rawText || typeof rawText !== "string") {
    return emptyResult();
  }

  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return emptyResult();

  const courses = [];
  const skipped = [];

  for (let i = 0; i < lines.length; i++) {
    const line       = lines[i];
    const lineNumber = i + 1;
    const result     = parseLine(line, gradeTable, generateId);

    if (result.valid) {
      courses.push(result.course);
    } else {
      skipped.push({ line, lineNumber, reason: result.reason });
    }
  }

  return {
    courses,
    skipped,
    total:    lines.length,
    imported: courses.length,
  };
}


// ── Line Parser ───────────────────────────────────────────────────────────────

function parseLine(line, gradeTable, generateId) {
  const parts = line
    .split(/,|\t/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 3) {
    return {
      valid:  false,
      reason: `Expected 3 fields (name, credit units, score or grade) but found ${parts.length}.`,
    };
  }

  const rawName  = parts[0];
  const rawCU    = parts[1];
  const rawThird = parts[2];

  // ── Course name ───────────────────────────────────────────────────────────
  const name = rawName.trim();
  if (name.length < 1) {
    return { valid: false, reason: "Course name is empty." };
  }
  if (name.length > 50) {
    return {
      valid:  false,
      reason: `Course name "${name.slice(0, 20)}..." exceeds 50 characters.`,
    };
  }

  // ── Credit units ──────────────────────────────────────────────────────────
  // 0 is valid for non-contributing courses (e.g. GST115 at UNIZIK).
  // Maximum is 8 — some technology and professional courses carry 7–8 units.
  const cu = parseInt(rawCU, 10);
  if (isNaN(cu) || cu < 0 || cu > 8 || !Number.isInteger(cu)) {
    return {
      valid:  false,
      reason: `Credit units "${rawCU}" is invalid. Must be a whole number between 0 and 8. Use 0 only for non-contributing courses (e.g. GST115).`,
    };
  }

  // ── Third field: score or grade ───────────────────────────────────────────
  const inputType = detectInputType(rawThird);

  if (inputType === "invalid") {
    return {
      valid:  false,
      reason: `"${rawThird}" is not a recognised score (0–100) or grade letter.`,
    };
  }

  if (inputType === "score") {
    const score = Math.round(parseFloat(rawThird));

    if (isNaN(score) || score < 0 || score > 100) {
      return {
        valid:  false,
        reason: `Score "${rawThird}" is out of range. Must be between 0 and 100.`,
      };
    }

    const gradeEntry = resolveGradeFromScore(score, gradeTable);
    if (!gradeEntry) {
      return {
        valid:  false,
        reason: `Score ${score} could not be mapped to a grade with the selected institution's grading table.`,
      };
    }

    return {
      valid:  true,
      course: buildCourse({
        id:           generateId(),
        name,
        creditUnits:  cu,
        score,
        grade:        gradeEntry.letter,
        gradePoint:   gradeEntry.point,
        qualityPoint: cu === 0 ? 0 : cu * gradeEntry.point,
        status:       cu === 0 ? "non_contributing" : gradeEntry.point === 0 ? "failed" : "passed",
      }),
    };
  }

  if (inputType === "grade") {
    const letter     = rawThird.trim().toUpperCase();
    const gradeEntry = gradeTable.find((g) => g.letter.toUpperCase() === letter);

    if (!gradeEntry) {
      const validLetters = gradeTable.map((g) => g.letter).join(", ");
      return {
        valid:  false,
        reason: `"${letter}" is not a valid grade letter for the selected institution. Valid grades: ${validLetters}.`,
      };
    }

    const score = gradeEntry.min;

    return {
      valid:  true,
      course: buildCourse({
        id:           generateId(),
        name,
        creditUnits:  cu,
        score,
        grade:        gradeEntry.letter,
        gradePoint:   gradeEntry.point,
        qualityPoint: cu === 0 ? 0 : cu * gradeEntry.point,
        status:       cu === 0 ? "non_contributing" : gradeEntry.point === 0 ? "failed" : "passed",
      }),
    };
  }

  return { valid: false, reason: "Unrecognised line format." };
}


// ── Input Type Detection ──────────────────────────────────────────────────────

export function detectInputType(value) {
  if (!value || typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed === "") return "invalid";
  if (!isNaN(trimmed) && trimmed !== "") return "score";
  if (/^[A-Ha-h]{1,2}$/.test(trimmed)) return "grade";
  return "invalid";
}


// ── Preview Generator ─────────────────────────────────────────────────────────

export function previewImport(rawText, gradeTable) {
  let counter = 0;
  const tempId = () => `preview-${++counter}`;
  return parseImportText(rawText, gradeTable, tempId);
}


// ── Import Summary Message ────────────────────────────────────────────────────

export function buildImportSummary(result) {
  const { imported, skipped, total } = result;

  if (total === 0) return "No lines found in the pasted text.";

  let msg = `${imported} ${imported === 1 ? "course" : "courses"} imported.`;

  if (skipped.length > 0) {
    msg += ` ${skipped.length} ${skipped.length === 1 ? "line was" : "lines were"} skipped:`;
    for (const skip of skipped) {
      msg += `\n  Line ${skip.lineNumber}: "${skip.line}" — ${skip.reason}`;
    }
  }

  return msg;
}


// ── Format Guide ──────────────────────────────────────────────────────────────

export function getFormatGuide(gradeTable) {
  const validGrades = Array.isArray(gradeTable)
    ? gradeTable.map((g) => g.letter).join(", ")
    : "A, B, C, D, E, F";

  return (
    `Paste one course per line.\n\n` +
    `Score format:   CourseName, CreditUnits, Score\n` +
    `                Example: MTH101, 3, 75\n\n` +
    `Grade format:   CourseName, CreditUnits, Grade\n` +
    `                Example: MTH101, 3, A\n\n` +
    `Valid grades for your institution: ${validGrades}\n` +
    `Credit units must be a whole number between 0 and 8. Use 0 for courses with no ` +
    `credit weight (they are recorded but excluded from all calculations).\n` +
    `Score must be between 0 and 100.\n` +
    `Both formats can be mixed in the same import.`
  );
}


// ── Duplicate / Update Diff Engine ────────────────────────────────────────────
//
// computeImportDiff compares an array of incoming courses against the
// courses already present in the target semester. Matching is by course name
// (case-insensitive, trimmed). Grade and credit units determine identity:
//
//   added      — incoming course name does not exist in the semester.
//   updated    — same name exists, but grade or CU differs.
//   duplicates — same name, same grade, same CU — already identical.
//
// Score differences alone (when grade + CU are the same) do not trigger an
// update because score doesn't affect quality points independently of grade.
//
// Returns: { added: Course[], updated: {existing,incoming}[], duplicates: {existing,incoming}[] }

export function computeImportDiff(existingCourses, incomingCourses) {
  const added      = [];
  const updated    = [];
  const duplicates = [];

  for (const incoming of incomingCourses) {
    const key      = incoming.name.trim().toLowerCase();
    const existing = existingCourses.find(
      (c) => c.name.trim().toLowerCase() === key
    );

    if (!existing) {
      added.push(incoming);
      continue;
    }

    const sameGrade = (existing.grade ?? null) === (incoming.grade ?? null);
    const sameCU    = Number(existing.creditUnits) === Number(incoming.creditUnits);

    if (sameGrade && sameCU) {
      duplicates.push({ existing, incoming });
    } else {
      updated.push({ existing, incoming });
    }
  }

  return { added, updated, duplicates };
}


// ── Multi-Semester Diff ───────────────────────────────────────────────────────
//
// Used when importing an entire transcript (multiple semester blocks).
// Matches incoming semesters against existing ones by label (case-insensitive).
//
// Each entry in the returned array:
// {
//   label:           string,
//   existingSemId:   string | null,  — null when the semester is new
//   isNew:           boolean,
//   incomingCourses: Course[],
//   diff:            { added, updated, duplicates },
// }

export function computeMultiSemesterDiff(existingSemesters, incomingSemesters) {
  return incomingSemesters.map((incomingSem) => {
    const matchingSem = existingSemesters.find(
      (s) => s.label.trim().toLowerCase() === incomingSem.label.trim().toLowerCase()
    );

    if (!matchingSem) {
      return {
        label:           incomingSem.label,
        existingSemId:   null,
        isNew:           true,
        incomingCourses: incomingSem.courses,
        diff: {
          added:      incomingSem.courses,
          updated:    [],
          duplicates: [],
        },
      };
    }

    return {
      label:           incomingSem.label,
      existingSemId:   matchingSem.id,
      isNew:           false,
      incomingCourses: incomingSem.courses,
      diff:            computeImportDiff(matchingSem.courses, incomingSem.courses),
    };
  });
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveGradeFromScore(score, gradeTable) {
  if (!Array.isArray(gradeTable)) return null;
  const sorted = [...gradeTable].sort((a, b) => b.min - a.min);
  for (const entry of sorted) {
    if (score >= entry.min && score <= entry.max) return entry;
  }
  return null;
}

function buildCourse(fields) {
  return {
    id:              fields.id,
    name:            fields.name,
    creditUnits:     fields.creditUnits,
    score:           fields.score           ?? null,
    grade:           fields.grade           ?? null,
    gradePoint:      fields.gradePoint      ?? null,
    qualityPoint:    fields.qualityPoint    ?? null,
    status:          fields.status          ?? "pending",
    nonContributing: fields.creditUnits === 0,
  };
}

function emptyResult() {
  return { courses: [], skipped: [], total: 0, imported: 0 };
}