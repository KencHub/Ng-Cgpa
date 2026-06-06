// ── SuggestedChips.jsx ────────────────────────────────────────────────────────
// Renders the suggested prompt chips above the chat input.
//
// Chips are displayed in a compact 2-column grid. Each chip contains a
// short question that the student can tap to send immediately.
// The chips stay visible throughout the conversation for discoverability.
//
// CSS lives in ImprovementChat.css.


import React from "react";


export default function SuggestedChips({ chips, onSelect, disabled }) {
  if (!Array.isArray(chips) || chips.length === 0) return null;

  return (
    <div className="suggested-chips" aria-label="Suggested questions">
      <p className="suggested-chips__label label">Suggested</p>
      <div className="suggested-chips__grid" role="list">
        {chips.map((chip) => (
          <button
            key={chip}
            className="suggested-chip"
            onClick={() => onSelect(chip)}
            disabled={disabled}
            type="button"
            title={chip}
            role="listitem"
            aria-label={`Ask: ${chip}`}
          >
            <span className="suggested-chip__icon" aria-hidden="true">
              <IconChip />
            </span>
            <span className="suggested-chip__text">{chip}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


function IconChip() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M1.5 5h7M6 2.5l2.5 2.5L6 7.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}