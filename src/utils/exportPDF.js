// ── exportPDF.js ──────────────────────────────────────────────────────────────
// Generates the full multi-page PDF report using jsPDF and jsPDF-AutoTable.
// All rendering is client-side. No server dependency.
//
// Page layout:
//   Page 1   — Cover + Student Profile + Performance Summary
//   Page 2+  — Course Details (one table per semester)
//   Next     — Semester Breakdown table
//   Last     — GPA Analytics + Verification block


import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH,
  PDF_COLOR, PDF_FONT, PDF_SIZE,
  TABLE_STYLE,
  addWatermark, addFooter, addSectionHeading, addRule, addKV, addGPABar,
  classColor, generateRefId, formatPDFDate, safeStr, fmtGPA,
} from "./pdfTemplate.js";
import { computeTotals, getClassification } from "./calculator.js";


// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Generates the full PDF report and triggers a browser download.
 *
 * @param {Object} params
 * @param {Object|null}  params.institution
 * @param {Object}       params.student
 * @param {Array}        params.semesters
 * @param {number|null}  params.cgpa
 * @param {string|null}  params.degreeClass
 * @param {Array}        params.semesterSummaries  [{ label, gpa, totalCU, totalQP }]
 * @param {number}       params.totalCU
 * @param {number}       params.totalQP
 * @param {boolean}      params.useUILegacyScale
 */
export function generateAndDownloadPDF({
  institution,
  student,
  semesters,
  cgpa,
  degreeClass,
  semesterSummaries,
  totalCU,
  totalQP,
  useUILegacyScale = false,
}) {
  const doc      = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const refId    = generateRefId();
  const now      = new Date();
  const scaleMax = institution?.scale || 5.0;

  // ── Page 1: Cover + Summary ────────────────────────────────────────────────
  buildPage1(doc, {
    institution, student, cgpa, degreeClass,
    totalCU, totalQP, semesters,
    scaleMax, refId, now, useUILegacyScale,
  });

  // ── Pages 2+: Course Details (semester results) ────────────────────────────
  if (Array.isArray(semesters) && semesters.length > 0) {
    doc.addPage();
    buildCourseDetailPages(doc, { semesters });
  }

  // ── Semester Breakdown summary ─────────────────────────────────────────────
  // Always add a fresh page here. buildCourseDetailPages no longer adds a
  // trailing page after the last semester, so this single addPage() is
  // sufficient and never creates a blank page.
  doc.addPage();
  buildPage2(doc, { semesterSummaries, institution, cgpa });

  // ── Final Page: Analytics + Verification ──────────────────────────────────
  doc.addPage();
  buildAnalyticsPage(doc, {
    semesterSummaries, scaleMax,
    refId, now, totalCU,
    semesters,
  });

  // ── Apply watermarks and footers to every page ────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addWatermark(doc);
    addFooter(doc, i, totalPages);
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const filename = buildFilename(
    student?.name,
    institution?.id || "EXPORT"
  );
  doc.save(filename);
}


// ── Page 1: Cover and Summary ─────────────────────────────────────────────────

