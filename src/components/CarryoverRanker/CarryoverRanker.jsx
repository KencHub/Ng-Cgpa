// ── CarryoverRanker.jsx ───────────────────────────────────────────────────────
// Collapsible panel in the right column.
// Scans all semesters for failed courses (gradePoint === 0, creditUnits > 0).
// Ranks them by CGPA gain if retaken, showing the gain at each available grade.
// Only renders when at least one failed course exists.

import React, { useMemo, useState } from "react";
import { getClassification } from "../../utils/calculator.js";
import "./CarryoverRanker.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function CarryoverRanker({
  semesters,
  totals,
  cgpa,
  activeGradeTable,
  activeClassifications,
}) {
  const [collapsed, setCollapsed] = useState(false);

  // All failed courses across every semester
  const failedCourses = useMemo(() => {
    const results = [];
    for (const semester of semesters) {
      if (!Array.isArray(semester.courses)) continue;
      for (const course of semester.courses) {
        const cu = parseFloat(course.creditUnits);
        if (
          cu > 0 &&
          Number(course.gradePoint) === 0 &&
          course.grade !== null &&
          course.grade !== undefined &&
          course.grade !== ""
        ) {
          results.push({ ...course, semesterLabel: semester.label });
        }
      }
    }
    return results;
  }, [semesters]);

  // All non-zero grade entries sorted from lowest to highest point
  const nonZeroGrades = useMemo(
    () =>
      activeGradeTable
        .filter((g) => g.point > 0)
        .sort((a, b) => a.point - b.point),
    [activeGradeTable]
  );

  // Ranked list: each failed course with per-grade gain figures
  const rankings = useMemo(() => {
    if (!failedCourses.length || totals.totalCU === 0) return [];

    return failedCourses
      .map((course) => {
        const cu = parseFloat(course.creditUnits);

        const gradeGains = nonZeroGrades.map((g) => {
          const newTotalQP = totals.totalQP + cu * g.point;
          const newCGPA    = newTotalQP / totals.totalCU;
          const delta      = newCGPA - (cgpa ?? 0);
          const newClass   = getClassification(newCGPA, activeClassifications);
          return {
            letter:   g.letter,
            point:    g.point,
            newCGPA:  Math.round(newCGPA * 10000) / 10000,
            delta:    Math.round(delta * 10000) / 10000,
            newClass: newClass?.short ?? null,
          };
        });

        // Primary sort key: gain from barely passing (lowest non-zero grade)
        const minPassGain = gradeGains.length > 0 ? gradeGains[0].delta : 0;

        return { ...course, cu, gradeGains, minPassGain };
      })
      .sort((a, b) => b.minPassGain - a.minPassGain);
  }, [failedCourses, nonZeroGrades, totals, cgpa, activeClassifications]);

  const currentClass = useMemo(
    () => getClassification(cgpa, activeClassifications),
    [cgpa, activeClassifications]
  );

  if (rankings.length === 0) return null;

  return (
    <div className="carryover-ranker panel-card">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className="carryover-ranker__header"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCollapsed((v) => !v); }}
        aria-expanded={!collapsed}
        aria-label="Carryover priority panel"
      >
        <div className="carryover-ranker__header-left">
          <span className="label carryover-ranker__label">Carryover Priority</span>
          <span className="carryover-ranker__count">
            {rankings.length} failed {rankings.length === 1 ? "course" : "courses"}
          </span>
        </div>
        <span className="carryover-ranker__chevron">
          <IconChevron open={!collapsed} />
        </span>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="carryover-ranker__body">
          <p className="carryover-ranker__intro">
            Ranked by CGPA gain if retaken and passed. The top course has the biggest impact.
          </p>

          {rankings.map((item, idx) => (
            <CarryoverItem
              key={item.id}
              rank={idx + 1}
              item={item}
              currentClass={currentClass}
            />
          ))}
        </div>
      )}

    </div>
  );
}


// ── Individual ranked course ──────────────────────────────────────────────────

function CarryoverItem({ rank, item, currentClass }) {
  const [expanded, setExpanded] = useState(false);

  const displayGrades = expanded
    ? item.gradeGains
    : item.gradeGains.slice(0, 3);

  const hasMore = item.gradeGains.length > 3;

  return (
    <div className={`carryover-item${rank === 1 ? " carryover-item--top" : ""}`}>

      <div className="carryover-item__meta">
        <span className="carryover-item__rank">#{rank}</span>
        <div className="carryover-item__info">
          <span className="carryover-item__name">
            {item.name || "Unnamed course"}
          </span>
          <span className="carryover-item__detail">
            {item.cu} CU · {item.semesterLabel}
          </span>
        </div>
        <span className="carryover-item__badge">F</span>
      </div>

      <div className="carryover-item__gains">
        {displayGrades.map((g) => {
          const classChanged =
            g.newClass &&
            currentClass?.short &&
            g.newClass !== currentClass.short;

          return (
            <div key={g.letter} className="carryover-gain">
              <span className="carryover-gain__grade">{g.letter}</span>
              <span className="carryover-gain__arrow">→</span>
              <span className="carryover-gain__cgpa">
                {g.newCGPA.toFixed(4)}
              </span>
              <span className="carryover-gain__delta">
                +{g.delta.toFixed(4)}
              </span>
              {classChanged && (
                <span className="carryover-gain__class-change">
                  {g.newClass}
                </span>
              )}
            </div>
          );
        })}

        {hasMore && (
          <button
            className="carryover-item__expand"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            {expanded
              ? "Show fewer grades"
              : `+${item.gradeGains.length - 3} more grades`}
          </button>
        )}
      </div>

    </div>
  );
}


// ── Icon ──────────────────────────────────────────────────────────────────────

function IconChevron({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{
        transform:  open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 200ms ease",
      }}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}