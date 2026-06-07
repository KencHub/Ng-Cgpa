// ── HelpTopics.js ─────────────────────────────────────────────────────────────
// Static content for the offline Help Centre.
// No imports. Pure data. Written for Nigerian university students on
// the NUC 5.0, 4.0, and UI legacy 7.0 grading scales.


export const HELP_TOPICS = [

  // ── 1. What is GPA ──────────────────────────────────────────────────────────
  {
    id:        "what-is-gpa",
    title:     "What is GPA?",
    category:  "calculations",
    shortDesc: "How your semester Grade Point Average is calculated.",
    keywords:  ["gpa", "grade point average", "quality points", "credit units", "semester"],
    sections: [
      {
        type: "text",
        content:
          "GPA (Grade Point Average) summarises your academic performance in a single semester. " +
          "It is computed by dividing the total quality points you earned in that semester by " +
          "the total credit units you attempted.",
      },
      {
        type: "formula",
        label: "Semester GPA Formula",
        formula: "GPA  =  Σ (Credit Units × Grade Point)  ÷  Σ Credit Units",
      },
      {
        type: "text",
        content:
          "Quality points are earned per course. For each course, multiply the credit units " +
          "assigned to that course by the grade point you received. A higher grade point and " +
          "a higher credit unit load both increase your quality point total. This is why " +
          "high-unit courses have a much larger influence on your GPA than low-unit ones.",
      },
      {
        type: "example",
        title: "Worked Example (5.0 Scale)",
        table: {
          headers: ["Course", "Credit Units", "Score", "Grade", "Grade Point", "Quality Points"],
          rows: [
            ["MTH101", "3", "75", "A", "5", "15"],
            ["ENG102", "2", "63", "B", "4", "8"],
            ["PHY103", "4", "52", "C", "3", "12"],
            ["CHM104", "3", "41", "E", "1", "3"],
          ],
          footer: ["Total", "12 CU", "", "", "", "38 QP"],
        },
        result: "GPA = 38 ÷ 12 = 3.17  (Second Class Lower on 5.0 scale)",
      },
      {
        type: "tip",
        content:
          "A course with 4 credit units affects your GPA four times as much as a 1-unit course. " +
          "Always prioritise high-credit-unit courses when deciding where to focus your study time.",
      },
    ],
  },


  // ── 2. How CGPA is Calculated ────────────────────────────────────────────────
  {
    id:        "how-cgpa-works",
    title:     "How CGPA is Calculated",
    category:  "calculations",
    shortDesc: "The correct formula and why averaging semester GPAs is wrong.",
    keywords:  ["cgpa", "cumulative", "calculation", "formula", "average", "wrong"],
    sections: [
      {
        type: "text",
        content:
          "CGPA (Cumulative Grade Point Average) measures your overall academic performance " +
          "across every semester you have studied. The correct formula is the same as semester " +
          "GPA but applied to all your semesters combined:",
      },
      {
        type: "formula",
        label: "CGPA Formula",
        formula:
          "CGPA  =  Σ (All Quality Points, every semester)\n" +
          "         ─────────────────────────────────────────\n" +
          "         Σ (All Credit Units, every semester)",
      },
      {
        type: "warning",
        content:
          "CGPA is not the average of your semester GPAs. That method produces an incorrect " +
          "result whenever your semesters have different credit unit totals, which is almost " +
          "always the case.",
      },
      {
        type: "comparison",
        title: "Why averaging GPAs is wrong",
        correct: {
          label: "Correct Method",
          steps: [
            "Semester 1: 12 CU, GPA 4.50  →  54 quality points",
            "Semester 2: 24 CU, GPA 3.00  →  72 quality points",
            "Total: 36 CU, 126 QP",
            "CGPA = 126 ÷ 36 = 3.50",
          ],
        },
        incorrect: {
          label: "Wrong Method",
          steps: [
            "(4.50 + 3.00) ÷ 2 = 3.75",
            "",
            "",
            "This ignores the fact that Semester 2 had twice as many credit units.",
          ],
        },
        note:
          "The correct CGPA is 3.50, not 3.75. Semester 2 carries more weight because it " +
          "had more credit units. The averaging method gives them equal weight, which is " +
          "mathematically wrong.",
      },
      {
        type: "text",
        content:
          "This app always uses the correct formula. The CGPA you see is the true weighted " +
          "total of all your quality points divided by all your credit units.",
      },
      {
        type: "tip",
        content:
          "Your CGPA is hardest to move in your final year because you have already accumulated " +
          "many credit units. One semester of As in year four cannot undo three years of Cs. " +
          "Start strong and stay consistent.",
      },
    ],
  },


  // ── 3. What-if Mode ──────────────────────────────────────────────────────────
  {
    id:        "what-if-mode",
    title:     "What-if Mode",
    category:  "features",
    shortDesc: "Test hypothetical grades and see how they would affect your CGPA.",
    keywords:  ["what if", "hypothetical", "simulate", "test", "grades", "cgpa change", "scenario"],
    sections: [
      {
        type: "text",
        content:
          "What-if Mode lets you pick alternative grades for your courses and instantly see " +
          "how your CGPA would change, without touching your real data. Nothing is saved or " +
          "modified. When you exit What-if Mode, everything goes back to exactly how it was.",
      },
      {
        type: "steps",
        title: "How to use it",
        items: [
          "Open any semester and tap the 'What-if Mode' button above the course list.",
          "A second grade selector (highlighted in orange) appears below each real grade.",
          "Pick a hypothetical grade from the orange selector. The GP and QP columns update instantly.",
          "The amber 'What-if' block in the CGPA panel on the right shows your new CGPA, " +
          "the difference from your current CGPA, and your new degree class.",
          "On mobile and tablet, the what-if semester GPA also appears in the semester header " +
          "so you do not need to scroll down.",
          "When you are done, tap 'Exit What-if' to go back to your real data.",
        ],
      },
      {
        type: "list",
        title: "What it is good for",
        items: [
          "Checking how much a failed course is hurting your CGPA before you decide to retake it.",
          "Seeing what grade you would need in a specific course to cross a classification boundary.",
          "Testing scenarios before your exams, for example: 'If I get a B in this course and " +
          "a C in that one, where does my CGPA land?'",
          "Understanding which courses have the biggest impact based on their credit units.",
        ],
      },
      {
        type: "tip",
        content:
          "You can set what-if grades on multiple courses at the same time. The CGPA panel " +
          "recalculates continuously as you make changes.",
      },
      {
        type: "warning",
        content:
          "What-if grades do not affect your real data at all. The orange selectors are " +
          "separate from your actual grade inputs. Exiting What-if Mode clears all hypothetical " +
          "selections.",
      },
    ],
  },


  // ── 4. Carryover Priority Ranker ─────────────────────────────────────────────
  {
    id:        "carryover-ranker",
    title:     "Carryover Priority Ranker",
    category:  "features",
    shortDesc: "Ranks your failed courses by how much retaking each one would improve your CGPA.",
    keywords:  ["carryover", "failed", "retake", "rank", "priority", "f grade", "cgpa impact"],
    sections: [
      {
        type: "text",
        content:
          "If you have any failed courses (F grade), the Carryover Priority panel appears in " +
          "the right column. It ranks every failed course by how much your CGPA would improve " +
          "if you retake it and pass. The course at the top has the biggest impact.",
      },
      {
        type: "text",
        content:
          "For each failed course, the panel shows the exact CGPA you would reach at each " +
          "possible passing grade, along with the gain. If retaking a course would push you " +
          "into a higher degree class, that is highlighted clearly.",
      },
      {
        type: "list",
        title: "How the ranking works",
        items: [
          "The app scans all your semesters for courses with an F grade and credit units above zero.",
          "For each failed course, it calculates your new CGPA at every available passing grade " +
          "(E, D, C, B, A on the 5.0 scale).",
          "Courses are sorted from highest CGPA gain to lowest, based on the gain from the " +
          "minimum passing grade.",
          "A course worth 4 credit units will generally rank higher than a 1-unit course with " +
          "the same grade, because more credit units means more quality points gained.",
        ],
      },
      {
        type: "tip",
        content:
          "Focus on the top-ranked course first. That is the retake that moves your CGPA the most " +
          "for the same effort. The panel updates automatically whenever you change a grade.",
      },
      {
        type: "warning",
        content:
          "The panel calculates gain assuming the retake adds quality points without adding new " +
          "credit units, which is the standard policy at most Nigerian universities. If your " +
          "institution counts retake credit units separately, verify with your registry.",
      },
    ],
  },


  // ── 5. Import Format Guide (paste) ───────────────────────────────────────────
  {
    id:        "import-guide",
    title:     "Importing Courses by Pasting",
    category:  "features",
    shortDesc: "How to paste multiple courses at once using the bulk import.",
    keywords:  ["import", "paste", "bulk", "format", "score", "grade", "csv", "text"],
    sections: [
      {
        type: "text",
        content:
          "Instead of entering courses one by one, you can paste your results as text directly " +
          "from your student portal, result sheet, or any document. The app automatically detects " +
          "whether each line contains a score or a grade letter.",
      },
      {
        type: "steps",
        title: "How to import",
        items: [
          "Click the Import button in the header to open the import panel.",
          "Select which semester to add the courses to, or choose 'Create new semester'.",
          "Paste your results in the text area. One course per line.",
          "The live preview shows which courses will be imported and any skipped lines.",
          "Click 'Import Courses' to confirm.",
        ],
      },
      {
        type: "formula",
        label: "Score format",
        formula: "CourseName, CreditUnits, Score\n\nExample:\nMTH101, 3, 75\nENG102, 2, 68\nCHM103, 4, 52",
      },
      {
        type: "formula",
        label: "Grade format",
        formula: "CourseName, CreditUnits, Grade\n\nExample:\nMTH101, 3, A\nENG102, 2, B\nCHM103, 4, C",
      },
      {
        type: "tip",
        content:
          "Both formats can be mixed in the same paste. Each line is detected independently. " +
          "If a line cannot be parsed, it is skipped and listed in the preview with the reason.",
      },
      {
        type: "list",
        title: "Rules",
        items: [
          "Credit units must be a whole number between 1 and 6.",
          "Scores must be between 0 and 100. Decimal scores are rounded.",
          "Grade letters must match your institution's official grading table.",
          "Lines with fewer than three fields are skipped.",
          "Course names can be up to 50 characters.",
        ],
      },
    ],
  },


  // ── 6. File Import Guide (Excel / PDF) ───────────────────────────────────────
  {
    id:        "file-import-guide",
    title:     "Importing from Excel or PDF",
    category:  "features",
    shortDesc: "Upload your transcript file to import all semesters at once.",
    keywords:  [
      "excel", "xlsx", "xls", "pdf", "file", "upload", "transcript",
      "semester detection", "student portal", "digital pdf",
    ],
    sections: [
      {
        type: "text",
        content:
          "If your student portal can export results as an Excel spreadsheet or a digital PDF, " +
          "you can upload that file directly. The parser reads the document, detects semester " +
          "blocks, extracts course codes, credit units, and grades automatically, then shows " +
          "you a review before importing anything.",
      },
      {
        type: "steps",
        title: "How to import a file",
        items: [
          "Click the Import button in the header.",
          "Switch to the 'Import from file' tab.",
          "Click 'Excel (.xlsx)' or 'PDF transcript' to select your file.",
          "Wait a moment while the parser detects columns and semester labels.",
          "Review the preview. If multiple semesters are detected, each one is shown separately " +
          "with its course list.",
          "Click 'Import X Courses' to proceed to the diff review.",
          "Confirm to add the courses to your existing data.",
        ],
      },
      {
        type: "list",
        title: "What gets detected automatically",
        items: [
          "Semester labels: text like '100L First Semester' or '2nd Semester' is recognised and " +
          "used as the semester name.",
          "Course codes: standard Nigerian course codes like MTH101 and ENG201 are detected even " +
          "if other text appears on the same row.",
          "Credit units: parsed from the credit unit or CU column.",
          "Grades: letter grades (A, B, C...) and numeric scores (0 to 100) are both accepted.",
          "GPA printed on the transcript: stored for your reference, not used in place of the " +
          "calculated GPA.",
        ],
      },
      {
        type: "warning",
        content:
          "Only digital (text-based) PDFs are supported. A scanned transcript saved as PDF is " +
          "an image inside a PDF container and the parser cannot read images. If your file is " +
          "a scan, use the paste method instead after manually entering the results.",
      },
      {
        type: "tip",
        content:
          "To get a digital PDF from your student portal: open your result page in a browser, " +
          "then use File, Print and choose 'Save as PDF' or 'Microsoft Print to PDF' as the " +
          "printer. Do not scan a printed paper result because that produces an image, not a " +
          "text PDF. A properly generated PDF is usually under 500 KB.",
      },
      {
        type: "list",
        title: "Excel column requirements",
        items: [
          "The spreadsheet must have a column for course code (or 'Course').",
          "It must have a column for credit units (CU, Credit Hours, or Units).",
          "It must have a column for grade (letter) or score (number).",
          "Column headers are detected automatically. The exact name does not need to match " +
          "perfectly, but it should be recognisable.",
          "Data can start on any row within the first 20 rows.",
        ],
      },
    ],
  },


  // ── 7. Grade Projections Guide ───────────────────────────────────────────────
  {
    id:        "grade-projections",
    title:     "Using Grade Projections",
    category:  "features",
    shortDesc: "How the target CGPA calculator and grade mix work.",
    keywords:  [
      "projection", "target cgpa", "grade mix", "required gpa", "remaining semesters",
      "forward simulation", "feasibility", "achievable",
    ],
    sections: [
      {
        type: "text",
        content:
          "The Grade Projections panel has two calculators. The first works backwards from a " +
          "target CGPA to tell you what GPA you need each remaining semester. The second works " +
          "forward to show you what your CGPA will be if you achieve a specific GPA next semester.",
      },
      {
        type: "steps",
        title: "Backward projection: finding your required GPA",
        items: [
          "Enter your target CGPA (for example, 4.50 for First Class on the 5.0 scale).",
          "Enter the number of semesters you have remaining before graduation.",
          "Enter the estimated credit units you will take each semester (18 is typical).",
          "The required GPA per semester appears immediately.",
          "The feasibility rating tells you how realistic that GPA is.",
          "The Grade Mix section shows roughly what proportion of As, Bs, and Cs would " +
          "achieve that GPA.",
        ],
      },
      {
        type: "text",
        content:
          "The Grade Mix is calculated from your institution's grade table. For example, if " +
          "you need a 3.80 GPA on a 5.0 scale, the mix shows roughly 80% Bs and 20% Cs, " +
          "which is about 5 Bs and 1 C in a typical 6-course semester. Two alternatives may " +
          "appear when different grade combinations achieve the same result.",
      },
      {
        type: "tip",
        content:
          "The course count estimate assumes an average of 3 credit units per course. If your " +
          "courses carry more or fewer units on average, the percentage split is still accurate " +
          "and only the count estimate changes.",
      },
      {
        type: "steps",
        title: "Forward simulation: What If?",
        items: [
          "Enter the GPA you expect to achieve next semester.",
          "Leave the CU field blank to use your estimated CU from above, or enter a specific number.",
          "Your projected CGPA after that semester appears instantly, along with the change from " +
          "your current CGPA and your new degree class.",
        ],
      },
      {
        type: "list",
        title: "Feasibility ratings",
        items: [
          "Achievable: the required GPA is 75% or less of the scale maximum. Consistent " +
          "performance gets you there.",
          "Challenging: the required GPA is between 75% and 90% of the scale max. Strong " +
          "performance is needed every semester.",
          "Very Challenging: the required GPA is above 90% of the scale max. Near-perfect " +
          "results are needed in every course.",
          "Not Achievable: even with the maximum grade in every course for every remaining " +
          "semester, the target cannot be reached.",
        ],
      },
      {
        type: "warning",
        content:
          "Projections are based on your estimated credit load per semester. If your actual " +
          "credit load changes significantly, re-run the calculation with the updated number.",
      },
    ],
  },


  // ── 8. Export Guide ──────────────────────────────────────────────────────────
  {
    id:        "export-guide",
    title:     "Exporting Your Results",
    category:  "features",
    shortDesc: "PDF reports, JSON backups, plain-text summaries, and WhatsApp sharing.",
    keywords:  ["export", "pdf", "json", "text", "backup", "report", "download", "whatsapp", "share"],
    sections: [
      {
        type: "text",
        content:
          "NG CGPA can generate several types of output from your data. All exports happen " +
          "entirely in your browser and no data is sent to any server.",
      },
      {
        type: "list",
        title: "Export formats",
        items: [
          "PDF Report: a professional multi-page academic summary with your full course breakdown, " +
          "GPA trend, and a verification reference ID. Suitable for scholarship applications and " +
          "academic records.",
          "JSON Backup: a complete export of your session in a structured file. This can be " +
          "imported back into NG CGPA at any time, on any device. Use this to back up your data " +
          "or transfer it between browsers.",
          "Copy Text Summary: a plain-text version of your CGPA summary, formatted for readability. " +
          "Paste it into an email, a form field, or anywhere that accepts plain text.",
          "Download Text Summary: saves the same plain-text summary as a .txt file to your device.",
          "Share to WhatsApp: opens WhatsApp with your result summary already typed in, " +
          "formatted with bold text and emoji so it looks clean when you send it. No need to " +
          "copy and paste manually.",
        ],
      },
      {
        type: "steps",
        title: "To export",
        items: [
          "Click the Export button in the top-right of the header.",
          "Choose your preferred format from the dropdown.",
          "For PDF and JSON, your browser will trigger a file download.",
          "For text options, copy or download as needed.",
          "For WhatsApp, the app opens the WhatsApp share screen with your summary pre-filled.",
        ],
      },
      {
        type: "tip",
        content:
          "Export a JSON backup regularly so you do not lose your data if you clear your browser " +
          "cache or switch devices. JSON exports include everything: semesters, courses, student " +
          "profile, and projection settings.",
      },
      {
        type: "steps",
        title: "To restore a JSON backup",
        items: [
          "Click the Export button in the header.",
          "Choose 'Import Session (JSON)'.",
          "Select the .json file you previously exported.",
          "Your full session, including all semesters, courses, and settings, is restored.",
        ],
      },
    ],
  },


  // ── 9. Grading System Guide ──────────────────────────────────────────────────
  {
    id:        "grading-systems",
    title:     "Nigerian University Grading Systems",
    category:  "reference",
    shortDesc: "The three grading scales used across supported institutions.",
    keywords:  ["scale", "5.0", "4.0", "7.0", "nuc", "grading", "classification", "legacy", "ui"],
    sections: [
      {
        type: "text",
        content:
          "Nigerian universities use one of three grading scales. The scale your institution " +
          "uses is shown in the header next to the institution name. NG CGPA automatically " +
          "applies the correct scale when you select your university.",
      },
      {
        type: "table",
        title: "NUC 5.0 Scale (most federal and state universities)",
        headers: ["Grade", "Score Range", "Points", "Remark"],
        rows: [
          ["A", "70 – 100", "5", "Excellent"],
          ["B", "60 – 69",  "4", "Very Good"],
          ["C", "50 – 59",  "3", "Good"],
          ["D", "45 – 49",  "2", "Pass"],
          ["E", "40 – 44",  "1", "Marginal Pass"],
          ["F", "0 – 39",   "0", "Fail"],
        ],
        note: "Pass mark: 40%. Used by UNIZIK, UNILAG, OAU, UNN, ABU, UNIPORT, and others.",
      },
      {
        type: "table",
        title: "4.0 Scale (private universities and UI from 2016/2017)",
        headers: ["Grade", "Score Range", "Points", "Remark"],
        rows: [
          ["A", "70 – 100", "4", "Excellent"],
          ["B", "60 – 69",  "3", "Very Good"],
          ["C", "50 – 59",  "2", "Good"],
          ["D", "45 – 49",  "1", "Pass"],
          ["F", "0 – 44",   "0", "Fail"],
        ],
        note: "Pass mark: 45%. Used by Covenant, Babcock, Bowen, AUN, UI (from 2016/2017), and others.",
      },
      {
        type: "table",
        title: "Legacy 7.0 Scale (University of Ibadan, pre-2016/2017 students only)",
        headers: ["Grade", "Score Range", "Points", "Remark"],
        rows: [
          ["A", "70 – 100", "7", "Excellent"],
          ["B", "60 – 69",  "6", "Very Good"],
          ["C", "55 – 59",  "5", "Good"],
          ["D", "50 – 54",  "4", "Credit"],
          ["E", "45 – 49",  "3", "Pass"],
          ["F", "40 – 44",  "2", "Marginal"],
          ["G", "35 – 39",  "1", "Conceded Pass"],
          ["H", "0 – 34",   "0", "Fail"],
        ],
        note:
          "Only available when University of Ibadan is selected. Activate the legacy toggle " +
          "if you were admitted before the 2016/2017 academic session.",
      },
      {
        type: "table",
        title: "Degree Classifications: NUC 5.0 Scale",
        headers: ["CGPA Range", "Class"],
        rows: [
          ["4.50 – 5.00", "First Class Honours"],
          ["3.50 – 4.49", "Second Class Honours Upper Division (2:1)"],
          ["2.40 – 3.49", "Second Class Honours Lower Division (2:2)"],
          ["1.50 – 2.39", "Third Class Honours"],
          ["1.00 – 1.49", "Pass"],
          ["0.00 – 0.99", "No Degree Awarded"],
        ],
      },
      {
        type: "table",
        title: "Degree Classifications: 4.0 Scale",
        headers: ["CGPA Range", "Class"],
        rows: [
          ["3.50 – 4.00", "First Class Honours"],
          ["3.00 – 3.49", "Second Class Honours Upper Division (2:1)"],
          ["2.00 – 2.99", "Second Class Honours Lower Division (2:2)"],
          ["1.00 – 1.99", "Third Class Honours"],
          ["0.00 – 0.99", "No Degree Awarded"],
        ],
      },
      {
        type: "warning",
        content:
          "NUC proposed a mandatory switch to the 4.0 scale for all universities in 2017/2018 " +
          "but did not complete the transition. If your school is listed as 5.0, that is still " +
          "your official scale.",
      },
    ],
  },


  // ── 10. FAQ ──────────────────────────────────────────────────────────────────
  {
    id:        "faq",
    title:     "Frequently Asked Questions",
    category:  "reference",
    shortDesc: "Answers to common questions about CGPA, features, and this app.",
    keywords:  [
      "faq", "question", "carryover", "improve", "fail", "retake",
      "first class", "borderline", "credit", "supplementary", "quality points",
      "excel", "pdf", "grade mix", "offline", "history", "cache",
      "what if", "whatsapp", "share", "ranker",
    ],
    sections: [
      {
        type: "faq",
        questions: [
          {
            q: "What is the difference between GPA and CGPA?",
            a: "GPA (Grade Point Average) is for one semester only. CGPA (Cumulative GPA) " +
               "covers all your semesters from first year to now. Your CGPA is what determines " +
               "your degree classification at graduation.",
          },
          {
            q: "My university's student portal shows a different CGPA. Why?",
            a: "The most common reason is that your portal includes pending, deferred, or " +
               "incomplete results that change the calculation. Also verify that you have selected " +
               "the correct institution and entered all courses accurately. If the grade table " +
               "differs, use the Custom School option.",
          },
          {
            q: "How does a failed course affect my CGPA?",
            a: "An F grade contributes 0 quality points but its credit units are still added to " +
               "your total credit unit count, which is the denominator of your CGPA. This pulls " +
               "your CGPA down in two ways: it adds nothing to the numerator while increasing the " +
               "denominator. The more credit units the course carries, the larger the damage.",
          },
          {
            q: "What happens when I retake a carryover?",
            a: "When you retake a failed course and pass it, the new grade replaces or supplements " +
               "the original in the calculation, depending on your institution's policy. Most " +
               "Nigerian universities use the better of the two grades. The credit units are not " +
               "counted twice because they were already in your total from the first attempt. " +
               "Every quality point gained from the retake goes directly toward improving your CGPA.",
          },
          {
            q: "What is the Carryover Priority Ranker?",
            a: "It is a panel in the right column that appears automatically whenever you have any " +
               "failed courses. It ranks every failed course by how much your CGPA would improve if " +
               "you retake it and pass. The top-ranked course is the one that moves your CGPA the " +
               "most. It shows the exact new CGPA you would reach at each grade (E, D, C, B, A) and " +
               "flags any case where retaking the course would push you into a higher degree class.",
          },
          {
            q: "What is What-if Mode?",
            a: "What-if Mode lets you pick hypothetical grades for your courses and see instantly " +
               "how your CGPA would change, without modifying your real data. Tap the 'What-if Mode' " +
               "button above the course list to activate it. An orange selector appears under each " +
               "real grade. Pick any grade and the CGPA panel updates immediately. When you exit " +
               "What-if Mode, all selections are cleared and your real data is unchanged.",
          },
          {
            q: "How is What-if Mode different from the Carryover Ranker?",
            a: "The Carryover Ranker only covers failed courses and works automatically. It shows " +
               "you a ranked list of retake priorities without you doing anything. What-if Mode is " +
               "manual: you pick which courses to change and what grades to test. You can use it on " +
               "any course, not just failed ones. They work well together: use the ranker to see " +
               "which retake matters most, then use What-if Mode to explore specific scenarios.",
          },
          {
            q: "Can I share my CGPA result on WhatsApp?",
            a: "Yes. Open the Export menu in the header and choose 'Share to WhatsApp'. The app " +
               "builds a formatted summary with your CGPA, class, semester breakdown, and student " +
               "details, then opens WhatsApp with the text already filled in. You just choose who " +
               "to send it to.",
          },
          {
            q: "What is First Class Honours and how do I achieve it?",
            a: "First Class Honours requires a final CGPA of 4.50 or above on the 5.0 scale, or " +
               "3.50 or above on the 4.0 scale. Achieving it requires mostly A grades consistently " +
               "across all semesters. Even one semester of mostly Cs can make First Class very " +
               "difficult to recover from later, especially in final year when each new semester " +
               "carries less weight.",
          },
          {
            q: "What CGPA do I need to avoid having no degree awarded?",
            a: "On the 5.0 NUC scale, you need a CGPA of at least 1.00 to receive a degree. A " +
               "CGPA below 1.00 results in no degree being awarded. On the 4.0 scale, the same " +
               "threshold applies. If your CGPA is below 1.50, focus entirely on passing courses " +
               "before aiming for higher grades.",
          },
          {
            q: "How many credit units are typical per semester?",
            a: "Most Nigerian university semesters carry between 15 and 24 credit units. Technology " +
               "and science-based programmes often carry more due to laboratory practicals which " +
               "carry additional units. If your semester total is below 6 or above 30, verify your " +
               "entries and the app will show a warning.",
          },
          {
            q: "Can high-credit-unit courses hurt my CGPA more?",
            a: "Yes. A 4-unit course has four times the weight of a 1-unit course in your CGPA " +
               "calculation. Failing a 4-unit course does four times the damage of failing a 1-unit " +
               "elective. Similarly, excelling in a 4-unit course moves your CGPA more than excelling " +
               "in a 1-unit course.",
          },
          {
            q: "What does 'borderline' mean?",
            a: "Borderline means your CGPA is within 0.10 grade points of a classification boundary. " +
               "For example, 3.41 on a 5.0 scale is borderline for a 2:1, which starts at 3.50. At " +
               "this point, one or two strong semesters can cross the boundary. Some universities " +
               "apply discretionary upgrades for borderline students with strong final-year " +
               "performance, but do not rely on this. Aim to cross the boundary on merit.",
          },
          {
            q: "How do I move from a 2:2 to a 2:1?",
            a: "The exact required GPA per remaining semester depends on your current CGPA, remaining " +
               "semesters, and expected credit load. Use the Projection Panel in the app: enter 3.50 " +
               "as your target (5.0 scale), your remaining semesters, and your estimated credit units " +
               "per semester. The app will calculate precisely what you need each semester and show " +
               "the grade mix.",
          },
          {
            q: "Can I improve my CGPA significantly in final year?",
            a: "It becomes harder to move your CGPA significantly in final year because you have " +
               "accumulated many credit units. The new semesters represent a smaller fraction of " +
               "your total. A student with 80 credit units who earns 20 more in final year is adding " +
               "20% new weight. Use the Projection Panel to see your realistic maximum reachable CGPA.",
          },
          {
            q: "What is a Supplementary Examination?",
            a: "A supplementary exam (also called a resit) is an additional examination opportunity " +
               "given to students who failed a course. Passing the supplementary replaces the original " +
               "failing grade in most institutions. Enter the better grade in this app and the old " +
               "failing grade no longer applies.",
          },
          {
            q: "Does attendance affect my CGPA?",
            a: "Attendance itself is not part of the GPA calculation. However, most Nigerian " +
               "universities require 75% lecture attendance to be eligible to sit the final " +
               "examination. If you miss this threshold, you may be barred from the exam, resulting " +
               "in an automatic fail, which does affect your CGPA.",
          },
          {
            q: "How is University of Ibadan different from other universities?",
            a: "UI switched from a 7.0 grading scale to a 4.0 scale starting from the 2016/2017 " +
               "academic session. Students admitted before that session remain on the legacy 7.0 " +
               "scale. When you select UI in this app, activate the legacy toggle if you were " +
               "admitted before 2016/2017.",
          },
          {
            q: "What is the difference between the 5.0 and 4.0 scale?",
            a: "Both scales use the same score boundaries (A starts at 70) but assign different " +
               "maximum grade points. On the 5.0 scale, an A is worth 5 points. On the 4.0 scale, " +
               "an A is worth 4. The classification thresholds also differ: First Class starts at " +
               "4.50 on the 5.0 scale but 3.50 on the 4.0 scale. You cannot compare a 3.80 on a " +
               "5.0 scale with a 3.80 on a 4.0 scale because they represent very different " +
               "academic standings.",
          },
          {
            q: "Can I use this app for a scholarship or transcript application?",
            a: "The PDF export produces a professional report with a unique reference ID, export " +
               "timestamp, full course breakdown, and a data validation statement. However, always " +
               "verify your CGPA with your institution's official registry or student portal before " +
               "submitting any formal application. NG CGPA is a planning and tracking tool, not an " +
               "official transcript.",
          },
          {
            q: "What is Custom School mode?",
            a: "If your university is not in the list of supported institutions, select 'Custom " +
               "University' at the bottom of the institution list. You can then set your own scale " +
               "maximum, grade boundaries, and classification thresholds to match your institution's " +
               "official handbook.",
          },
          {
            q: "How do I copy my results from my student portal?",
            a: "Most student portals display results in a table. Copy the relevant columns (course " +
               "code, credit units, score or grade) and paste them into the Import modal. You may " +
               "need to clean up the format: one course per line, fields separated by commas. The " +
               "format guide in the import modal shows exactly what the app expects.",
          },
          {
            q: "I entered a score wrong. Can I correct it?",
            a: "Yes. Click directly on the score field in any course row and type the correct score. " +
               "The grade and quality points update automatically as soon as you change the value. " +
               "Your CGPA recalculates instantly.",
          },
          {
            q: "What does 'Quality Points' mean?",
            a: "Quality Points (QP) are the product of a course's credit units and your grade point " +
               "in that course. For example, a B (4 points) in a 3-unit course gives 12 quality " +
               "points. Your GPA is always total quality points divided by total credit units. High " +
               "quality points mean a higher GPA.",
          },
          {
            q: "Does this app save my data automatically?",
            a: "Yes. Your data is automatically saved to your browser's local storage a few seconds " +
               "after any change. It persists across page reloads and browser restarts on the same " +
               "device and browser. To save across devices or after clearing your browser cache, " +
               "export a JSON backup from the Export menu.",
          },
          {
            q: "Can I import my results from an Excel spreadsheet or PDF file?",
            a: "Yes. The import modal has a 'Import from file' tab that accepts Excel spreadsheets " +
               "(.xlsx and .xls) and digital PDF transcripts. The parser detects semester blocks " +
               "and course data automatically. Only digital (text-based) PDFs work. Scanned image " +
               "transcripts cannot be parsed. To get a digital PDF from your student portal, use " +
               "your browser's File, Print, Save as PDF option on the results page.",
          },
          {
            q: "What is the Grade Mix suggestion in the Projection panel?",
            a: "When the Projection panel calculates the GPA you need per remaining semester, it " +
               "also shows the approximate grade distribution needed to hit that GPA. For example, " +
               "if you need a GPA of 3.80 on a 5.0 scale, the mix shows roughly 80% Bs and 20% Cs, " +
               "which is about 5 Bs and 1 C in a typical 6-course semester. This gives you a " +
               "concrete study target instead of an abstract number. The calculation uses your " +
               "institution's actual grade table and assumes about 3 credit units per course on average.",
          },
          {
            q: "Is the AI chat assistant always available?",
            a: "No. The Academic Assistant requires an internet connection. If it is unavailable, " +
               "the app uses two offline fallbacks in order: first, it searches answers from your " +
               "past online sessions (stored in your browser); second, it checks a built-in " +
               "knowledge base covering GPA, CGPA, carryovers, borderline status, and more. All " +
               "calculation features work fully offline regardless of the assistant's availability.",
          },
          {
            q: "Can I use this app on my phone?",
            a: "Yes. The app is fully responsive from 375px wide screens upward. On mobile, the " +
               "semester tabs scroll horizontally, the CGPA shows in a sticky bar at the bottom, " +
               "and the projection and chat panels are accessible below the course table by " +
               "scrolling down.",
          },
        ],
      },
    ],
  },

];


// ── Helpers ───────────────────────────────────────────────────────────────────

export function searchTopics(query) {
  if (!query || query.trim() === "") return HELP_TOPICS;
  const q = query.trim().toLowerCase();

  return HELP_TOPICS.filter((topic) => {
    if (topic.title.toLowerCase().includes(q))      return true;
    if (topic.shortDesc.toLowerCase().includes(q))  return true;
    if (topic.keywords?.some((k) => k.includes(q))) return true;
    return topic.sections?.some((section) => {
      if (section.content && String(section.content).toLowerCase().includes(q)) return true;
      if (Array.isArray(section.items)) {
        return section.items.some((i) => String(i).toLowerCase().includes(q));
      }
      if (Array.isArray(section.questions)) {
        return section.questions.some(
          (faq) =>
            faq.q.toLowerCase().includes(q) ||
            faq.a.toLowerCase().includes(q)
        );
      }
      return false;
    });
  });
}

export default HELP_TOPICS;