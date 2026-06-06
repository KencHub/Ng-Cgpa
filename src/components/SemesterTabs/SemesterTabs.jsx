// ── SemesterTabs.jsx ──────────────────────────────────────────────────────────
// Horizontal scrollable tab strip for navigating between semesters.
//
// Each tab shows a shortened semester label and a dot indicator when
// the semester contains courses. The active tab is highlighted with a
// primary-colour bottom border.
//
// The Add Semester button lives at the trailing end of the strip.
// When no semesters exist yet, the component renders a centred first-add prompt.


import React, { useRef, useEffect, useState, useCallback } from "react";
import "./SemesterTabs.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function SemesterTabs({
  semesters,
  activeTab,
  onSetActive,
  onAdd,
}) {
  const scrollRef  = useRef(null);
  const activeRef  = useRef(null);
  const [showLeftFade,  setShowLeftFade]  = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Scroll active tab into view whenever activeTab changes
  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current.scrollIntoView({
      behavior: "smooth",
      block:    "nearest",
      inline:   "nearest",
    });
  }, [activeTab]);

  // Update fade shadows based on scroll position
  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [updateFades, semesters.length]);

  // Empty state — no semesters yet
  if (semesters.length === 0) {
    return (
      <div className="semester-tabs semester-tabs--empty">
        <button
          className="semester-tabs__first-add"
          onClick={onAdd}
          aria-label="Add your first semester"
        >
          <IconPlus />
          <span>Add First Semester</span>
        </button>
      </div>
    );
  }

  return (
    <div className="semester-tabs">
      {/* Left fade shadow */}
      {showLeftFade && (
        <div className="semester-tabs__fade semester-tabs__fade--left"
          aria-hidden="true" />
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="semester-tabs__scroll"
        role="tablist"
        aria-label="Semesters"
      >
        {semesters.map((sem) => {
          const isActive   = sem.id === activeTab;
          const hasCourses = sem.courses.length > 0;
          const label      = shortenLabel(sem.label);

          return (
            <button
              key={sem.id}
              ref={isActive ? activeRef : null}
              className={`semester-tab${isActive ? " semester-tab--active" : ""}${hasCourses ? " semester-tab--has-data" : ""}`}
              role="tab"
              aria-selected={isActive}
              aria-label={sem.label}
              title={sem.label}
              onClick={() => onSetActive(sem.id)}
            >
              <span className="semester-tab__label">{label}</span>

              {hasCourses && !isActive && (
                <span
                  className="semester-tab__dot"
                  aria-hidden="true"
                  title={`${sem.courses.length} course${sem.courses.length === 1 ? "" : "s"}`}
                />
              )}

              {isActive && (
                <span
                  className="semester-tab__count"
                  aria-hidden="true"
                >
                  {sem.courses.length > 0 ? sem.courses.length : ""}
                </span>
              )}
            </button>
          );
        })}

        {/* Add semester */}
        <button
          className="semester-tabs__add"
          onClick={onAdd}
          aria-label="Add new semester"
          title="Add new semester"
        >
          <IconPlus />
          <span className="semester-tabs__add-label">Add</span>
        </button>
      </div>

      {/* Right fade shadow */}
      {showRightFade && (
        <div className="semester-tabs__fade semester-tabs__fade--right"
          aria-hidden="true" />
      )}
    </div>
  );
}


// ── Label shortener ───────────────────────────────────────────────────────────

/**
 * Shortens common semester label patterns to fit in tabs.
 *
 * "100L First Semester"  → "100L First"
 * "200L Second Semester" → "200L Second"
 * "300L First Semester"  → "300L First"
 * Custom labels are returned as-is and truncated by CSS max-width.
 *
 * @param {string} label
 * @returns {string}
 */
function shortenLabel(label) {
  if (!label) return "Semester";

  // Strip the word "Semester" from standard Nigerian uni labels
  const stripped = label.replace(/\bSemester\b/gi, "").trim();

  // Normalise multiple spaces
  return stripped.replace(/\s{2,}/g, " ").trim() || label;
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M7 2v10M2 7h10"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" />
    </svg>
  );
}