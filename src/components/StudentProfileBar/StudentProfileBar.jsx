// ── StudentProfileBar.jsx ─────────────────────────────────────────────────────
// Collapsible student profile section at the top of the left panel.
//
// All fields are optional. They populate the PDF export header and the
// AI chat system prompt. The section collapses to a one-line summary
// by default to save vertical space, especially on mobile.
//
// CSS is loaded from StudentProfileBar.css (built in Batch 15).


import React, { useState, useCallback, useId } from "react";
import "./StudentProfileBar.css";


// ── Level options ─────────────────────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: "",             label: "Not set" },
  { value: "100L",         label: "100 Level" },
  { value: "200L",         label: "200 Level" },
  { value: "300L",         label: "300 Level" },
  { value: "400L",         label: "400 Level" },
  { value: "500L",         label: "500 Level" },
  { value: "Postgraduate", label: "Postgraduate" },
  { value: "Other",        label: "Other" },
];


// ── Main component ────────────────────────────────────────────────────────────

export default function StudentProfileBar({ student, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const bodyId    = useId();

  const summary = buildSummary(student);
  const isFilled = hasAnyData(student);

  function toggle() {
    setExpanded((prev) => !prev);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  const handleChange = useCallback(
    (field) => (value) => {
      onUpdate({ [field]: value });
    },
    [onUpdate]
  );

  return (
    <div className="profile-bar panel-card">

      {/* ── Collapsible header ─────────────────────────────────────────────── */}
      <div
        className="collapsible-header profile-bar__header"
        role="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        id={headingId}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <div className="profile-bar__header-left">
          <span className="collapsible-header__title">Student Profile</span>

          {/* Summary shown when collapsed */}
          {!expanded && (
            <span
              className={`profile-bar__summary${isFilled ? "" : " profile-bar__summary--empty"}`}
              aria-hidden="true"
            >
              {summary}
            </span>
          )}
        </div>

        <svg
          className={`collapsible-chevron${expanded ? " collapsible-chevron--open" : ""}`}
          width="16" height="16" viewBox="0 0 16 16"
          fill="none" aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>


      {/* ── Collapsible body ───────────────────────────────────────────────── */}
      {expanded && (
        <div
          className="collapsible-body profile-bar__body"
          id={bodyId}
          role="region"
          aria-labelledby={headingId}
        >
          <p className="profile-bar__hint">
            These details appear on your PDF export. All fields are optional.
          </p>

          <div className="profile-bar__grid">

            <ProfileField
              label="Full Name"
              fieldKey="name"
              value={student.name}
              onChange={handleChange("name")}
              placeholder="e.g. Adaeze Okonkwo"
              autoComplete="name"
              tooltip="Your name as it will appear on exported documents."
            />

            <ProfileField
              label="Matric Number"
              fieldKey="matricNumber"
              value={student.matricNumber}
              onChange={handleChange("matricNumber")}
              placeholder="e.g. 2020/123456"
              tooltip="Your student registration number."
            />

            <ProfileField
              label="Department"
              fieldKey="department"
              value={student.department}
              onChange={handleChange("department")}
              placeholder="e.g. Computer Science"
              autoComplete="organization"
              tooltip="Your current department."
            />

            <ProfileField
              label="Faculty"
              fieldKey="faculty"
              value={student.faculty}
              onChange={handleChange("faculty")}
              placeholder="e.g. Engineering"
              tooltip="Your faculty or college."
            />

            <ProfileField
              label="Current Level"
              fieldKey="level"
              value={student.level}
              onChange={handleChange("level")}
              type="select"
              options={LEVEL_OPTIONS}
              tooltip="Your current academic level."
            />

            <ProfileField
              label="Academic Session"
              fieldKey="academicSession"
              value={student.academicSession}
              onChange={handleChange("academicSession")}
              placeholder="e.g. 2023/2024"
              tooltip="The current academic session year."
            />

          </div>
        </div>
      )}

    </div>
  );
}


// ── Profile field ─────────────────────────────────────────────────────────────

function ProfileField({
  label,
  fieldKey,
  value,
  onChange,
  placeholder = "",
  type        = "text",
  options     = [],
  autoComplete,
  tooltip,
}) {
  const id = `profile-${fieldKey}`;

  return (
    <div className="profile-field">
      <div className="profile-field__label-row">
        <label className="label profile-field__label" htmlFor={id}>
          {label}
        </label>

        {tooltip && (
          <span className="tooltip-anchor profile-field__tooltip-anchor">
            <span className="profile-field__tooltip-icon" aria-hidden="true">
              <IconInfo />
            </span>
            <span className="tooltip-box" role="tooltip">
              {tooltip}
            </span>
          </span>
        )}
      </div>

      {type === "select" ? (
        <select
          id={id}
          className="input-base profile-field__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          className="input-base"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={100}
          aria-label={label}
        />
      )}
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSummary(student) {
  const parts = [];
  if (student.name)            parts.push(student.name);
  if (student.department)      parts.push(student.department);
  if (student.level)           parts.push(student.level);
  if (student.academicSession) parts.push(student.academicSession);

  if (parts.length === 0) return "Add details for PDF export";
  return parts.join("  ·  ");
}

function hasAnyData(student) {
  return Object.values(student).some((v) => v && String(v).trim() !== "");
}


// ── Icon ──────────────────────────────────────────────────────────────────────

function IconInfo() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 5.5v3" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <circle cx="6" cy="4" r="0.65" fill="currentColor" />
    </svg>
  );
}