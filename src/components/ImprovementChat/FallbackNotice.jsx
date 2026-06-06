// ── FallbackNotice.jsx ────────────────────────────────────────────────────────

import React from "react";

export default function FallbackNotice() {
  return (
    <div
      className="fallback-notice"
      role="status"
      aria-label="Assistant info"
    >
      <span className="fallback-notice__icon" aria-hidden="true">
        <IconBook />
      </span>
      <div className="fallback-notice__text">
        <span className="fallback-notice__title">
          Ask me anything about your CGPA.
        </span>
        <span className="fallback-notice__body">
          Degree classes, projections, failed courses, what you need next
          semester, or draft an appeal letter. Answers use your entered
          data automatically.
        </span>
      </div>
    </div>
  );
}

function IconBook() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false"
    >
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v9a.5.5 0 0 1-.5.5H4a1 1 0 0 0 1 1h7.5a.5.5 0 0 1 0 1H5a2 2 0 0 1-2-2V3.5Z"
        stroke="currentColor" strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M5 5.5h5M5 8h3"
        stroke="currentColor" strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}