// ── ClearConfirmDialog.jsx ────────────────────────────────────────────────────
// Confirmation portal dialog shown before the irreversible "Clear All Data"
// action. Backdrop click and Escape key both cancel (never confirm) so an
// accidental click never triggers the destructive action.
//
// CSS lives in Modal.css.


import React, { useEffect } from "react";
import { createPortal }     from "react-dom";


export default function ClearConfirmDialog({ onConfirm, onCancel }) {

  // Close on Escape (cancel, not confirm)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <>
      {/* Backdrop — click = cancel */}
      <div
        className="backdrop"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="modal clear-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-confirm-title"
        aria-describedby="clear-confirm-desc"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="modal__header clear-confirm__header">
          <span className="clear-confirm__icon" aria-hidden="true">
            <IconWarning />
          </span>
          <h2 className="modal__title" id="clear-confirm-title">
            Clear all data?
          </h2>
          <button
            className="btn-icon"
            onClick={onCancel}
            aria-label="Cancel"
            type="button"
          >
            <IconX />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="modal__body clear-confirm__body" id="clear-confirm-desc">

          <p className="clear-confirm__lead">
            This will permanently remove:
          </p>

          <ul className="clear-confirm__list">
            <li>
              <span className="clear-confirm__bullet" aria-hidden="true">✕</span>
              All semesters and every course you have entered
            </li>
            <li>
              <span className="clear-confirm__bullet" aria-hidden="true">✕</span>
              Your student profile (name, department, matric number)
            </li>
            <li>
              <span className="clear-confirm__bullet" aria-hidden="true">✕</span>
              Your projection targets and forward simulation inputs
            </li>
            <li>
              <span className="clear-confirm__bullet" aria-hidden="true">✕</span>
              All saved data in your browser&rsquo;s local storage
            </li>
          </ul>

          <p className="clear-confirm__safe">
            <span className="clear-confirm__safe-icon" aria-hidden="true">✓</span>
            Your university selection and chat history are also cleared.
            This action cannot be undone.
          </p>

          <p className="clear-confirm__tip">
            <strong>Tip:</strong> Export a JSON backup first if you want to
            restore your data later. Use the Export menu in the header.
          </p>

        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="modal__footer clear-confirm__footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            type="button"
            autoFocus
          >
            Cancel
          </button>
          <button
            className="btn btn-danger clear-confirm__danger-btn"
            onClick={onConfirm}
            type="button"
          >
            <IconTrash />
            Yes, Clear Everything
          </button>
        </div>

      </div>
    </>,
    document.body
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconWarning() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3L22 20H2L12 3z"
        fill="var(--color-danger-light)"
        stroke="var(--color-danger)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v5"
        stroke="var(--color-danger)" strokeWidth="2"
        strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="var(--color-danger)" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.6 7.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-7.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6.5v3M8.5 6.5v3"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

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