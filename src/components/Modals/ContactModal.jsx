// ── ContactModal.jsx ──────────────────────────────────────────────────────────
// Two-step contact modal.
// Step 1: Channel selection (Email / WhatsApp)
// Step 2: Intent selection + pre-filled message preview + send button
//
// Props:
//   onClose   — closes the modal
//   context   — optional { institutionName: string }
//               Pre-selects "Correct institution data" and shows a context banner.
//               Pass null for general contact from the footer.
//
// Configuration (update before deploying):
//   EMAIL     — contact email
//   WHATSAPP  — international number without "+", e.g. "2348012345678"

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";


// ── Configuration ─────────────────────────────────────────────────────────────

const EMAIL    = "kctrical@gmail.com";
const WHATSAPP = "YOUR_WHATSAPP_NUMBER"; // TODO: Replace with e.g. "2348012345678"


// ── Intent definitions ────────────────────────────────────────────────────────

const INTENTS = [
  {
    id:           "calc-error",
    dot:          "danger",
    label:        "Report a calculation error",
    emailSubject: ()     => "[NG CGPA] Calculation Error Report",
    emailBody:    ()     =>
      "Hi Nonso,\n\nI found a calculation issue in NG CGPA.\n\n" +
      "[Please describe the error — include your university, CGPA values, and what seems wrong]\n\n" +
      "Thank you.",
    waText:       ()     =>
      "Hi Nonso, I found a calculation issue in NG CGPA. " +
      "[Please describe the error — include your university and CGPA values]",
  },
  {
    id:           "data-correction",
    dot:          "warning",
    label:        "Correct institution data",
    emailSubject: (name) => `[NG CGPA] Data Correction${name ? ` — ${name}` : ""}`,
    emailBody:    (name) =>
      `Hi Nonso,\n\nI want to correct some data for ${name || "an institution"} in NG CGPA.\n\n` +
      "[Please describe what is wrong and what the correct information is]\n\n" +
      "Thank you.",
    waText:       (name) =>
      `Hi Nonso, I want to correct data for ${name || "an institution"} in NG CGPA. ` +
      "[Please describe what is wrong and the correct info]",
  },
  {
    id:           "suggest-uni",
    dot:          "success",
    label:        "Suggest a new university",
    emailSubject: ()     => "[NG CGPA] New University Suggestion",
    emailBody:    ()     =>
      "Hi Nonso,\n\nI'd like to suggest adding a university to NG CGPA.\n\n" +
      "University name: \nLocation: \nGrading scale (e.g. 5.0 / 4.0): \nWebsite: \n\n" +
      "Thank you.",
    waText:       ()     =>
      "Hi Nonso, I'd like to suggest adding a university to NG CGPA. " +
      "University: [name], Scale: [e.g. 5.0], Website: [url]",
  },
  {
    id:           "general",
    dot:          "info",
    label:        "General feedback or support",
    emailSubject: ()     => "[NG CGPA] Feedback",
    emailBody:    ()     =>
      "Hi Nonso,\n\nI'm reaching out about NG CGPA.\n\n[Your message here]\n\nThank you.",
    waText:       ()     =>
      "Hi Nonso, I'm reaching out about NG CGPA. [Your message here]",
  },
];


// ── Main component ────────────────────────────────────────────────────────────

