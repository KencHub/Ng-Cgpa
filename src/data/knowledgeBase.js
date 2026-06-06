// ── knowledgeBase.js ──────────────────────────────────────────────────────────
// Knowledge base for the NG CGPA Academic Assistant.
//
// Each entry:
//   id               — unique identifier
//   title            — topic name (shown as a label on matched messages)
//   keywords         — phrases and words used by queryMatcher for scoring
//   weight           — match priority multiplier: 1 normal, 2 high, 3 exact-intent
//   generateResponse — function(ctx) → string
//                      ctx is produced by responseRenderer.buildContext()


// ── Internal helpers ──────────────────────────────────────────────────────────

function school(ctx)  { return ctx.school || "your university"; }
function scale(ctx)   { return ctx.scale  || 5.0; }
function cgpaStr(ctx) { return ctx.cgpa   || "your current CGPA"; }

function feasibility(gpa, scaleMax) {
  const g = parseFloat(gpa);
  if (isNaN(g) || g > scaleMax) return "not achievable at this pace";
  if (g > scaleMax * 0.90)      return "very challenging but not impossible";
  if (g > scaleMax * 0.75)      return "challenging but achievable";
  return "achievable with consistent effort";
}

function today() {
  return new Date().toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
  });
}


// ── Knowledge base ────────────────────────────────────────────────────────────