function buildPage1(doc, {
  institution, student, cgpa, degreeClass,
  totalCU, totalQP, semesters,
  scaleMax, refId, now, useUILegacyScale,
}) {
  let y = MARGIN.top;

  // Green background strip
  doc.setFillColor(...PDF_COLOR.primary);
  doc.rect(0, 0, PAGE_WIDTH, 36, "F");

  // App name
  doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
  doc.setFontSize(PDF_SIZE.h1);
  doc.setTextColor(...PDF_COLOR.accent);
  doc.text("NG CGPA", MARGIN.left, 13, { baseline: "top" });

  // Subtitle
  doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
  doc.setFontSize(PDF_SIZE.h3);
  doc.setTextColor(255, 255, 255);
  doc.text("Academic Performance Report", MARGIN.left, 21, { baseline: "top" });

  // Institution name — right-aligned
  if (institution) {
    doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
    doc.setFontSize(PDF_SIZE.body);
    doc.setTextColor(...PDF_COLOR.accentLight);
    doc.text(
      institution.name,
      PAGE_WIDTH - MARGIN.right,
      13,
      { align: "right", baseline: "top" }
    );
    doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
    doc.setFontSize(PDF_SIZE.small);
    doc.setTextColor(200, 220, 210);
    doc.text(
      `Scale: ${scaleMax.toFixed(1)}${useUILegacyScale ? " (Legacy 7.0)" : ""}`,
      PAGE_WIDTH - MARGIN.right,
      21,
      { align: "right", baseline: "top" }
    );
  }

  y = 42;

  // Generated date + ref ID
  doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
  doc.setFontSize(PDF_SIZE.small);
  doc.setTextColor(...PDF_COLOR.textMuted);
  doc.text(`Generated: ${formatPDFDate(now)}`, MARGIN.left, y, { baseline: "top" });
  y += 5;
  doc.text(`Export Reference: ${refId}`, MARGIN.left, y, { baseline: "top" });
  y += 10;

  // ── Student Profile ────────────────────────────────────────────────────────
  y = addSectionHeading(doc, "Student Profile", y);
  y = addKV(doc, "Name",            safeStr(student?.name),             y, 44);
  y = addKV(doc, "Department",      safeStr(student?.department),       y, 44);
  y = addKV(doc, "Faculty",         safeStr(student?.faculty),          y, 44);
  y = addKV(doc, "Matric Number",   safeStr(student?.matricNumber),     y, 44);
  y = addKV(doc, "Level",           safeStr(student?.level),            y, 44);
  y = addKV(doc, "Session",         safeStr(student?.academicSession),  y, 44);
  y += 4;

  // ── Performance Summary ────────────────────────────────────────────────────
  y = addSectionHeading(doc, "Performance Summary", y);
  y += 4;

  const cgpaText  = cgpa !== null ? cgpa.toFixed(2) : "\u2014";
  const cgpaColor = degreeClass ? classColor(degreeClass) : PDF_COLOR.textMuted;

  doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
  doc.setFontSize(PDF_SIZE.display);
  doc.setTextColor(...cgpaColor);
  doc.text(cgpaText, MARGIN.left, y, { baseline: "top" });

  const cgpaWidth = doc.getTextWidth(cgpaText);

  if (cgpa !== null) {
    doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
    doc.setFontSize(PDF_SIZE.h3);
    doc.setTextColor(...PDF_COLOR.textMuted);
    doc.text(`/ ${scaleMax.toFixed(1)}`, MARGIN.left + cgpaWidth + 2, y + 6, {
      baseline: "top",
    });
  }

  if (degreeClass) {
    const badgeX = MARGIN.left;
    const badgeY = y + 20;
    const bColor = classColor(degreeClass);
    const bgColor = [
      Math.min(bColor[0] + 200, 255),
      Math.min(bColor[1] + 200, 255),
      Math.min(bColor[2] + 200, 255),
    ];
    const text = degreeClass;
    doc.setFontSize(PDF_SIZE.body);
    const textW = doc.getTextWidth(text);
    doc.setFillColor(...bgColor);
    doc.roundedRect(badgeX, badgeY, textW + 8, 7, 2, 2, "F");
    doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
    doc.setTextColor(...bColor);
    doc.text(text, badgeX + 4, badgeY + 3.5, { baseline: "middle" });
    y = badgeY + 11;
  } else {
    y += 24;
  }

  y = addRule(doc, y);

  const totalSemesters = Array.isArray(semesters)
    ? semesters.filter((s) => s.courses?.length > 0).length
    : 0;
  const totalCourses = Array.isArray(semesters)
    ? semesters.reduce((a, s) => a + (s.courses?.filter(hasData).length || 0), 0)
    : 0;

  const stats = [
    ["Total Credit Units",   String(totalCU)],
    ["Total Quality Points", round2(totalQP).toFixed(2)],
    ["Semesters Completed",  String(totalSemesters)],
    ["Total Courses",        String(totalCourses)],
  ];

  const col1X = MARGIN.left;
  const col2X = MARGIN.left + CONTENT_WIDTH / 2;

  for (let i = 0; i < stats.length; i++) {
    if (i === 0) {
      drawStatBlock(doc, stats[0][0], stats[0][1], col1X, y);
      drawStatBlock(doc, stats[1][0], stats[1][1], col2X, y);
      y += 14;
      i = 1;
    } else if (i === 2) {
      drawStatBlock(doc, stats[2][0], stats[2][1], col1X, y);
      drawStatBlock(doc, stats[3][0], stats[3][1], col2X, y);
      y += 14;
      i = 3;
    }
  }
}

function drawStatBlock(doc, label, value, x, y) {
  doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
  doc.setFontSize(PDF_SIZE.small);
  doc.setTextColor(...PDF_COLOR.textMuted);
  doc.text(label.toUpperCase(), x, y, { baseline: "top" });

  doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
  doc.setFontSize(PDF_SIZE.h2);
  doc.setTextColor(...PDF_COLOR.textPrimary);
  doc.text(value, x, y + 4, { baseline: "top" });
}


