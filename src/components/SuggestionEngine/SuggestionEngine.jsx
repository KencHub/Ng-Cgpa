// ── SuggestionEngine.jsx ──────────────────────────────────────────────────────
// Renders zero or more contextual suggestion banners below the semester panel.
//
// All banner content and logic lives in suggestions.js (Batch 6).
// This component is purely presentational: it maps the suggestions array
// to styled, dismissable banners.
//
// Banners animate in on mount and slide out on dismiss. After the exit
// animation completes, onDismiss(id) is called to record the dismissal
// in useCGPA state so the banner does not reappear for the current data.
//
// The engine renders nothing (no wrapper element) when there are no active
// suggestions, so it never creates dead space in the layout.


import React, { useState } from "react";
import "./SuggestionEngine.css";


// ── Icon components ───────────────────────────────────────────────────────────

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.5"
        stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7v4.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.85" fill="currentColor" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M8 2L14.5 13.5H1.5L8 2z"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6.5v3.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconDanger() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.5"
        stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v4.5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.85" fill="currentColor" />
    </svg>
  );
}

function IconSuccess() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.5"
        stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8l2.5 2.5 4-5"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M2 2l8 8M10 2l-8 8"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
    </svg>
  );
}

const TYPE_ICONS = {
  info:    <IconInfo />,
  warning: <IconWarning />,
  danger:  <IconDanger />,
  success: <IconSuccess />,
};

const TYPE_ARIA_ROLES = {
  danger:  "alert",
  warning: "alert",
  info:    "status",
  success: "status",
};


// ── SuggestionBanner ──────────────────────────────────────────────────────────

function SuggestionBanner({ suggestion, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);

  const { id, type, message } = suggestion;
  const icon     = TYPE_ICONS[type]      || TYPE_ICONS.info;
  const ariaRole = TYPE_ARIA_ROLES[type] || "status";

  function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
  }

  function handleAnimationEnd(e) {
    // Only fire for the exit animation, not the entry animation
    if (dismissing && e.animationName === "bannerExit") {
      onDismiss(id);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDismiss();
    }
  }

  return (
    <div
      className={[
        "suggestion-banner",
        `suggestion-banner--${type}`,
        dismissing ? "suggestion-banner--dismissing" : "",
      ].filter(Boolean).join(" ")}
      role={ariaRole}
      aria-live={ariaRole === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Type icon */}
      <span
        className="suggestion-banner__icon"
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Message */}
      <p className="suggestion-banner__message">
        {message}
      </p>

      {/* Dismiss button */}
      <button
        className="suggestion-banner__dismiss"
        onClick={handleDismiss}
        onKeyDown={handleKeyDown}
        aria-label="Dismiss this suggestion"
        title="Dismiss"
        type="button"
      >
        <IconX />
      </button>
    </div>
  );
}


// ── SuggestionEngine ──────────────────────────────────────────────────────────

export default function SuggestionEngine({ suggestions, onDismiss }) {
  // Render nothing — no wrapper — when there are no active suggestions.
  // This prevents a phantom gap from appearing in the layout.
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="suggestion-engine"
      aria-label="Suggestions"
    >
      {suggestions.map((suggestion) => (
        <SuggestionBanner
          key={suggestion.id}
          suggestion={suggestion}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}