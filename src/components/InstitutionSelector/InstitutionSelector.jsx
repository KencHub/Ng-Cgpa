// ── InstitutionSelector.jsx ───────────────────────────────────────────────────
// Header institution display and trigger.
//
// Shows the currently selected institution with its logo, name, type badge,
// and scale badge. Clicking anywhere on the component opens the InstitutionModal.
// A separate info button opens the same modal for full institution details.
//
// Also exports InstitutionSearch and ScaleBadge as named exports.
// InstitutionSearch is used here and reused inside InstitutionModal (Batch 24).
// ScaleBadge is reused in InstitutionModal and CGPASummary.
//
// InstitutionLogo is imported from Batch 14 (same directory).


import React, { useRef } from "react";
import InstitutionLogo from "./InstitutionLogo.jsx";
import "./InstitutionSelector.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function InstitutionSelector({
  institution,
  useUILegacyScale,
  onOpenModal,
  onOpenInfo,
}) {
  const hasInstitution = institution !== null && institution !== undefined;

  return (
    <div className="inst-selector">

      {/* Clickable display area */}
      <button
        className={`inst-selector__trigger${!hasInstitution ? " inst-selector__trigger--empty" : ""}`}
        onClick={onOpenModal}
        aria-label={
          hasInstitution
            ? `Change institution: ${institution.name}`
            : "Select your university"
        }
        title={hasInstitution ? institution.name : "Select your university"}
        type="button"
      >
        {hasInstitution ? (
          <SelectedInstitution
            institution={institution}
            useUILegacyScale={useUILegacyScale}
          />
        ) : (
          <EmptyInstitution />
        )}
      </button>

      {/* Info button — shown only when an institution is selected */}
      {hasInstitution && (
        <button
          className="inst-selector__info-btn btn-icon"
          onClick={onOpenInfo}
          aria-label={`View details for ${institution.name}`}
          title="View institution details"
          type="button"
        >
          <IconInfo />
        </button>
      )}

    </div>
  );
}


// ── Selected institution display ──────────────────────────────────────────────

function SelectedInstitution({ institution, useUILegacyScale }) {
  const effectiveScale = useUILegacyScale && institution.legacyScale
    ? institution.legacyScale.scale
    : institution.scale;

  const isLegacy = useUILegacyScale && institution.legacyScale;

  return (
    <div className="inst-selected">
      <InstitutionLogo
        institution={institution}
        size={28}
        className="inst-selected__logo"
      />

      <div className="inst-selected__text">
        <span className="inst-selected__name">
          {institution.shortName || institution.id}
        </span>
        <span className="inst-selected__full-name">
          {institution.name}
        </span>
      </div>

      <div className="inst-selected__badges">
        <ScaleBadge
          scale={effectiveScale}
          scaleGroup={isLegacy ? "SEVEN_POINT" : institution.scaleGroup}
          compact
        />
        {institution.type && institution.type !== "Custom" && (
          <TypeBadge type={institution.type} />
        )}
      </div>

      <span className="inst-selected__change-hint" aria-hidden="true">
        <IconChevron />
      </span>
    </div>
  );
}


// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyInstitution() {
  return (
    <div className="inst-empty">
      <span className="inst-empty__icon" aria-hidden="true">
        <IconUniversity />
      </span>
      <span className="inst-empty__text">Select your university</span>
      <span className="inst-empty__arrow" aria-hidden="true">
        <IconChevron />
      </span>
    </div>
  );
}


// ── Scale badge ───────────────────────────────────────────────────────────────
// Exported for reuse in InstitutionModal and CGPASummary.

export function ScaleBadge({ scale, scaleGroup, compact = false }) {
  const label  = formatScaleLabel(scale, scaleGroup);
  const mod    = getScaleBadgeMod(scaleGroup);

  return (
    <span
      className={`scale-badge scale-badge--${mod}${compact ? " scale-badge--compact" : ""}`}
      title={`Grading scale: ${label}`}
    >
      {label}
    </span>
  );
}

function formatScaleLabel(scale, scaleGroup) {
  if (scaleGroup === "SEVEN_POINT") return "7.0 Legacy";
  if (scaleGroup === "CUSTOM")      return "Custom";
  if (scale === 5.0)                return "5.0 Scale";
  if (scale === 4.0)                return "4.0 Scale";
  return `${scale} Scale`;
}

function getScaleBadgeMod(scaleGroup) {
  if (scaleGroup === "NUC_5")       return "five";
  if (scaleGroup === "FOUR_POINT")  return "four";
  if (scaleGroup === "SEVEN_POINT") return "seven";
  return "custom";
}


// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const mod = type === "Federal" ? "federal"
            : type === "State"   ? "state"
            : type === "Private" ? "private"
            : "neutral";
  return (
    <span className={`type-badge type-badge--${mod}`}>
      {type}
    </span>
  );
}


// ── Institution search ────────────────────────────────────────────────────────
// Exported for reuse in InstitutionModal (Batch 24).

export function InstitutionSearch({
  value,
  onChange,
  onClear,
  placeholder = "Search universities...",
  autoFocus = false,
}) {
  const inputRef = useRef(null);

  return (
    <div className="inst-search">
      <span className="inst-search__icon" aria-hidden="true">
        <IconSearch />
      </span>

      <input
        ref={inputRef}
        type="text"
        className="inst-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        autoFocus={autoFocus}
        aria-label="Search universities"
      />

      {value.length > 0 && (
        <button
          className="inst-search__clear btn-icon"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          type="button"
        >
          <IconX />
        </button>
      )}
    </div>
  );
}


// ── Institution list item ─────────────────────────────────────────────────────
// Exported for reuse in InstitutionModal (Batch 24).

export function InstitutionListItem({
  institution,
  isSelected,
  onClick,
}) {
  return (
    <button
      className={`inst-list-item${isSelected ? " inst-list-item--selected" : ""}`}
      onClick={() => onClick(institution)}
      type="button"
      role="option"
      aria-selected={isSelected}
    >
      <InstitutionLogo
        institution={institution}
        size={32}
        className="inst-list-item__logo"
      />

      <div className="inst-list-item__text">
        <span className="inst-list-item__name">
          {institution.name}
        </span>
        <span className="inst-list-item__meta">
          {institution.location}
          {institution.type && institution.type !== "Custom" && (
            <> &middot; {institution.type}</>
          )}
        </span>
      </div>

      <div className="inst-list-item__right">
        <ScaleBadge
          scale={institution.scale}
          scaleGroup={institution.scaleGroup}
          compact
        />
        {isSelected && (
          <span className="inst-list-item__check" aria-hidden="true">
            <IconCheck />
          </span>
        )}
      </div>
    </button>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconUniversity() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 11.5 L8 6 L14 11.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="4.5" y="11.5" width="7" height="4" rx="0.5"
        stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.5" y="9" width="3" height="2.5" rx="0.5"
        fill="currentColor" opacity="0.4" />
      <path d="M8 4V6.5" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <circle cx="8" cy="3" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 7v3.5" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
      <circle cx="7.5" cy="5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 5l2 2 2-2" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7l3.5 3.5 6-6" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}