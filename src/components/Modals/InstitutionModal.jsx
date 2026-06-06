// ── InstitutionModal.jsx ──────────────────────────────────────────────────────
// Full-screen portal modal for browsing, previewing, and selecting an
// institution. Also displays the full grading details of the focused school.
//
// Flow:
//   1. Open → current institution highlighted in list + details shown
//   2. User types in search → list filters live
//   3. User clicks a row → that institution is previewed below the list
//   4. "Use This University" button → onSelect(focused) → modal closes
//
// UI-specific toggles:
//   — Legacy 7.0 scale: only shown when University of Ibadan is previewed
//
// Fix notes (v2.1):
//   — Replaced <details>/<summary> with React useState toggles.
//     Android Chrome renders native ► markers even with display:flex + list-style:none.
//   — Wrapped IconExternal in a <span> so both flex children are spans.
//     Bare SVG elements can be forced to display:block by some Android resets.
//   — class-table__info uses display:block + display:block on label.
//     flex-direction:column was not applying reliably.
//   — NUC note uses a custom circle-i span instead of the ℹ codepoint.


import React, { useState, useEffect, useMemo } from "react";
import { createPortal }         from "react-dom";
import { searchInstitutions }   from "../../data/institutionRegistry.js";
import InstitutionLogo          from "../InstitutionSelector/InstitutionLogo.jsx";
import {
  InstitutionSearch,
  InstitutionListItem,
  ScaleBadge,
} from "../InstitutionSelector/InstitutionSelector.jsx";
import "./Modal.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function InstitutionModal({
  institution,
  useUILegacyScale,
  onSelect,
  onToggleLegacy,
  onClose,
  infoOnly = false,
}) {
  const [query,      setQuery]      = useState("");
  const [focused,    setFocused]    = useState(institution || null);
  const [gradeOpen,  setGradeOpen]  = useState(false);
  const [classOpen,  setClassOpen]  = useState(true);

  // Close on Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Filtered institution list
  const results = useMemo(() => searchInstitutions(query), [query]);

  function handleFocus(inst) {
    setFocused(inst);
    setQuery("");
    // Reset sections when a different school is previewed
    setGradeOpen(false);
    setClassOpen(true);
  }

  function handleConfirm() {
    if (focused) onSelect(focused);
  }

  const isAlreadySelected = focused?.id === institution?.id;

  // Active grading data for the focused institution
  const activeGradeTable = useMemo(() => {
    if (!focused) return [];
    if (focused.id === "UI" && useUILegacyScale && focused.legacyScale) {
      return focused.legacyScale.gradeTable;
    }
    return focused.gradeTable || [];
  }, [focused, useUILegacyScale]);

  const activeClassifications = useMemo(() => {
    if (!focused) return [];
    if (focused.id === "UI" && useUILegacyScale && focused.legacyScale) {
      return focused.legacyScale.classifications;
    }
    return focused.classifications || [];
  }, [focused, useUILegacyScale]);

  const activePassmark = useMemo(() => {
    if (!focused) return null;
    if (focused.id === "UI" && useUILegacyScale && focused.legacyScale) {
      return focused.legacyScale.passmark ?? focused.passmark;
    }
    return focused.passmark;
  }, [focused, useUILegacyScale]);

  const activeScale = focused?.id === "UI" && useUILegacyScale
    ? focused?.legacyScale?.scale
    : focused?.scale;

  const activeScaleGroup = focused?.id === "UI" && useUILegacyScale
    ? "SEVEN_POINT"
    : focused?.scaleGroup;

  // Normalise website href once
  const websiteHref = focused?.website
    ? (focused.website.startsWith("http")
        ? focused.website
        : `https://${focused.website}`)
    : null;


  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="modal institution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inst-modal-title"
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="modal__header">
          <h2 className="modal__title" id="inst-modal-title">
            {infoOnly ? "Institution Details" : "Select University"}
          </h2>
          <button
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <IconX />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="modal__body institution-modal__body">

          {/* Search — selection mode only */}
          {!infoOnly && (
            <div className="institution-modal__search-wrap">
              <InstitutionSearch
                value={query}
                onChange={setQuery}
                onClear={() => setQuery("")}
                autoFocus
              />
            </div>
          )}

          {/* Institution list — selection mode only */}
          {!infoOnly && (
            <div
              className="institution-modal__list"
              role="listbox"
              aria-label="Universities"
            >
              {results.length === 0 ? (
                <p className="institution-modal__no-results">
                  No universities match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                results.map((inst) => (
                  <InstitutionListItem
                    key={inst.id}
                    institution={inst}
                    isSelected={focused?.id === inst.id}
                    onClick={handleFocus}
                  />
                ))
              )}
            </div>
          )}

          {/* Institution details panel.
    Only rendered in infoOnly mode.
    In infoOnly mode: the whole body is just this panel. */}
          {infoOnly && focused && (
  <div className="institution-modal__details">

              {/* ── Detail header: logo + name + tags ─────────────────── */}
              <div className="inst-detail__header">
                <InstitutionLogo
                  institution={focused}
                  size={48}
                  className="inst-detail__logo"
                />
                <div className="inst-detail__meta">
                  <h3 className="inst-detail__name">{focused.name}</h3>
                  <div className="inst-detail__tags">
                    <span className="inst-detail__location">
                      {focused.location}
                    </span>
                    <ScaleBadge
                      scale={activeScale}
                      scaleGroup={activeScaleGroup}
                    />
                    {focused.type && focused.type !== "Custom" && (
                      <span className="inst-detail__type-tag">
                        {focused.type}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Website link ──────────────────────────────────────── */}
              {/* IconExternal is wrapped in a <span> so both flex children
                  are span elements. Bare SVG in a flex container can be
                  forced to display:block on Android Chrome, breaking the row. */}
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inst-detail__website-link"
                  aria-label={`Open ${focused.name} official website`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inst-detail__website-icon" aria-hidden="true">
                    <IconExternal />
                  </span>
                  <span className="inst-detail__website-url">{websiteHref}</span>
                </a>
              )}

              {/* ── UI Legacy scale toggle ────────────────────────────── */}
              {focused.id === "UI" && focused.legacyScale && (
                <label className="inst-detail__legacy-toggle">
                  <input
                    type="checkbox"
                    className="inst-detail__legacy-checkbox"
                    checked={useUILegacyScale}
                    onChange={onToggleLegacy}
                  />
                  <span>
                    I was admitted{" "}
                    <strong>before the 2016/2017 session</strong> — use the
                    legacy 7.0 grading scale
                  </span>
                </label>
              )}

              {/* ── NUC 5.0 note ──────────────────────────────────────── */}
              {/* Uses a custom circle-i span. The ℹ Unicode codepoint
                  renders as a bare "i" on many Android fonts. */}
              {focused.scaleGroup === "NUC_5" && (
                <div className="inst-detail__nuc-note">
                  <span className="inst-detail__nuc-icon" aria-hidden="true">i</span>
                  <span className="inst-detail__nuc-text">
                    NUC proposed but did not complete a mandatory switch to 4.0
                    for all universities. This institution&rsquo;s official scale
                    remains 5.0.
                  </span>
                </div>
              )}

              {/* ── Grade table — React-controlled collapsible ─────────── */}
              {/* Using a <button> toggle instead of <details>/<summary>.
                  Android Chrome shows its native ► marker on <summary> even
                  with display:flex + list-style:none + ::marker suppression. */}
              <div className="inst-detail__section">
                <button
                  type="button"
                  className="inst-detail__section-toggle"
                  onClick={() => setGradeOpen((o) => !o)}
                  aria-expanded={gradeOpen}
                >
                  <span
                    className={`inst-detail__chevron${gradeOpen ? " inst-detail__chevron--open" : ""}`}
                    aria-hidden="true"
                  >
                    <IconChevron />
                  </span>
                  <span className="inst-detail__section-title">Grade Table</span>
                  <span className="inst-detail__pass-mark">
                    Pass mark: {activePassmark}%
                  </span>
                </button>
                {gradeOpen && (
                  <div className="inst-detail__section-body">
                    <GradeTableDisplay gradeTable={activeGradeTable} />
                  </div>
                )}
              </div>

              {/* ── Degree classifications — open by default ──────────── */}
              <div className="inst-detail__section">
                <button
                  type="button"
                  className="inst-detail__section-toggle"
                  onClick={() => setClassOpen((o) => !o)}
                  aria-expanded={classOpen}
                >
                  <span
                    className={`inst-detail__chevron${classOpen ? " inst-detail__chevron--open" : ""}`}
                    aria-hidden="true"
                  >
                    <IconChevron />
                  </span>
                  <span className="inst-detail__section-title">
                    Degree Classifications
                  </span>
                </button>
                {classOpen && (
                  <div className="inst-detail__section-body">
                    <ClassificationTableDisplay
                      classifications={activeClassifications}
                    />
                  </div>
                )}
              </div>

              {/* ── Notes ─────────────────────────────────────────────── */}
              {focused.notes && (
                <p className="inst-detail__notes">{focused.notes}</p>
              )}

            </div>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="modal__footer">
          {infoOnly ? (
            <button
              className="btn btn-primary"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={!focused}
                type="button"
              >
                {isAlreadySelected
                  ? "Keep This University"
                  : "Use This University"}
              </button>
            </>
          )}
        </div>

      </div>
    </>,
    document.body
  );
}


// ── Grade table display ───────────────────────────────────────────────────────

function GradeTableDisplay({ gradeTable }) {
  if (!Array.isArray(gradeTable) || gradeTable.length === 0) return null;

  return (
    <div className="grade-table">
      <table className="grade-table__table" aria-label="Grade table">
        <thead>
          <tr>
            <th className="grade-table__th">Grade</th>
            <th className="grade-table__th">Score Range</th>
            <th className="grade-table__th">Points</th>
            <th className="grade-table__th grade-table__th--remark">Remark</th>
          </tr>
        </thead>
        <tbody>
          {gradeTable.map((entry) => (
            <tr key={entry.letter} className="grade-table__row">
              <td className="grade-table__td grade-table__td--letter">
                <span
                  className={`grade-table__letter grade-table__letter--${
                    entry.point === 0   ? "fail"
                    : entry.point >= 4  ? "high"
                    : entry.point >= 2  ? "mid"
                    : "low"
                  }`}
                >
                  {entry.letter}
                </span>
              </td>
              <td className="grade-table__td grade-table__td--range">
                {entry.min}–{entry.max}
              </td>
              <td className="grade-table__td grade-table__td--points">
                {entry.point}
              </td>
              <td className="grade-table__td grade-table__td--remark">
                {entry.remark}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ── Classification table display ──────────────────────────────────────────────
// label renders as display:block so it always occupies its own line.
// short renders as display:inline-block with margin-top below it.
// This is more reliable than flex-direction:column which can fail to apply
// in certain cascade contexts on Android Chrome.

function ClassificationTableDisplay({ classifications }) {
  if (!Array.isArray(classifications) || classifications.length === 0) {
    return null;
  }

  const sorted = [...classifications].sort((a, b) => b.min - a.min);

  return (
    <div className="class-table">
      {sorted.map((entry, index) => (
        <div
          key={entry.min}
          className="class-table__row"
          data-rank={index}
        >
          <span className="class-table__range">
            {entry.min.toFixed(2)}–{entry.max.toFixed(2)}
          </span>
          <div className="class-table__info">
            <span className="class-table__label">{entry.label}</span>
            <span className="class-table__short">{entry.short}</span>
          </div>
        </div>
      ))}
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13"
        stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M6 2H2.5A1.5 1.5 0 0 0 1 3.5v8A1.5 1.5 0 0 0 2.5 13h8A1.5 1.5 0 0 0 12 11.5V8"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 1h5v5M13 1L7 7"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M4 2l4 4-4 4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}