export const KNOWLEDGE_BASE = [


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY A — CORE CONCEPTS
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "what-is-cgpa",
    title: "What Is CGPA?",
    weight: 2,
    keywords: [
      "what is cgpa", "cgpa mean", "cgpa stand for", "cumulative grade",
      "define cgpa", "explain cgpa", "cgpa definition", "meaning of cgpa",
      "cgpa full meaning", "cgpa full form", "what does cgpa mean",
      "understand cgpa", "cgpa explained", "what cgpa means",
      "cgpa kini", "what is a cgpa",
    ],
    generateResponse(ctx) {
      const lines = [
        "CGPA stands for Cumulative Grade Point Average. It measures your overall academic performance across every semester you have completed.",
        "The formula:\n  CGPA = Total Quality Points ÷ Total Credit Units\nBoth values are summed across ALL semesters combined.",
        "This is the only correct method. CGPA is not the average of your semester GPAs. Those two methods only agree when every semester has exactly the same credit unit load, which almost never happens in Nigerian universities.",
      ];
      if (ctx.hasData) {
        lines.push(
          `At ${school(ctx)}, your current CGPA is ${cgpaStr(ctx)} out of ${scale(ctx)}, ` +
          `based on ${ctx.totalCU} credit units and ${ctx.totalQP} total quality points.`
        );
      } else {
        lines.push("Enter your courses and select your university to calculate your exact CGPA.");
      }
      return lines.join("\n\n");
    },
  },


  {
    id: "what-is-gpa",
    title: "What Is GPA?",
    weight: 2,
    keywords: [
      "what is gpa", "gpa mean", "gpa stand", "grade point average",
      "semester gpa", "how is gpa", "explain gpa", "define gpa",
      "understand gpa", "gpa explained", "what does gpa mean",
      "gpa meaning", "gpa definition", "what is a gpa",
    ],
    generateResponse(ctx) {
      const lines = [
        "GPA (Grade Point Average) measures your performance within a single semester.",
        "  GPA = Sum of Quality Points for that semester ÷ Sum of Credit Units for that semester",
        "A quality point is a course's credit units multiplied by its grade point. Example: a B (4 points) in a 3-unit course = 12 quality points.",
      ];
      if (ctx.hasData && ctx.validSemCount > 0) {
        if (ctx.bestSemLabel) {
          lines.push(`Your best semester GPA so far was ${ctx.bestSemGPA} in ${ctx.bestSemLabel}.`);
        }
        if (ctx.trend === "improving") lines.push("Your semester GPA has been trending upward — that is directly strengthening your CGPA.");
        if (ctx.trend === "declining") lines.push("Your semester GPA has been declining. Reversing this trend now protects your cumulative.");
      } else {
        lines.push("Enter your courses to see your semester GPAs calculated automatically.");
      }
      return lines.join("\n\n");
    },
  },


  {
    id: "quality-points",
    title: "What Is a Quality Point?",
    weight: 1,
    keywords: [
      "quality point", "what is quality point", "quality points mean",
      "how quality point", "calculate quality", "what are qp",
      "what is qp", "quality point meaning", "how qp works",
    ],
    generateResponse(ctx) {
      return [
        "A quality point is the value a single course contributes to your CGPA numerator.",
        "Formula: Quality Points = Credit Units × Grade Point",
        "Example on a 5.0 scale: a 3-unit course graded B (grade point 4) gives 3 × 4 = 12 quality points.",
        "This is why high-credit courses matter more. A 4-unit course graded C gives 12 quality points. A 1-unit course graded A gives only 5. Same effort, very different impact.",
        ctx.hasData
          ? `You currently have ${ctx.totalQP} total quality points across ${ctx.totalCU} credit units at ${school(ctx)}.`
          : "Select your university and enter your courses to see your total quality points.",
      ].join("\n\n");
    },
  },


  {
    id: "cgpa-vs-gpa",
    title: "CGPA vs GPA — What Is the Difference?",
    weight: 1,
    keywords: [
      "cgpa vs gpa", "difference between cgpa and gpa", "cgpa and gpa",
      "cgpa or gpa", "gpa vs cgpa", "difference gpa cgpa",
      "cgpa versus gpa", "gpa compared to cgpa",
    ],
    generateResponse(ctx) {
      return [
        "GPA is per semester. CGPA is cumulative across your entire degree.",
        "GPA = quality points this semester ÷ credit units this semester\nCGPA = ALL quality points from every semester ÷ ALL credit units from every semester",
        "The most common error is calculating CGPA as the average of semester GPAs. This is mathematically wrong whenever semesters have different credit unit loads.",
        ctx.hasData && ctx.validSemCount >= 2
          ? `You have ${ctx.validSemCount} semesters completed. Your cumulative CGPA of ${cgpaStr(ctx)} is computed from all ${ctx.totalCU} credit units combined, not from averaging your individual semester GPAs.`
          : "Once you enter multiple semesters, you will see how the cumulative formula differs from a simple average.",
      ].join("\n\n");
    },
  },


  {
    id: "calculation-steps",
    title: "How Is CGPA Calculated? (Step by Step)",
    weight: 2,
    keywords: [
      "how is cgpa calculated", "calculate cgpa", "cgpa formula",
      "how to calculate cgpa", "cgpa step by step", "formula for cgpa",
      "manual cgpa", "how do i calculate my cgpa", "calculate my cgpa",
      "cgpa calculation steps", "show me how to calculate",
    ],
    generateResponse(ctx) {
      const lines = [
        "CGPA calculation in three steps:",
        "Step 1 — Grade point for each course:\nUse your institution's grade table. On the 5.0 NUC scale: A = 5, B = 4, C = 3, D = 2, E = 1, F = 0.",
        "Step 2 — Quality points per course:\nQuality Points = Credit Units × Grade Point\nExample: MTH101 (3 units, grade B) = 3 × 4 = 12 quality points.",
        "Step 3 — CGPA:\nSum all quality points across ALL semesters. Sum all credit units across ALL semesters. Divide total quality points by total credit units.",
      ];
      if (ctx.hasData) {
        lines.push(
          `Your current numbers at ${school(ctx)}:\n` +
          `Total Quality Points: ${ctx.totalQP}\n` +
          `Total Credit Units:   ${ctx.totalCU}\n` +
          `CGPA: ${ctx.totalQP} ÷ ${ctx.totalCU} = ${cgpaStr(ctx)}`
        );
      }
      return lines.join("\n\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY B — PERFORMANCE ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "current-class",
    title: "What Is My Current Degree Class?",
    weight: 3,
    keywords: [
      "what is my class", "current class", "what class am i",
      "what degree am i", "my current degree", "what class do i have",
      "what classification am i", "what class do i currently have",
      "am i in first class", "what class is this cgpa",
      "what class do i fall in", "what degree class am i",
      "my degree class", "current standing", "academic standing",
      "where do i stand", "what grade am i", "my current result",
      "what class am i in right now", "what result do i have",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return "Enter your courses and select your university to calculate your current degree class.";
      }

      const lines = [
        `At ${school(ctx)}, your current degree class is: ${ctx.degreeClass || "Not yet classified"}.`,
        `Your CGPA is ${cgpaStr(ctx)} out of ${scale(ctx)}.`,
      ];

      if (ctx.nextClassLabel) {
        const gap = parseFloat(ctx.deficit);
        lines.push(
          `The next class up is ${ctx.nextClassLabel} (requires ${ctx.nextClassMin}). You are ${ctx.deficit} points below that boundary.`
        );
        if (gap <= 0.10) {
          lines.push(`You are borderline. One strong semester can push you into ${ctx.nextClassLabel}.`);
        } else if (gap <= 0.30) {
          lines.push(`You are within reach. Consistent improvement over 1 to 2 semesters can get you there.`);
        }
      } else {
        lines.push("You are in the highest available classification. Your task now is to maintain this.");
      }

      if (ctx.cushion !== null && parseFloat(ctx.cushion) <= 0.15) {
        lines.push(`Warning: you are only ${ctx.cushion} points above the lower boundary of ${ctx.degreeClass}. A weak semester could drop your class.`);
      }

      if (ctx.trend === "declining") {
        lines.push("Your semester GPA has been declining. This will reduce your CGPA if the trend continues.");
      }

      return lines.join("\n\n");
    },
  },


  {
    id: "first-class-track",
    title: "Am I on Track for First Class?",
    weight: 3,
    keywords: [
      "on track for first class", "first class", "first-class", "am i on track",
      "can i get first class", "achieve first class", "first class honours",
      "track for first", "going to get first class", "will i make first class",
      "can i still make first", "first class chances", "chances of first class",
      "likely first class", "on course for first", "first class possible",
      "first class realistic", "heading for first class",
    ],
    generateResponse(ctx) {
      if (!ctx.hasInstitution) {
        return "Select your university first. First Class requirements depend on your institution's grading scale.";
      }
      if (!ctx.hasData) {
        return `At ${school(ctx)}, First Class requires a CGPA of ${ctx.firstClassMin || "4.50"} out of ${scale(ctx)}. Enter your courses to see where you stand.`;
      }

      const fcMin    = parseFloat(ctx.firstClassMin);
      const cgpaVal  = parseFloat(ctx.cgpa);
      const reqGPA   = parseFloat(ctx.requiredGPAForFirstClass);
      const scaleMax = scale(ctx);

      if (ctx.isFirstClass) {
        return [
          `You are currently in First Class with a CGPA of ${cgpaStr(ctx)} at ${school(ctx)}.`,
          `First Class requires ${ctx.firstClassMin}. You are ${(cgpaVal - fcMin).toFixed(2)} points above the boundary.`,
          ctx.cushion !== null
            ? `Your cushion is ${ctx.cushion} points. To protect this position, aim for consistent As in all remaining semesters. Even a single weak semester can reduce this cushion noticeably.`
            : "Maintain this by targeting mostly As in all remaining semesters.",
        ].join("\n\n");
      }

      return [
        `Your current CGPA is ${cgpaStr(ctx)} at ${school(ctx)}. First Class requires ${ctx.firstClassMin}. You are ${ctx.deficit} points below.`,
        ctx.requiredGPAForFirstClass !== null
          ? `Assuming ${ctx.remSems} semesters remaining at ${ctx.estCUPerSem} units each, you need ${ctx.requiredGPAForFirstClass} GPA per semester. On a ${scaleMax} scale, that is ${feasibility(reqGPA, scaleMax)}.`
          : "Open the Projection panel and enter your remaining semesters to see the required GPA.",
        reqGPA > scaleMax
          ? `First Class is no longer mathematically reachable with those numbers. Focus on securing a strong ${ctx.nextClassLabel || "Second Class Upper"} instead.`
          : "Prioritise high-credit courses and target an A in every course you can control.",
      ].join("\n\n");
    },
  },


  {
    id: "graduation-class",
    title: "What Class Will I Graduate With?",
    weight: 3,
    keywords: [
      "what class will i graduate", "graduation class", "what will i graduate with",
      "what degree class", "at this rate", "current pace", "projected class",
      "what class am i getting", "what will i graduate as", "expected class",
      "graduating with what", "likely graduation class", "what am i graduating with",
      "what class will i get", "my final class", "what will my result be",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return "Enter your courses and select your university to calculate your current degree class and projected graduation outcome.";
      }
      const lines = [
        `At your current CGPA of ${cgpaStr(ctx)} at ${school(ctx)}, you are on track for: ${ctx.degreeClass || "Not yet classified"}.`,
      ];
      if (ctx.nextClassLabel) {
        lines.push(
          `The next class up is ${ctx.nextClassLabel}, which requires ${ctx.nextClassMin}. You are ${ctx.deficit} points below that boundary.`
        );
        if (ctx.requiredGPAForNextClass !== null) {
          lines.push(
            `To cross into ${ctx.nextClassLabel} over ${ctx.remSems} remaining semesters at ${ctx.estCUPerSem} units each, you need a semester GPA of ${ctx.requiredGPAForNextClass}. That is ${feasibility(ctx.requiredGPAForNextClass, scale(ctx))}.`
          );
        }
      } else {
        lines.push("You are in the highest available classification. Maintain your performance to secure this outcome.");
      }
      if (ctx.trend === "declining") {
        lines.push("Warning: your semester GPA has been declining. If this continues, your cumulative CGPA will drop. Address this semester's courses as a priority.");
      } else if (ctx.trend === "improving") {
        lines.push("Your semester GPA is trending upward. Keep this momentum and your graduation class will solidify.");
      }
      return lines.join("\n\n");
    },
  },


  {
    id: "needed-gpa-next",
    title: "What GPA Do I Need Next Semester?",
    weight: 3,
    keywords: [
      "what gpa do i need", "gpa next semester", "need next semester",
      "required gpa", "how much gpa", "gpa do i need to get",
      "what do i need next semester", "target gpa next", "gpa target",
      "what score do i need", "minimum gpa needed", "gpa requirement",
      "how high gpa", "target for next semester", "gpa i need",
      "what gpa to aim for", "gpa needed to",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return "Enter your courses first. Once you have a CGPA on record, this tool calculates exactly what you need per semester to reach your target.";
      }
      if (ctx.isFirstClass) {
        return [
          `You are already in First Class (CGPA: ${cgpaStr(ctx)}). Your task is to stay there.`,
          ctx.cushion !== null
            ? `Your cushion above ${ctx.firstClassMin} is ${ctx.cushion} points. Each new semester with a GPA below your current CGPA will reduce this cushion. Aim for a semester GPA at or above ${cgpaStr(ctx)}.`
            : `Aim for a semester GPA close to your current ${cgpaStr(ctx)} to maintain your classification.`,
        ].join("\n\n");
      }
      const lines = [
        `Current CGPA: ${cgpaStr(ctx)} at ${school(ctx)} (${ctx.degreeClass || "classified"}).`,
      ];
      if (ctx.nextClassLabel && ctx.requiredGPAForNextClass !== null) {
        const req = parseFloat(ctx.requiredGPAForNextClass);
        lines.push(
          `To reach ${ctx.nextClassLabel} (${ctx.nextClassMin}) over ${ctx.remSems} semesters at ${ctx.estCUPerSem} units each, you need: ${ctx.requiredGPAForNextClass} GPA per semester.`,
          `That is ${feasibility(req, scale(ctx))} on your ${scale(ctx)} scale.`
        );
        if (req > scale(ctx)) {
          lines.push("This target can no longer be reached for that classification. Use the Projection panel to find the highest CGPA still achievable.");
        }
      } else if (ctx.nextClassLabel) {
        lines.push(`Set your remaining semesters in the Projection panel to calculate the exact GPA needed to reach ${ctx.nextClassLabel}.`);
      }
      return lines.join("\n\n");
    },
  },


  {
    id: "borderline-check",
    title: "Am I Borderline for a Higher Class?",
    weight: 2,
    keywords: [
      "borderline", "am i borderline", "close to first class",
      "close to 2:1", "close to second upper", "near the boundary",
      "almost first class", "nearly 2:1", "just below boundary",
      "how close am i", "am i close", "near classification",
      "almost there", "nearly there", "close to boundary",
      "almost 2:1", "nearly first class", "almost upgrade",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return "Enter your courses to see whether your CGPA is borderline for a higher classification.";
      }
      const PROXIMITY = 0.10;
      const cgpaVal   = parseFloat(ctx.cgpa);

      if (ctx.nextClassLabel) {
        const nextMin = parseFloat(ctx.nextClassMin);
        const gap     = nextMin - cgpaVal;
        if (gap > 0 && gap <= PROXIMITY) {
          const neededQP = Math.ceil(nextMin * (ctx.totalCU + ctx.estCUPerSem) - ctx.totalQP);
          return [
            `You are borderline for ${ctx.nextClassLabel}.`,
            `Your CGPA is ${cgpaStr(ctx)}. The boundary is ${ctx.nextClassMin}. You are only ${gap.toFixed(2)} points below.`,
            `With ${ctx.totalCU} credit units recorded and ${ctx.estCUPerSem} estimated units next semester, you need at least ${neededQP} quality points from next semester to cross into ${ctx.nextClassLabel}.`,
            "Some Nigerian universities apply discretionary upgrades for borderline students with strong final-year performance. Aim to cross on merit rather than relying on this.",
          ].join("\n\n");
        }
      }

      if (ctx.cushion !== null && parseFloat(ctx.cushion) <= PROXIMITY) {
        return [
          `You are borderline for falling OUT of ${ctx.degreeClass}.`,
          `Your CGPA is ${cgpaStr(ctx)}, only ${ctx.cushion} points above your current class minimum of ${ctx.currentClassMin}.`,
          "A weak semester could move you into a lower classification. Treat every course this semester as critical.",
        ].join("\n\n");
      }

      return [
        `You are not currently borderline. Your CGPA is ${cgpaStr(ctx)}.`,
        ctx.nextClassLabel
          ? `You are ${ctx.deficit} points below ${ctx.nextClassLabel}. That gap is outside the 0.10 borderline window, so no discretionary upgrade would apply.`
          : "You are in the top classification.",
      ].join("\n\n");
    },
  },


  {
    id: "recover-bad-semester",
    title: "Can I Recover from a Terrible Semester?",
    weight: 2,
    keywords: [
      "recover", "bad semester", "terrible semester", "worst semester",
      "failed semester", "poor semester", "horrible semester",
      "can i come back from", "come back from a bad",
      "recover from poor results", "bounce back", "bad results",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "Yes — a bad semester hurts, but it is recoverable, especially early in your degree.",
          "The key: your CGPA is a weighted cumulative average. Every subsequent semester adds new quality points and credit units to the total. A strong comeback semester dilutes the damage from a weak one.",
          "The earlier the bad semester occurs, the more semesters you have to recover. A weak 100-level semester with 4 semesters of strong performance ahead is much more survivable than a weak final-year semester.",
          "Enter your courses to see your current CGPA and how much a strong next semester would move it.",
        ].join("\n\n");
      }

      const lines = [
        `Your current CGPA is ${cgpaStr(ctx)} at ${school(ctx)} after ${ctx.semesterCount} semester${ctx.semesterCount > 1 ? "s" : ""}.`,
      ];

      if (ctx.worstSemLabel && ctx.worstSemGPA) {
        lines.push(`Your weakest semester so far was ${ctx.worstSemLabel} with a GPA of ${ctx.worstSemGPA}.`);
      }

      if (ctx.nextClassLabel && ctx.requiredGPAForNextClass !== null) {
        const req = parseFloat(ctx.requiredGPAForNextClass);
        lines.push(
          `To reach ${ctx.nextClassLabel} from here, you need ${ctx.requiredGPAForNextClass} GPA per semester over your remaining ${ctx.remSems} semesters. That is ${feasibility(req, scale(ctx))}.`
        );
        if (req <= scale(ctx)) {
          lines.push("Recovery is still possible. Focus on your highest-credit courses and retake any failed courses immediately.");
        } else {
          lines.push("The gap to the higher class has grown too large to close. Set a revised target in the Projection panel to find the best outcome still available to you.");
        }
      }

      if (ctx.trend === "improving") {
        lines.push("Your GPA is already trending upward — the recovery is in progress.");
      }

      return lines.join("\n\n");
    },
  },


  {
    id: "how-many-as-needed",
    title: "How Many A Grades Do I Need?",
    weight: 2,
    keywords: [
      "how many as", "how many a grades", "how many a do i need",
      "number of a grades", "need how many a", "many a to get first class",
      "how many as do i need", "a grades needed",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "There is no fixed number of A grades required — it depends on your credit unit distribution and how many Bs, Cs, and Ds accompany them.",
          "The correct approach: calculate what total quality points you need, then work backwards to find what grade mix achieves it.",
          "On a 5.0 scale: to stay in First Class (4.50 minimum), a semester of 18 units needs at least 81 quality points. That is the equivalent of all As (90 QP) minus 9 points of slack — roughly two Bs and everything else an A.",
          "Enter your courses and use the Projection panel to model specific grade combinations.",
        ].join("\n\n");
      }

      const scaleMax = scale(ctx);
      const lines    = [];

      if (ctx.nextClassLabel && ctx.nextClassMin !== null) {
        const targetMin      = parseFloat(ctx.nextClassMin);
        const targetQP       = targetMin * (ctx.totalCU + ctx.estCUPerSem);
        const neededFutureQP = targetQP - ctx.totalQP;
        const aPoint         = scaleMax >= 5 ? 5 : 4;
        const bPoint         = scaleMax >= 5 ? 4 : 3;
        const avgCUPerCourse = 3;
        const coursesNext    = Math.round(ctx.estCUPerSem / avgCUPerCourse);

        lines.push(
          `To reach ${ctx.nextClassLabel} (${ctx.nextClassMin}) next semester (${ctx.estCUPerSem} units), ` +
          `you need ${neededFutureQP.toFixed(1)} quality points.`
        );
        lines.push(
          `At ${ctx.estCUPerSem} units and an average of ${avgCUPerCourse} units per course (~${coursesNext} courses), ` +
          `an all-A semester gives ${ctx.estCUPerSem * aPoint} QP. All-B gives ${ctx.estCUPerSem * bPoint} QP.`
        );
        if (neededFutureQP <= ctx.estCUPerSem * bPoint) {
          lines.push(`Even a solid B average is sufficient to reach ${ctx.nextClassLabel} next semester.`);
        } else if (neededFutureQP <= ctx.estCUPerSem * aPoint) {
          lines.push(`You need performance between a B and A average. Target As on high-credit courses and Bs on the rest.`);
        } else {
          lines.push(`Even a perfect-A semester is not enough to reach ${ctx.nextClassLabel} in one step. You need multiple strong semesters.`);
        }
      } else {
        lines.push(`Your current CGPA is ${cgpaStr(ctx)} — you are in ${ctx.degreeClass}. You are already in the highest classification.`);
        lines.push("To stay there, you cannot afford many Bs or Cs on high-credit courses. Target mostly As.");
      }

      return lines.join("\n\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY C — PROBLEM COURSES
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "failed-course-impact",
    title: "I Failed a Course — How Bad Is It?",
    weight: 3,
    keywords: [
      "failed a course", "i failed", "fail a course", "i got an f",
      "f grade", "how bad is it", "zero grade", "failed course",
      "course failure", "how bad is failing", "i got f",
      "failed my exam", "failed an exam", "failed exam",
      "got zero in", "zero in a course", "i fail", "failed my course",
      "got an f", "failed one course", "i scored zero", "i got zero",
    ],
    generateResponse(ctx) {
      const generic = [
        "An F grade contributes 0 quality points but its credit units are still counted in your denominator.",
        "This damages your CGPA in two ways simultaneously: zero added to the numerator, while the denominator grows. A 4-unit F is four times as damaging as a 1-unit F.",
        "Retaking and passing fixes this because you add quality points without increasing the denominator again. Those units were already counted in the first attempt.",
        "Enter your courses to calculate the exact CGPA impact of your failed course and see what retaking it would recover.",
      ].join("\n\n");

      if (!ctx.hasData) return generic;

      if (ctx.failedCount === 0) {
        return [
          `Good news: you have no F grades on record at ${school(ctx)}.`,
          "If you are asking hypothetically: an F in any course adds 0 quality points while its credit units still divide into your CGPA. The higher the credit unit count of the failed course, the worse the damage.",
        ].join("\n\n");
      }

      const lines = [
        `You have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""} on record at ${school(ctx)}.`,
      ];

      ctx.failedCourses.forEach(c => {
        const cu = parseFloat(c.creditUnits);
        if (isNaN(cu) || cu <= 0) return;
        const cPoint   = scale(ctx) >= 5 ? 3 : 2;
        const gainedQP = cu * cPoint;
        const newCGPA  = ((ctx.totalQP + gainedQP) / ctx.totalCU).toFixed(2);
        lines.push(
          `${c.name || "Unnamed course"} (${cu} units, ${c.semesterLabel}): ` +
          `contributes 0 quality points. If you retake it and earn a C, you gain ${gainedQP} QP, ` +
          `moving your CGPA from ${cgpaStr(ctx)} to approximately ${newCGPA}.`
        );
      });

      lines.push("Retaking failed courses — especially high-credit ones — is the highest-leverage action available for your CGPA.");
      return lines.join("\n\n");
    },
  },


  {
    id: "carryover-retake",
    title: "How Does Retaking a Course Work?",
    weight: 2,
    keywords: [
      "retake", "retaking", "carryover", "carry over", "carry-over",
      "supplementary", "resit", "re-sit", "how does retake work",
      "what happens when i retake", "carryover impact",
      "carryover course", "pending course", "outstanding course",
      "how retake works", "can i retake", "retake policy",
      "what is carryover", "carryover meaning",
    ],
    generateResponse(ctx) {
      return [
        "When you retake a failed course and pass it, the new grade typically replaces or supplements the original F in the CGPA calculation. Most Nigerian universities use the better grade.",
        "The key: the credit units are NOT counted twice. They were already included in your total from the first attempt. Every quality point you earn from a retake goes directly to your numerator without touching your denominator.",
        ctx.hasData && ctx.failedCount > 0
          ? `You have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""}. Start with the highest-credit one — that retake has the largest CGPA impact.`
          : ctx.hasData
          ? "You have no failed courses currently. If you are at risk this semester, focus on passing even at D level — any grade above F is better than a carryover."
          : "Enter your courses to see which ones could benefit from a retake.",
        `Verify the exact retake policy at ${school(ctx)} with your faculty officer. Some departments record both grades, others record only the better one.`,
      ].join("\n\n");
    },
  },


  {
    id: "high-credit-course",
    title: "Why Do High-Credit Courses Matter More?",
    weight: 1,
    keywords: [
      "high credit course", "credit weight", "4 unit course", "3 unit course",
      "heavy course", "high unit course", "which course matters most",
      "credit unit importance", "course weight", "unit weight",
      "why does credit unit matter", "does credit unit affect cgpa",
    ],
    generateResponse(ctx) {
      return [
        "High-credit courses have a multiplied impact because quality points scale directly with credit units.",
        "On a 5.0 scale: an A (5 points) in a 4-unit course = 20 quality points. An A in a 1-unit course = 5 quality points. Same grade letter, four times the impact.",
        "This works both ways. A C in a 4-unit course adds only 12 quality points, while an A in the same course adds 20. That 8-point difference across a 16-unit semester can move a CGPA by 0.05 to 0.10 depending on your cumulative total.",
        ctx.hasData
          ? `With ${ctx.totalCU} credit units on record, each new high-credit course carries proportionally less weight — but your highest-credit courses next semester still matter significantly. Allocate study time accordingly.`
          : "Once you enter your courses, the quality point contribution of each course is shown directly in the course table.",
      ].join("\n\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY D — IMPROVEMENT PATHS
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "improve-cgpa",
    title: "How Can I Improve My CGPA?",
    weight: 2,
    keywords: [
      "improve cgpa", "boost cgpa", "increase cgpa", "raise cgpa",
      "improve my gpa", "how to improve", "how do i improve",
      "strategies to improve", "cgpa improvement", "make cgpa better",
      "my cgpa dropped", "cgpa falling", "cgpa going down", "cgpa is low",
      "fix cgpa", "cgpa is bad", "what should i do", "bad cgpa",
      "cgpa not good", "my cgpa is poor", "cgpa too low",
      "tips to improve cgpa", "what can i do to improve",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "Three actions have the most leverage on your CGPA:",
          "1. Retake every failed course. An F contributes 0 quality points while those credit units are still dividing your average. A passing retake adds quality points without increasing the denominator.",
          "2. Prioritise high-credit courses. A 4-unit course affects your CGPA four times more than a 1-unit course. Spend study time proportionally.",
          "3. Be consistent. Alternating strong and weak semesters cancels out the strong ones. Steady B and above performance is more effective than swings between A and D.",
          "Enter your courses to get a personalised analysis of what you need.",
        ].join("\n\n");
      }

      const lines = [
        `Your CGPA is ${cgpaStr(ctx)} at ${school(ctx)} (${ctx.degreeClass || "classified"}), based on ${ctx.totalCU} credit units.`,
        "Three levers move your CGPA:",
        "1. Retake failed courses. " +
          (ctx.failedCount > 0
            ? `You have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""} — address these first. Each passing retake adds quality points without increasing your denominator.`
            : "You currently have no failed courses, which is a strong foundation."),
        "2. Target high-credit courses. Spend the most study time on 3-unit and 4-unit courses. An A in a 4-unit course contributes four times more than an A in a 1-unit course.",
        "3. Maintain consistency. Consistent Bs across multiple semesters have a stronger cumulative effect than alternating As and Cs.",
      ];

      if (ctx.nextClassLabel && ctx.requiredGPAForNextClass) {
        lines.push(
          `To reach ${ctx.nextClassLabel}: you need a semester GPA of ${ctx.requiredGPAForNextClass} over your remaining ${ctx.remSems} semesters. That is ${feasibility(ctx.requiredGPAForNextClass, scale(ctx))}.`
        );
      }

      return lines.join("\n\n");
    },
  },


  {
    id: "cgpa-at-risk",
    title: "My CGPA Is Very Low — What Do I Do?",
    weight: 2,
    keywords: [
      "cgpa too low", "cgpa is bad", "very low cgpa", "low cgpa",
      "terrible cgpa", "bad cgpa", "my result is bad",
      "will i be rusticated", "will i fail out", "risk of expulsion",
      "academic probation", "cgpa below 2", "my cgpa is 1",
      "cgpa is 1", "dropping out", "risk of withdrawal",
      "my cgpa is terrible", "what do i do my cgpa is low",
      "cgpa is 1.5", "cgpa is 2", "am i at risk",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "A low CGPA is recoverable, but the path forward depends entirely on your specific numbers — how many credit units you have accumulated, how many semesters remain, and which courses you have failed.",
          "The three highest-impact actions regardless of your situation:",
          "1. Pass every current course — even a D is better than an F. A failed course adds 0 quality points but its credit units still divide your average.",
          "2. Retake every failed course immediately. Each passing retake adds quality points without increasing your denominator.",
          "3. Prioritise high-credit courses. A 4-unit course has four times the impact of a 1-unit course.",
          "Enter your courses to get a specific analysis of what is recoverable.",
        ].join("\n\n");
      }

      const cgpaVal = parseFloat(ctx.cgpa);
      const lines   = [`Your CGPA is ${cgpaStr(ctx)} at ${school(ctx)}.`];

      if (cgpaVal < 1.00) {
        lines.push(
          "This is a critical situation. A CGPA below 1.00 means no degree will be awarded at most Nigerian universities. Speak with your faculty officer or academic advisor immediately about your status and available options."
        );
      } else if (cgpaVal < 1.50) {
        lines.push(
          `You are currently below the Third Class boundary of ${ctx.thirdClassMin || "1.50"}. This means you are at risk of not earning a degree.`,
          "Immediate focus: pass every single course on your current registration. Do not prioritise high grades over passing first. Any quality point is better than zero."
        );
      } else if (cgpaVal < 2.40) {
        lines.push(
          `You are in Third Class territory. The boundary to Second Class Lower (2:2) is ${scale(ctx) >= 5 ? "2.40" : "2.00"}.`,
          ctx.requiredGPAForNextClass !== null
            ? `To reach 2:2 over ${ctx.remSems} remaining semesters at ${ctx.estCUPerSem} units each, you need a semester GPA of ${ctx.requiredGPAForNextClass}. That is ${feasibility(ctx.requiredGPAForNextClass, scale(ctx))}.`
            : "Use the Projection panel to calculate what you need per semester."
        );
      }

      if (ctx.failedCount > 0) {
        lines.push(
          `You have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""}. Retaking ${ctx.failedCount === 1 ? "it" : "them"} is the single fastest way to move your CGPA. Each passing retake adds quality points without touching your denominator.`
        );
      }

      lines.push("Visit your faculty officer to understand your institution's specific policies on minimum CGPA requirements.");
      return lines.join("\n\n");
    },
  },


  {
    id: "move-2-2-to-2-1",
    title: "How Do I Move from a 2:2 to a 2:1?",
    weight: 3,
    keywords: [
      "move from 2:2 to 2:1", "2:2 to 2:1", "second lower to second upper",
      "upgrade from 2:2", "go from 2:2 to 2:1", "from lower to upper",
      "improve from 2:2", "second class lower to upper",
      "how to get 2:1", "upgrade my class", "move up class",
      "second lower upgrade", "from 2.2 to 2.1", "2.2 to 2.1",
      "how do i get second upper", "second class upper",
    ],
    generateResponse(ctx) {
      if (!ctx.hasInstitution) {
        return "Select your university first so the correct 2:1 and 2:2 boundaries can be applied.";
      }
      const twoOneMin = scale(ctx) >= 5 ? "3.50" : "3.00";

      if (!ctx.hasData) {
        return [
          `At ${school(ctx)}, Second Class Upper (2:1) requires a CGPA of ${twoOneMin} out of ${scale(ctx)}.`,
          "Moving from 2:2 to 2:1 requires sustained above-average performance. With the credit units already on record, future semesters must pull your cumulative average above that boundary.",
          "Enter your courses and set your remaining semesters in the Projection panel to get a specific GPA target per semester.",
        ].join("\n\n");
      }

      const lines = [
        `Your current CGPA is ${cgpaStr(ctx)} (${ctx.degreeClass || "2:2 range"}) at ${school(ctx)}.`,
        `Second Class Upper requires ${ctx.nextClassMin || twoOneMin}. You are ${ctx.deficit || "some points"} below.`,
      ];

      if (ctx.requiredGPAForNextClass !== null) {
        const req = parseFloat(ctx.requiredGPAForNextClass);
        lines.push(
          `Over ${ctx.remSems} remaining semesters at ${ctx.estCUPerSem} units each, you need a semester GPA of ${ctx.requiredGPAForNextClass}. That is ${feasibility(req, scale(ctx))}.`
        );
        if (req <= scale(ctx)) {
          lines.push("Practical steps: focus on 3-unit and 4-unit courses first. Retake any failed courses immediately. Avoid elective courses in areas where you are consistently weak.");
        } else {
          lines.push("A 2:1 is no longer achievable with your current numbers and remaining semesters. Speak with your faculty office about your options.");
        }
      }

      return lines.join("\n\n");
    },
  },


  {
    id: "minimum-avoid-third",
    title: "What Is the Minimum I Need to Avoid Third Class?",
    weight: 3,
    keywords: [
      "avoid third class", "minimum to avoid third", "third class",
      "not get third class", "avoid 3rd class", "minimum cgpa",
      "minimum i need", "pass degree", "not get third",
      "will i get third class", "am i getting third class",
      "third class risk", "danger of third class", "at risk of third",
      "avoid failing out", "am i in danger", "am i at risk of third",
    ],
    generateResponse(ctx) {
      if (!ctx.hasInstitution) {
        return "Select your university to see the exact Third Class boundary for your institution.";
      }
      const thirdMin  = ctx.thirdClassMin || (scale(ctx) >= 5 ? "1.50" : "1.00");
      const twoTwoMin = scale(ctx) >= 5 ? 2.40 : 2.00;

      if (!ctx.hasData) {
        return [
          `At ${school(ctx)}, Third Class begins at ${thirdMin} on the ${scale(ctx)} scale. Second Class Lower (2:2) requires ${twoTwoMin}.`,
          "Enter your courses to see exactly where you stand and what you need to move up.",
        ].join("\n\n");
      }

      const cgpaVal = parseFloat(ctx.cgpa);
      const lines   = [`Your current CGPA is ${cgpaStr(ctx)} at ${school(ctx)}.`];

      if (cgpaVal < 1.50) {
        lines.push(
          "Your CGPA is in very risky territory. Focus entirely on passing every course before targeting a specific class. Attend everything, submit everything, and speak with your academic advisor now."
        );
      } else if (cgpaVal < parseFloat(thirdMin) + 0.30) {
        lines.push(
          `You are close to the Third Class boundary at ${thirdMin}. One poor semester could push you below it.`,
          "Prioritise consistency above everything else. Every course matters. A semester GPA above your current CGPA lifts you. Below it drags you down."
        );
      } else {
        const cushion = (cgpaVal - parseFloat(thirdMin)).toFixed(2);
        lines.push(
          `You are ${cushion} points above the Third Class boundary. You are not at immediate risk, but this can change.`,
          "Rather than only avoiding Third Class, aim to move toward 2:2 territory where you have a more comfortable margin."
        );
      }

      if (ctx.nextClassLabel && ctx.requiredGPAForNextClass) {
        lines.push(
          `To reach ${ctx.nextClassLabel}, you need a semester GPA of ${ctx.requiredGPAForNextClass} over your remaining ${ctx.remSems} semesters.`
        );
      }

      return lines.join("\n\n");
    },
  },


  {
    id: "can-still-get-first-class",
    title: "Is First Class Still Possible for Me?",
    weight: 2,
    keywords: [
      "still possible first class", "is it still possible", "can i still get first",
      "still get first class", "first class still achievable", "can i make first class",
      "is first class possible", "still make first class",
      "first class still possible", "realistic first class",
      "is first class realistic", "can i make it to first class",
      "still achievable", "first class still realistic",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return "Enter your courses and set your remaining semesters in the Projection panel to calculate whether First Class is still within reach.";
      }
      if (ctx.isFirstClass) {
        return `You are already in First Class with a CGPA of ${cgpaStr(ctx)}. The task now is to stay there. Maintain strong semester GPAs and avoid unnecessary risk on courses you are not prepared for.`;
      }
      if (!ctx.requiredGPAForFirstClass) {
        return [
          `Your current CGPA is ${cgpaStr(ctx)} at ${school(ctx)}. First Class requires ${ctx.firstClassMin}.`,
          "Set your remaining semesters in the Projection panel to calculate whether First Class is still achievable.",
        ].join("\n\n");
      }

      const reqGPA   = parseFloat(ctx.requiredGPAForFirstClass);
      const scaleMax = scale(ctx);

      if (reqGPA > scaleMax) {
        return [
          `Your current CGPA is ${cgpaStr(ctx)}. First Class requires ${ctx.firstClassMin}.`,
          `With ${ctx.totalCU} credit units on record and ${ctx.remSems} semesters remaining at ${ctx.estCUPerSem} units each, reaching First Class would require a GPA of ${ctx.requiredGPAForFirstClass} per semester — above the ${scaleMax} maximum.`,
          `First Class is no longer achievable. Focus on securing a strong ${ctx.nextClassLabel || "Second Class Upper"} instead.`,
          ctx.requiredGPAForNextClass
            ? `To reach ${ctx.nextClassLabel}, you need ${ctx.requiredGPAForNextClass} per semester — ${feasibility(ctx.requiredGPAForNextClass, scaleMax)}.`
            : "",
        ].filter(Boolean).join("\n\n");
      }

      return [
        "Yes — First Class is still achievable.",
        `Current CGPA: ${cgpaStr(ctx)} at ${school(ctx)}. First Class requires ${ctx.firstClassMin}.`,
        `Over ${ctx.remSems} semesters at ${ctx.estCUPerSem} units each, you need ${ctx.requiredGPAForFirstClass} GPA per semester. That is ${feasibility(reqGPA, scaleMax)}.`,
        reqGPA > scaleMax * 0.85
          ? "You have no margin for error. Target As on every high-credit course and treat each exam as critical."
          : "Maintain focus on your high-credit courses, retake any carryovers, and stay consistent.",
      ].join("\n\n");
    },
  },


  {
    id: "what-if-simulation",
    title: "What If I Get a Specific GPA Next Semester?",
    weight: 2,
    keywords: [
      "what if i get", "if i score", "what if i score",
      "if i get all as", "if i get a gpa of", "what happens if i get",
      "simulate cgpa", "if next semester i get", "what if i make",
      "projection if i", "if i achieve", "what if i average",
      "if i get 4.5", "if i get 5.0", "if i get 4.0",
      "what if all as", "what if i pass everything",
      "what would my cgpa be if", "cgpa if i get",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "To simulate a specific GPA scenario, enter your current courses first so the tool has a baseline CGPA and credit unit total to project from.",
          "Once your data is in, use the Projection panel's WHAT IF section: enter your expected next semester GPA and credit unit load, and it will calculate your projected cumulative CGPA instantly.",
          "General rule on a 5.0 scale: if your next semester GPA is above your current CGPA, your cumulative CGPA rises. If it is below, it falls. The larger your existing credit unit base, the smaller the shift from any single semester.",
        ].join("\n\n");
      }

      const estCU   = ctx.estCUPerSem;
      const totalCU = ctx.totalCU;
      const totalQP = ctx.totalQP;

      const scenarios = [
        { label: "All As",    gpa: scale(ctx) >= 5 ? 5.0 : 4.0 },
        { label: "Mostly Bs", gpa: scale(ctx) >= 5 ? 4.0 : 3.0 },
        { label: "All Cs",    gpa: scale(ctx) >= 5 ? 3.0 : 2.0 },
      ].map(s => {
        const projected = ((totalQP + s.gpa * estCU) / (totalCU + estCU)).toFixed(2);
        return `${s.label} (${s.gpa.toFixed(1)} GPA) → projected CGPA: ${projected}`;
      });

      return [
        `Your current CGPA is ${cgpaStr(ctx)} across ${totalCU} credit units at ${school(ctx)}.`,
        `Assuming next semester has ${estCU} credit units, here are three scenarios:`,
        scenarios.join("\n"),
        "For a custom simulation, use the WHAT IF section in the Projection panel directly — it updates your projected CGPA as you type.",
        ctx.nextClassLabel
          ? `To cross into ${ctx.nextClassLabel} (${ctx.nextClassMin}), you need a next-semester GPA of at least ${ctx.requiredGPAForNextClass}.`
          : "",
      ].filter(Boolean).join("\n\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY E — UNDERSTANDING THE SYSTEM
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "credit-units-explained",
    title: "Credit Units Explained",
    weight: 1,
    keywords: [
      "credit unit", "credit load", "what are credit units", "course unit",
      "how credit units work", "unit explained", "how many credit units",
      "what is a credit unit", "credit hours", "course units",
    ],
    generateResponse(ctx) {
      return [
        "Credit units (also called course units or credit hours) represent the weight of each course in your CGPA calculation. They typically reflect the number of hours per week that course meets.",
        "In Nigerian universities, most courses carry 2, 3, or 4 credit units. Laboratory and practical courses often carry more. Some compulsory foundation courses carry 1 unit.",
        "The core rule: CGPA is credit-unit weighted, not course-count weighted. A 4-unit course has four times the CGPA impact of a 1-unit course when graded identically.",
        ctx.hasData
          ? `You have ${ctx.totalCU} credit units across ${ctx.semesterCount} semester${ctx.semesterCount > 1 ? "s" : ""}. Each additional course adds its units to your denominator, so every grade matters regardless of how small the course seems.`
          : "Once you enter your courses, the credit unit distribution across your semesters is visible in the semester summary bar.",
      ].join("\n\n");
    },
  },


  {
    id: "scale-explained",
    title: "What Does My University's Scale Mean?",
    weight: 1,
    keywords: [
      "what does the scale mean", "5.0 scale", "4.0 scale", "grading scale",
      "my school scale", "scale explained", "what is 5 point scale",
      "4 point scale", "grade scale system", "what scale does my school use",
      "grading system", "what is nuc scale",
    ],
    generateResponse(ctx) {
      if (!ctx.hasInstitution) return "Select your university to see which grading scale it uses and how grades map to quality points.";

      const scaleVal = scale(ctx);

      if (scaleVal === 5.0) {
        return [
          `${school(ctx)} uses the 5.0 NUC standard scale, the most common in Nigerian federal and state universities.`,
          "Grade points:\n  A (70-100) = 5 pts\n  B (60-69) = 4 pts\n  C (50-59) = 3 pts\n  D (45-49) = 2 pts\n  E (40-44) = 1 pt\n  F (0-39)  = 0 pts",
          "Classifications:\n  4.50 – 5.00: First Class\n  3.50 – 4.49: Second Class Upper (2:1)\n  2.40 – 3.49: Second Class Lower (2:2)\n  1.50 – 2.39: Third Class\n  1.00 – 1.49: Pass",
          ctx.hasData ? `Your CGPA of ${cgpaStr(ctx)} → ${ctx.degreeClass}.` : "",
        ].filter(Boolean).join("\n\n");
      }

      if (scaleVal === 4.0) {
        return [
          `${school(ctx)} uses the 4.0 grading scale.`,
          "Grade points:\n  A (70-100) = 4 pts\n  B (60-69) = 3 pts\n  C (50-59) = 2 pts\n  D (45-49) = 1 pt\n  F (0-44)  = 0 pts",
          "Classifications:\n  3.50 – 4.00: First Class\n  3.00 – 3.49: Second Class Upper (2:1)\n  2.00 – 2.99: Second Class Lower (2:2)\n  1.00 – 1.99: Third Class",
          ctx.hasData ? `Your CGPA of ${cgpaStr(ctx)} → ${ctx.degreeClass}.` : "",
        ].filter(Boolean).join("\n\n");
      }

      return [
        `${school(ctx)} uses a ${scaleVal} scale configured specifically for your institution.`,
        ctx.hasData ? `Your current CGPA is ${cgpaStr(ctx)}, placing you in ${ctx.degreeClass}.` : "",
        "Open the institution info panel (ⓘ button) to see the full grade table.",
      ].filter(Boolean).join("\n\n");
    },
  },


  {
    id: "classification-boundaries",
    title: "What Are the Degree Classification Boundaries?",
    weight: 1,
    keywords: [
      "classification boundary", "degree boundaries", "first class boundary",
      "2:1 boundary", "2:2 boundary", "classification table",
      "what cgpa for first class", "what cgpa for 2:1",
      "show me the boundaries", "degree class boundaries",
      "what cgpa is first class", "cgpa for second class",
    ],
    generateResponse(ctx) {
      if (!ctx.hasInstitution) return "Select your university to see its degree classification table.";

      const scaleVal = scale(ctx);

      if (scaleVal === 5.0) {
        return [
          `Degree classifications at ${school(ctx)} (${scaleVal} scale):`,
          "  4.50 – 5.00 → First Class Honours",
          "  3.50 – 4.49 → Second Class Upper (2:1)",
          "  2.40 – 3.49 → Second Class Lower (2:2)",
          "  1.50 – 2.39 → Third Class Honours",
          "  1.00 – 1.49 → Pass",
          "  0.00 – 0.99 → No Degree Awarded",
          ctx.hasData ? `\nYour current CGPA: ${cgpaStr(ctx)} → ${ctx.degreeClass}.` : "",
        ].filter(Boolean).join("\n");
      }

      if (scaleVal === 4.0) {
        return [
          `Degree classifications at ${school(ctx)} (${scaleVal} scale):`,
          "  3.50 – 4.00 → First Class Honours",
          "  3.00 – 3.49 → Second Class Upper (2:1)",
          "  2.00 – 2.99 → Second Class Lower (2:2)",
          "  1.00 – 1.99 → Third Class Honours",
          "  0.00 – 0.99 → No Degree Awarded",
          ctx.hasData ? `\nYour current CGPA: ${cgpaStr(ctx)} → ${ctx.degreeClass}.` : "",
        ].filter(Boolean).join("\n");
      }

      return `${school(ctx)} uses a custom ${scaleVal} scale. Open the institution info panel (ⓘ) for the full classification table.`;
    },
  },


  {
    id: "passmark-explained",
    title: "What Is the Pass Mark?",
    weight: 1,
    keywords: [
      "pass mark", "passmark", "minimum score to pass", "passing score",
      "score needed to pass", "how much to pass exam", "what is pass mark",
      "what score is pass", "minimum to pass",
    ],
    generateResponse(ctx) {
      const pm      = ctx.passmark || 40;
      const school_ = school(ctx);

      return [
        `The pass mark at ${school_} is ${pm}%. Any score below this is graded F and earns 0 grade points.`,
        pm === 40
          ? "This is the standard NUC pass mark. A score of 40-44 earns an E grade (1 point on the 5.0 scale), a marginal pass."
          : pm === 45
          ? "A 45% pass mark applies here. Below 45 = F, 0 quality points."
          : `A ${pm}% pass mark applies at this institution.`,
        "Scoring just above the pass mark is far better than failing. But marginal passes (D or E) on high-credit courses still pull your CGPA down. Always target a C or higher — especially on courses carrying 3 or more units.",
      ].join("\n\n");
    },
  },


  {
    id: "course-strategy",
    title: "Which Courses Should I Focus On?",
    weight: 2,
    keywords: [
      "which course to focus", "course strategy", "what course priority",
      "prioritise courses", "focus on which course", "study strategy",
      "which course most important", "how to prioritize",
      "what courses should i study", "which subject to focus",
      "course priority", "study tips", "exam strategy",
    ],
    generateResponse(ctx) {
      if (!ctx.hasData) {
        return [
          "Focus first on courses with the highest credit unit count. A 4-unit course has four times the CGPA impact of a 1-unit course.",
          "Second priority: courses where you are most at risk of failing. An F in any course is more damaging than a D in a 4-unit course.",
          "Third priority: courses you can push from a B to an A. On a 5.0 scale, that difference is 1 grade point. Multiply by the credit units — a 4-unit course moved from B to A adds 4 quality points directly to your CGPA numerator.",
          "Enter your courses so the tool can identify which of your current courses is affecting your CGPA most.",
        ].join("\n\n");
      }

      const lines = [
        `At ${school(ctx)} with ${ctx.totalCU} credit units on record:`,
        "Prioritise in this order:",
        "1. Failed courses first. Each F has 0 quality points but full credit units in your denominator. Retaking even one changes your trajectory.",
        "2. Courses you are borderline on. Moving a D to a C on a 3-unit course adds 3 quality points — often enough to shift your CGPA by 0.02 to 0.05.",
        "3. Your highest-credit courses. On courses carrying 4 units, the difference between a B and an A is 4 quality points. Over a semester, that is significant.",
      ];

      if (ctx.failedCount > 0) {
        lines.push(`You have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""} — these are your top priority.`);
      }

      return lines.join("\n\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY F — DRAFT DOCUMENTS
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "draft-appeal-letter",
    title: "Draft Academic Appeal Letter",
    weight: 3,
    keywords: [
      "draft appeal", "appeal letter", "write appeal", "academic appeal",
      "letter of appeal", "appeal my result", "draft a letter",
      "write a letter", "compose appeal", "letter to senate",
      "write appeal letter for me", "help me write appeal",
      "appeal result letter", "appeal to school",
    ],
    generateResponse(ctx) {
      const name    = ctx.studentName     || "[Your Full Name]";
      const dept    = ctx.department      || "[Department]";
      const faculty = ctx.faculty         || "[Faculty]";
      const matric  = ctx.matricNumber    || "[Matric Number]";
      const school_ = ctx.school          || "[University Name]";
      const level   = ctx.level           || "[Level]";
      const session = ctx.academicSession || "[Academic Session]";
      const cgpa_   = ctx.cgpa            || "[CGPA]";
      const degCls  = ctx.degreeClass     || "[Degree Class]";

      return [
        "── DRAFT: ACADEMIC APPEAL LETTER ────────────────────────────",
        "",
        `Date: ${today()}`,
        "",
        "The Head of Department",
        `Department of ${dept}`,
        `Faculty of ${faculty}`,
        school_,
        "",
        "Dear Sir/Ma,",
        "",
        `RE: APPEAL REGARDING ACADEMIC PERFORMANCE — ${name.toUpperCase()}, ${matric}`,
        "",
        `I write respectfully to appeal to your office regarding my academic standing in the ${session} session. My name is ${name}, a ${level} student in the Department of ${dept} with matriculation number ${matric}.`,
        "",
        `My current Cumulative Grade Point Average (CGPA) is ${cgpa_} (${degCls}). [Explain the specific circumstances: health challenges, family hardship, administrative errors in grading, an unavoidable absence from examinations, etc.]`,
        "",
        "Supporting evidence is attached, including [list documents: medical certificate, death certificate, corrected result slip, affidavit, etc.].",
        "",
        "I respectfully request that [state clearly what you are asking for: a review of my examination scores, a supplementary examination opportunity, a deferral, reconsideration of my result, etc.].",
        "",
        "I remain committed to my academic success and would be grateful for a favourable consideration.",
        "",
        "Yours faithfully,",
        name,
        matric,
        `Department of ${dept}`,
        "",
        "──────────────────────────────────────────────────────────────",
        "",
        "Fill in the bracketed sections. Attach all supporting documents. Submit to your faculty officer or HOD's secretary in person. Keep a copy.",
      ].join("\n");
    },
  },


  {
    id: "draft-hod-letter",
    title: "Draft Letter to HOD About CGPA",
    weight: 3,
    keywords: [
      "letter to hod", "hod letter", "head of department letter",
      "write to hod", "letter about my cgpa", "draft hod",
      "letter to head of department", "write to my hod",
      "write letter to hod", "hod letter for me",
    ],
    generateResponse(ctx) {
      const name    = ctx.studentName     || "[Your Full Name]";
      const dept    = ctx.department      || "[Department]";
      const faculty = ctx.faculty         || "[Faculty]";
      const matric  = ctx.matricNumber    || "[Matric Number]";
      const school_ = ctx.school          || "[University Name]";
      const level   = ctx.level           || "[Level]";
      const session = ctx.academicSession || "[Academic Session]";
      const cgpa_   = ctx.cgpa            || "[CGPA]";
      const degCls  = ctx.degreeClass     || "[Degree Class]";

      return [
        "── DRAFT: LETTER TO HEAD OF DEPARTMENT ──────────────────────",
        "",
        `Date: ${today()}`,
        "",
        "The Head of Department",
        `Department of ${dept}`,
        `Faculty of ${faculty}`,
        school_,
        "",
        "Dear Sir/Ma,",
        "",
        `RE: REQUEST FOR ACADEMIC GUIDANCE — ${name.toUpperCase()}, ${matric}`,
        "",
        `I am ${name}, a ${level} student in the Department of ${dept} (Matric No: ${matric}). I am writing to seek your guidance regarding my academic progress during the ${session} session.`,
        "",
        `My current CGPA is ${cgpa_} (${degCls}). [Describe your situation: whether you are struggling, have improved, are borderline for a class upgrade, or need clarification on a specific result.]`,
        "",
        "I would like to request [state clearly: a meeting, clarification on course grades, guidance on which courses to prioritise, information on retake procedures, or other specific assistance].",
        "",
        "I am committed to improving my academic standing and would greatly appreciate your advice.",
        "",
        "Yours faithfully,",
        name,
        matric,
        `${level} Student, Department of ${dept}`,
        "Phone: [Your Phone Number]",
        "Email: [Your Email Address]",
        "",
        "──────────────────────────────────────────────────────────────",
        "",
        "Keep this to one page. Fill in all bracketed sections. Deliver in person to your department office.",
      ].join("\n");
    },
  },


  {
    id: "draft-improvement-plan",
    title: "Draft Academic Improvement Plan",
    weight: 2,
    keywords: [
      "improvement plan", "academic plan", "study plan", "plan to improve",
      "how to plan", "draft plan", "academic improvement plan",
      "write my plan", "performance plan", "help me make a plan",
      "create a study plan", "make improvement plan",
    ],
    generateResponse(ctx) {
      const name    = ctx.studentName     || "Student";
      const school_ = ctx.school          || "University";
      const cgpa_   = ctx.cgpa            || "[Current CGPA]";
      const degCls  = ctx.degreeClass     || "[Current Class]";
      const target  = ctx.nextClassLabel  || "the next classification";
      const tgtMin  = ctx.nextClassMin    || "[Target CGPA]";
      const reqGPA  = ctx.requiredGPAForNextClass || "[Required GPA]";

      return [
        "── ACADEMIC IMPROVEMENT PLAN ──────────────────────────────────",
        `Student:      ${name}`,
        `Institution:  ${school_}`,
        `Current CGPA: ${cgpa_} (${degCls})`,
        `Target:       ${target} (${tgtMin})`,
        `Date:         ${today()}`,
        "───────────────────────────────────────────────────────────────",
        "",
        "SECTION 1 — CURRENT SITUATION",
        ctx.hasData
          ? `My CGPA of ${cgpa_} reflects ${ctx.totalCU} credit units across ${ctx.semesterCount} semester${ctx.semesterCount > 1 ? "s" : ""}.` +
            (ctx.failedCount > 0 ? ` I have ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""} to address.` : "")
          : "[Describe your current academic standing and any courses you are concerned about.]",
        "",
        "SECTION 2 — TARGET AND REQUIRED PERFORMANCE",
        ctx.hasData && reqGPA !== "[Required GPA]"
          ? `To reach ${target} (CGPA ${tgtMin}), I need a semester GPA of ${reqGPA} over my remaining ${ctx.remSems} semester${ctx.remSems > 1 ? "s" : ""} at ${ctx.estCUPerSem} units per semester.`
          : "[Use the Projection panel to calculate the required GPA per semester and enter it here.]",
        "",
        "SECTION 3 — ACTION STEPS",
        ctx.failedCount > 0
          ? `1. Retake ${ctx.failedCount} failed course${ctx.failedCount > 1 ? "s" : ""} — [list course names here] — Priority: Immediate.`
          : "1. Prevent new failures by attending all classes and submitting every assessment.",
        "2. High-credit focus: allocate at least 60% of study time to courses carrying 3 or more credit units.",
        "3. Weekly tracking: review my progress every week to confirm I am on pace for the required GPA.",
        "4. Early help: visit my lecturers during office hours for any course where I score below 50% on a test.",
        "5. Avoid late-night cramming before exams — use distributed study sessions across the semester.",
        "",
        "SECTION 4 — TIMELINE",
        "Semester start:       [Date]",
        "Mid-semester review:  [Date]",
        "Examination period:   [Date]",
        `Target GPA this semester: ${reqGPA}`,
        "",
        "SECTION 5 — COMMITMENT",
        `I, ${name}, commit to this plan and will review progress at mid-semester.`,
        "",
        "Signed: ___________________________    Date: _______________",
        "",
        "───────────────────────────────────────────────────────────────",
        "Fill in all dates and bracketed sections. Print and keep a copy.",
      ].join("\n");
    },
  },


  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORY G — GETTING STARTED
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: "greeting-help",
    title: "Getting Started",
    weight: 1,
    keywords: [
      "hello", "hi", "hey", "help", "help me", "what can you do",
      "what can i ask", "what do you know", "how can you help",
      "assist me", "good morning", "good evening", "good afternoon",
      "good day", "please help", "i need help", "get started",
      "how does this work", "what is this",
    ],
    generateResponse(ctx) {
      const intro = ctx.hasData
        ? `You have entered data for ${ctx.semesterCount} semester${ctx.semesterCount > 1 ? "s" : ""} at ${school(ctx)}. Your current CGPA is ${cgpaStr(ctx)} (${ctx.degreeClass || "calculating"}).`
        : ctx.hasInstitution
        ? `You have selected ${school(ctx)}. Enter your courses to unlock personalised answers.`
        : "Start by selecting your university from the top of the page. Then add your semesters and courses.";

      return [
        "Here is what you can ask me:",
        "- Am I on track for a First Class?\n- What GPA do I need next semester?\n- I failed a course — how bad is it?\n- What class will I graduate with at this rate?\n- How do I move from a 2:2 to a 2:1?\n- What is the minimum to avoid Third Class?\n- Draft an academic appeal letter or HOD letter\n- Is First Class still possible for me?\n- What is CGPA, GPA, or a quality point?",
        intro,
      ].join("\n\n");
    },
  },


];


// ── Suggested chips ────────────────────────────────────────────────────────────

export const SUGGESTED_CHIPS = [
  "Am I on track for a First Class?",
  "What GPA do I need next semester?",
  "I failed a course. How bad is it?",
  "What class will I graduate with at this rate?",
  "How do I move from a 2:2 to a 2:1?",
  "What is the minimum to avoid Third Class?",
  "Draft an academic appeal letter",
  "Is First Class still possible for me?",
];