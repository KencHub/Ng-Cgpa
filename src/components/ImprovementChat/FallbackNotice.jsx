// ── FallbackNotice.jsx ────────────────────────────────────────────────────────
// A subtle notice strip shown inside the chat panel when the Anthropic API
// is unreachable.
//
// Communicates that the knowledge base is still active so users understand
// they can still get answers to common questions even without a connection.
// Does not block the input area — the user can still type and send.
//
// CSS lives in ImprovementChat.css.


import React from "react";


export default function FallbackNotice() {
  return (
    <div
      className="fallback-notice"
      role="status"
      aria-live="polite"
      aria-label="AI connection status"
    >
      <span className="fallback-notice__icon" aria-hidden="true">
        <IconOffline />
      </span>
      <div className="fallback-notice__text">
        <span className="fallback-notice__title">
          Using knowledge base.
        </span>
        <span className="fallback-notice__body">
          Connect to the internet for personalised answers based on
          your exact results.
        </span>
      </div>
    </div>
  );
}


function IconOffline() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M1.5 5A8.5 8.5 0 0 1 13.5 5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <path d="M3.5 8A5.5 5.5 0 0 1 11.5 8"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <path d="M5.5 11A2.5 2.5 0 0 1 9.5 11"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <circle cx="7.5" cy="13.5" r="1" fill="currentColor" />
      <path d="M2 2L13 13"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}