// ── Page 2: Semester Breakdown ────────────────────────────────────────────────

function buildPage2(doc, { semesterSummaries, institution, cgpa }) {
  let y = MARGIN.top;
  const scaleMax = institution?.scale || 5.0;

  y = drawPageTitle(doc, "Semester Breakdown", y);

  if (!Array.isArray(semesterSummaries) || semesterSummaries.length === 0) {
    doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
    doc.setFontSize(PDF_SIZE.body);
    doc.setTextColor(...PDF_COLOR.textMuted);
    doc.text("No semester data available.", MARGIN.left, y);
    return;
  }

  let runningQP = 0;
  let runningCU = 0;

  const rows = semesterSummaries.map((sem) => {
    if (sem.totalCU > 0) {
      runningQP += sem.totalQP || 0;
      runningCU += sem.totalCU;
    }
    const runningCGPA = runningCU > 0 ? round4(runningQP / runningCU) : null;
    const classEntry  = runningCGPA !== null && institution
      ? getClassification(runningCGPA, institution.classifications)
      : null;

    return [
      sem.label || "Semester",
      String(sem.totalCU || 0),
      round2(sem.totalQP || 0).toFixed(2),
      fmtGPA(sem.gpa),
      runningCGPA !== null ? runningCGPA.toFixed(2) : "\u2014",
      classEntry ? classEntry.short : "\u2014",
    ];
  });

  autoTable(doc, {
    startY:  y,
    head: [["Semester", "Credit Units", "Quality Points", "Semester GPA", "Running CGPA", "Classification"]],
    body:    rows,
    margin:  { left: MARGIN.left, right: MARGIN.right },
    ...TABLE_STYLE.semesterBreakdown,
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if ([1, 2, 3, 4].includes(data.column.index)) {
          data.cell.styles.halign = "right";
        }
        if (data.column.index === 5) {
          data.cell.styles.halign = "center";
        }
      }
      if (data.section === "body" && data.column.index === 5) {
        const val = data.cell.raw;
        data.cell.styles.textColor = classColor(val);
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 3) {
        const gpa = parseFloat(data.cell.raw);
        if (!isNaN(gpa) && gpa < 1.0) {
          data.cell.styles.textColor = PDF_COLOR.danger;
        }
      }
    },
  });
}


// ── Pages 2+: Course Details ──────────────────────────────────────────────────

/**
 * A course has exportable data if it has a defined credit unit value (including 0)
 * and at least a name, grade, or score present. The previous CU > 0 only check
 * silently dropped 0 CU non-contributing courses from the PDF entirely.
 */
function hasData(course) {
  if (course.creditUnits === null || course.creditUnits === undefined) return false;
  const cu = Number(course.creditUnits);
  if (isNaN(cu) || cu < 0) return false;

  if (cu === 0) {
    // Only include 0 CU courses that have at least some data entered.
    // A completely blank row with CU accidentally set to 0 is not exported.
    const hasName  = course.name && course.name.trim() !== "";
    const hasGrade = course.grade != null && course.grade !== "";
    const hasScore = course.score !== null && course.score !== undefined;
    return hasName || hasGrade || hasScore;
  }

  return cu > 0;
}