export default function ContactModal({ onClose, context = null }) {
  const institutionName = context?.institutionName || null;

  const [step,     setStep]     = useState(1);
  const [channel,  setChannel]  = useState(null);
  const [intentId, setIntentId] = useState(
    institutionName ? "data-correction" : null
  );

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const activeIntent = useMemo(
    () => INTENTS.find((i) => i.id === intentId) || null,
    [intentId]
  );

  function resolve(fn) {
    if (!fn) return "";
    return typeof fn === "function" ? fn(institutionName) : fn;
  }

  const previewSubject = activeIntent ? resolve(activeIntent.emailSubject) : "";
  const previewBody    = activeIntent ? resolve(activeIntent.emailBody)    : "";
  const previewWa      = activeIntent ? resolve(activeIntent.waText)       : "";

  function handleChannelSelect(ch) {
    setChannel(ch);
    setStep(2);
  }

  function handleBack() {
    setChannel(null);
    setStep(1);
  }

  function handleSend() {
    if (!channel || !activeIntent) return;
    if (channel === "email") {
      const url =
        `mailto:${EMAIL}` +
        `?subject=${encodeURIComponent(previewSubject)}` +
        `&body=${encodeURIComponent(previewBody)}`;
      window.open(url, "_blank");
    } else {
      const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(previewWa)}`;
      window.open(url, "_blank");
    }
    onClose();
  }

  const canSend = channel && intentId;


  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />

      <div
        className="modal contact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="modal__header">
          <div className="contact-modal__header-left">
            {step === 2 && (
              <button
                className="contact-modal__back-btn"
                onClick={handleBack}
                type="button"
                aria-label="Back to channel selection"
              >
                <IconChevronLeft />
                <span>Back</span>
              </button>
            )}
            <h2 className="modal__title" id="contact-modal-title">
              Reach Nonso
            </h2>
          </div>
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
        <div className="modal__body contact-modal__body">

          <p className="contact-modal__tagline">
            NG CGPA is maintained by one person. Every correction makes it
            better for everyone.
          </p>

          {/* Context banner — only shown when triggered from Institution Modal */}
          {institutionName && (
            <div className="contact-modal__context-banner">
              <span className="contact-modal__context-icon" aria-hidden="true">
                <IconBuilding />
              </span>
              <span className="contact-modal__context-text">
                Reporting for <strong>{institutionName}</strong>
              </span>
            </div>
          )}

          {/* ── Step 1: Channel selection ─────────────────────────────── */}
          {step === 1 && (
            <div className="contact-modal__channels">

              <button
                type="button"
                className="contact-modal__channel-card"
                onClick={() => handleChannelSelect("email")}
              >
                <span className="contact-modal__channel-icon contact-modal__channel-icon--email">
                  <IconEmail />
                </span>
                <span className="contact-modal__channel-info">
                  <span className="contact-modal__channel-label">Email</span>
                  <span className="contact-modal__channel-subtitle">
                    Best for detailed reports
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="contact-modal__channel-card"
                onClick={() => handleChannelSelect("whatsapp")}
              >
                <span className="contact-modal__channel-icon contact-modal__channel-icon--wa">
                  <IconWhatsApp />
                </span>
                <span className="contact-modal__channel-info">
                  <span className="contact-modal__channel-label">WhatsApp</span>
                  <span className="contact-modal__channel-subtitle">
                    Best for quick corrections
                  </span>
                </span>
              </button>

            </div>
          )}

          {/* ── Step 2: Intent + preview ──────────────────────────────── */}
          {step === 2 && (
            <div className="contact-modal__step2">

              {/* Channel badge */}
              <div className="contact-modal__channel-badge">
                {channel === "email"
                  ? <><IconEmail /><span>Sending via Email</span></>
                  : <><IconWhatsApp /><span>Sending via WhatsApp</span></>
                }
              </div>

              {/* Intent chips */}
              <p className="contact-modal__intent-heading">
                What&rsquo;s this about?
              </p>
              <div className="contact-modal__intents">
                {INTENTS.map((intent) => (
                  <button
                    key={intent.id}
                    type="button"
                    className={`contact-modal__intent${
                      intentId === intent.id ? " contact-modal__intent--active" : ""
                    }`}
                    onClick={() => setIntentId(intent.id)}
                  >
                    <span
                      className={`contact-modal__dot contact-modal__dot--${intent.dot}`}
                      aria-hidden="true"
                    />
                    {intent.label}
                  </button>
                ))}
              </div>

              {/* Preview */}
              {activeIntent && (
                <div className="contact-modal__preview">
                  <p className="contact-modal__preview-label">
                    {channel === "email"
                      ? "Your message will open pre-filled as:"
                      : "Your WhatsApp message will start as:"}
                  </p>
                  <div className="contact-modal__preview-box">
                    {channel === "email" && (
                      <div className="contact-modal__preview-subject">
                        <span className="contact-modal__preview-field">
                          Subject
                        </span>
                        <span className="contact-modal__preview-value">
                          {previewSubject}
                        </span>
                      </div>
                    )}
                    <div className="contact-modal__preview-body">
                      {(channel === "email" ? previewBody : previewWa)
                        .split("\n")
                        .map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                  <p className="contact-modal__preview-hint">
                    You can add more detail before sending.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>


        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="modal__footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          {step === 2 && (
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!canSend}
              type="button"
            >
              {channel === "email" ? "Open in Email" : "Open in WhatsApp"}
            </button>
          )}
        </div>

      </div>
    </>,
    document.body
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M9 3L5 7l4 4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20"
      fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="16" height="12" rx="2"
        stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7l8 5.5L18 7"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20"
      fill="none" aria-hidden="true" focusable="false">
      <path
        d="M10 2C5.58 2 2 5.58 2 10c0 1.48.39 2.86 1.07 4.06L2 18l4.06-1.05A7.95 7.95 0 0 0 10 18c4.42 0 8-3.58 8-8s-3.58-8-8-8z"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M7.5 8.5c0-.56.44-1 1-1 .19 0 .35.15.37.34l.38 1.66a.35.35 0 0 1-.1.33l-.54.54a4.6 4.6 0 0 0 1.96 1.96l.54-.54a.35.35 0 0 1 .33-.1l1.66.38c.19.02.34.18.34.37 0 .56-.44 1-1 1C9.6 13.5 7.5 11.4 7.5 8.5z"
        stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="5" width="10" height="8" rx="1"
        stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 13V9h4v4"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}