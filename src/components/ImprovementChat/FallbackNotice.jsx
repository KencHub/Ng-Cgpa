// ── FallbackNotice.jsx ────────────────────────────────────────────────────────
// Knowledge Mode notice shown inside the chat panel.
//
// Previously indicated API unavailability. Now communicates the capabilities
// of the built-in knowledge base in a positive, informative tone.
// Shown at all times since the assistant always operates in knowledge mode.


import React from "react";


export default function FallbackNotice() {
  return (
    <div
      className="fallback-notice"
      role="status"
      aria-label="Assistant mode"
    >
      <span className="fallback-notice__icon" aria-hidden="true">
        <IconKnowledge />
      </span>
      <div className="fallback-notice__text">
        <span className="fallback-notice__title">
          Knowledge Mode — fully offline.
        </span>
        <span className="fallback-notice__body">
          Ask about CGPA, degree classes, projections, failed courses, or
          draft an appeal letter. Answers are personalised to your entered
          data automatically.
        </span>
      </div>
    </div>
  );
}


function IconKnowledge() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false"
    >
      <circle
        cx="7.5" cy="7.5" r="6.5"
        stroke="currentColor" strokeWidth="1.3"
      />
      <path
        d="M7.5 4.5v3.5l2 1.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="7.5" cy="4" r="0.75" fill="currentColor" />
    </svg>
  );
}