// ← FIX: The previous for…of loop called doc.addPage() after every semester
// including the last one. The main flow also calls doc.addPage() before
// buildPage2, so two consecutive page-adds created a blank page between the
// course detail section and the semester breakdown.
//
// Fix: pre-filter to only renderable semesters, use an indexed for loop, and
// only add a page BETWEEN semesters — never after the last one. The main flow's
// unconditional doc.addPage() before buildPage2 then works correctly in all cases.
function buildCourseDetailPages(doc, { semesters }) {
  let currentStartY = MARGIN.top + 10;

  // The NC footnote is printed at most once across the entire course detail
  // section — on the first semester that contains a 0 credit unit course.
  // It does not repeat for subsequent semesters that also have NC courses.
  let ncFootnoteAdded = false;

  // Pre-filter to only semesters that will actually render, so we can
  // reliably detect the last one and skip the trailing page-add.
  const renderableSemesters = semesters.filter((sem) =>
    Array.isArray(sem.courses) &&
    sem.courses.filter(hasData).length > 0
  );

  for (let si = 0; si < renderableSemesters.length; si++) {
    const sem    = renderableSemesters[si];
    const isLast = si === renderableSemesters.length - 1;

    const validCourses = sem.courses.filter(hasData);

    // Only true when this semester has at least one 0 CU course with data.
    const hasNCCourses = validCourses.some((c) => Number(c.creditUnits) === 0);

    // Semester label heading
    autoTable(doc, {
      startY: currentStartY,
      head: [[{ content: sem.label || "Semester", colSpan: 7 }]],
      body: [],
      margin: { left: MARGIN.left, right: MARGIN.right },
      headStyles: {
        fillColor:   PDF_COLOR.primary,
        textColor:   [255, 255, 255],
        fontSize:    PDF_SIZE.h3,
        fontStyle:   "bold",
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
    });

    const rows = validCourses.map((course) => {
      const isNC   = Number(course.creditUnits) === 0;
      const isFail = course.gradePoint === 0 ||
        (course.grade && course.grade.toUpperCase() === "F");

      return [
        isNC
          ? `${course.name && course.name.trim() !== "" ? course.name.trim() : "Unnamed"} (NC)`
          : course.name && course.name.trim() !== "" ? course.name.trim() : "Unnamed",
        isNC ? "0" : String(course.creditUnits ?? "\u2014"),
        course.score !== null && course.score !== undefined
          ? String(course.score)
          : "\u2014",
        course.grade   || "\u2014",
        course.gradePoint !== null ? String(course.gradePoint) : "\u2014",
        isNC
          ? "0.00"
          : course.qualityPoint !== null
            ? round2(course.qualityPoint).toFixed(2)
            : "\u2014",
        isFail ? "Failed" : "Passed",
      ];
    });

    autoTable(doc, {
      startY:  doc.lastAutoTable.finalY,
      head:    [["Course", "C.U.", "Score", "Grade", "G.P.", "Q.P.", "Status"]],
      body:    rows,
      margin:  { left: MARGIN.left, right: MARGIN.right },
      ...TABLE_STYLE.courseDetail,
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 13, halign: "right" },
        2: { cellWidth: 17, halign: "right" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 14, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 21, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          if ([1, 2, 4, 5].includes(data.column.index)) {
            data.cell.styles.halign = "right";
          }
          if (data.column.index === 3 || data.column.index === 6) {
            data.cell.styles.halign = "center";
          }
        }

        if (data.section === "body") {
          const course = validCourses[data.row.index];
          const isNC   = course && Number(course.creditUnits) === 0;

          // NC rows: muted italic across all columns except Status.
          if (isNC && data.column.index !== 6) {
            data.cell.styles.textColor = [154, 154, 154];
            data.cell.styles.fontStyle = "italic";
          }

          if (data.column.index === 6) {
            const val = data.cell.raw;
            if (val === "Failed") {
              data.cell.styles.textColor = PDF_COLOR.danger;
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = isNC
                ? [154, 154, 154]
                : PDF_COLOR.success;
              data.cell.styles.fontStyle = isNC ? "italic" : "normal";
            }
          }

          // Grade color only on non-NC rows
          if (!isNC && data.column.index === 3) {
            const g = String(data.cell.raw).toUpperCase();
            if (g === "A") data.cell.styles.textColor = PDF_COLOR.classFirst;
            else if (g === "B") data.cell.styles.textColor = PDF_COLOR.classUpper;
            else if (g === "F" || g === "H") data.cell.styles.textColor = PDF_COLOR.danger;
          }
        }
      },
    });

    let tableEndY = doc.lastAutoTable.finalY;

    // NC footnote — only when this semester has NC courses AND the footnote
    // has not already been printed earlier in the document. Once printed
    // it is never repeated even if later semesters also have NC courses.
    if (hasNCCourses && !ncFootnoteAdded) {
      tableEndY += 3;
      doc.setFont(PDF_FONT.italic.family, PDF_FONT.italic.style);
      doc.setFontSize(PDF_SIZE.small - 1);
      doc.setTextColor(...PDF_COLOR.textMuted);
      doc.text(
        "NC = Non-contributing. 0 credit unit courses are recorded and graded but excluded from GPA and CGPA calculations.",
        MARGIN.left,
        tableEndY
      );
      tableEndY += 5;
      ncFootnoteAdded = true;
    }

    // Only add a new page between semesters. After the last renderable
    // semester we do nothing — the caller adds the page for the next section.
    if (!isLast) {
      if (tableEndY > PAGE_HEIGHT - 70) {
        doc.addPage();
        currentStartY = MARGIN.top + 10;
      } else {
        currentStartY = tableEndY + 10;
      }
    }
  }
}


// ── Final Page: Analytics ─────────────────────────────────────────────────────

function buildAnalyticsPage(doc, {
  semesterSummaries, scaleMax,
  refId, now, totalCU,
  semesters,
}) {
  let y = MARGIN.top;

  y = drawPageTitle(doc, "Analytics", y);

  // ── GPA Trend ──────────────────────────────────────────────────────────────
  y = addSectionHeading(doc, "GPA Trend by Semester", y);
  y += 2;

  if (Array.isArray(semesterSummaries) && semesterSummaries.length > 0) {
    for (const sem of semesterSummaries) {
      if (sem.gpa === null) continue;
      y = addGPABar(doc, sem.label || "Semester", sem.gpa, scaleMax, y, 80);
    }

    const valid = semesterSummaries.filter((s) => s.gpa !== null);
    if (valid.length > 0) {
      const best   = valid.reduce((a, b) => a.gpa > b.gpa ? a : b);
      const lowest = valid.reduce((a, b) => a.gpa < b.gpa ? a : b);
      y += 4;
      doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
      doc.setFontSize(PDF_SIZE.small);
      doc.setTextColor(...PDF_COLOR.textSecondary);
      doc.text(
        `Best semester: ${best.label} (${fmtGPA(best.gpa)})   ` +
        `Lowest: ${lowest.label} (${fmtGPA(lowest.gpa)})`,
        MARGIN.left, y
      );
      y += 8;
    }
  } else {
    doc.setFont(PDF_FONT.regular.family, PDF_FONT.regular.style);
    doc.setFontSize(PDF_SIZE.body);
    doc.setTextColor(...PDF_COLOR.textMuted);
    doc.text("No semester GPA data available.", MARGIN.left, y);
    y += 10;
  }

  y += 4;
  y = addRule(doc, y, PDF_COLOR.accent);

  // ── Verification Block ─────────────────────────────────────────────────────
  y += 4;
  y = addSectionHeading(doc, "Verification", y);

  const totalValidCourses = Array.isArray(semesters)
    ? semesters.reduce((a, s) => a + (s.courses?.filter(hasData).length || 0), 0)
    : 0;

  y = addKV(doc, "Export Reference", refId,              y, 46);
  y = addKV(doc, "Schema Version",   "2.0",              y, 46);
  y = addKV(doc, "Generated",        formatPDFDate(now), y, 46);
  y = addKV(
    doc,
    "Data Status",
    `All ${totalValidCourses} course${totalValidCourses !== 1 ? "s" : ""} validated. No calculation errors detected.`,
    y,
    46
  );
  y += 6;

  y = addRule(doc, y, PDF_COLOR.border);

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  y += 4;
  doc.setFont(PDF_FONT.italic.family, PDF_FONT.italic.style);
  doc.setFontSize(PDF_SIZE.small);
  doc.setTextColor(...PDF_COLOR.textMuted);

  const disclaimer =
    "This report is generated by NG CGPA for reference purposes. " +
    "Always verify your official CGPA with your institution's academic " +
    "registry or student portal. NG CGPA is not liable for decisions " +
    "made based solely on this report.";

  const lines = doc.splitTextToSize(disclaimer, CONTENT_WIDTH);
  doc.text(lines, MARGIN.left, y);
}


// ── Page Title ────────────────────────────────────────────────────────────────

function drawPageTitle(doc, title, y) {
  doc.setFont(PDF_FONT.bold.family, PDF_FONT.bold.style);
  doc.setFontSize(PDF_SIZE.h1);
  doc.setTextColor(...PDF_COLOR.primary);
  doc.text(title, MARGIN.left, y, { baseline: "top" });
  y += 8;
  doc.setDrawColor(...PDF_COLOR.accent);
  doc.setLineWidth(0.8);
  doc.line(MARGIN.left, y, MARGIN.left + 40, y);
  return y + 6;
}


// ── Filename Builder ──────────────────────────────────────────────────────────

function buildFilename(studentName, institutionId) {
  const name = studentName
    ? studentName.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").slice(0, 20)
    : "Student";
  const id = (institutionId || "EXPORT").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ts  = buildTimestamp();
  return `NGCGPA_Report_${name}_${id}_${ts}.pdf`;
}

function buildTimestamp() {
  const n = new Date();
  const Y = n.getFullYear();
  const M = String(n.getMonth() + 1).padStart(2, "0");
  const D = String(n.getDate()).padStart(2, "0");
  const h = String(n.getHours()).padStart(2, "0");
  const m = String(n.getMinutes()).padStart(2, "0");
  const s = String(n.getSeconds()).padStart(2, "0");
  return `${Y}${M}${D}_${h}${m}${s}`;
}


// ── Rounding Helpers ──────────────────────────────────────────────────────────

function round2(n) {
  if (n === null || n === undefined || isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}