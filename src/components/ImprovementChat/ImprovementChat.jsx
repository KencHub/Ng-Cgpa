// ── ImprovementChat.jsx ───────────────────────────────────────────────────────
// Collapsible AI-powered academic advisor chat panel.
//
// Renders the full chat interface: status bar, scrollable history,
// fallback notice, suggested prompt chips, and text input.
//
// SuggestedChips and FallbackNotice are imported from Batch 23.
// ImprovementChat.css is also from Batch 23.
//
// Auto-scroll: scrolls to the bottom on new messages and when the panel
// is first expanded. Does not scroll if the user has manually scrolled up
// to read older messages (detects proximity to bottom before scrolling).


import React, {
  useState, useEffect, useRef, useCallback,
} from "react";

import ChatMessage    from "./ChatMessage.jsx";
import SuggestedChips from "./SuggestedChips.jsx";
import FallbackNotice from "./FallbackNotice.jsx";
import "./ImprovementChat.css";


// ── Constants ─────────────────────────────────────────────────────────────────

const SCROLL_THRESHOLD = 80; // px from bottom — within this, auto-scroll fires
const TEXTAREA_MAX_H   = 120; // px


// ── Main component ────────────────────────────────────────────────────────────

export default function ImprovementChat({
  messages,
  isLoading,
  pendingRetry,
  isAPIOnline,
  suggestedChips,
  onSend,
  onRetry,
  onDismissError,
  onClear,
  hasData,
  institution,
  cgpa,
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [inputValue,  setInputValue]  = useState("");

  const textareaRef  = useRef(null);
  const historyRef   = useRef(null);
  const bottomRef    = useRef(null);
  const userScrolled = useRef(false); // true when user has manually scrolled up

  const hasMessages = messages.length > 0;


  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  // Track whether user has scrolled away from the bottom
  useEffect(() => {
    const el = historyRef.current;
    if (!el) return;

    function handleScroll() {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolled.current = distFromBottom > SCROLL_THRESHOLD;
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [expanded]);

  // Scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (!expanded) return;
    if (userScrolled.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, expanded]);

  // Instant scroll to bottom when panel first expands
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
      userScrolled.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [expanded]);


  // ── Send message ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInputValue("");
    userScrolled.current = false;
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [inputValue, isLoading, onSend]);


  // ── Textarea resize ───────────────────────────────────────────────────────

  function handleInputChange(e) {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_H)}px`;
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }


  // ── Chip click ────────────────────────────────────────────────────────────

  function handleChipClick(chip) {
    if (!expanded) setExpanded(true);
    onSend(chip);
    userScrolled.current = false;
  }


  // ── Clear (stop propagation so it doesn't toggle collapse) ───────────────

  function handleClear(e) {
    e.stopPropagation();
    onClear();
  }


  // ── Toggle collapse ───────────────────────────────────────────────────────

  function handleToggle() {
    setExpanded((p) => !p);
  }

  function handleHeaderKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  }


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="improvement-chat panel-card">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="collapsible-header chat-header"
        role="button"
        aria-expanded={expanded}
        aria-controls="chat-body"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleHeaderKeyDown}
      >
            <div className="chat-header__left">
          <span className="collapsible-header__title">Academic Assistant</span>
        </div>

        <div className="chat-header__right">
          {hasMessages && (
            <button
              className="btn-icon chat-header__clear"
              onClick={handleClear}
              title="Clear conversation"
              aria-label="Clear conversation history"
              type="button"
            >
              <IconClear />
            </button>
          )}
          <svg
            className={`collapsible-chevron${expanded ? " collapsible-chevron--open" : ""}`}
            width="16" height="16" viewBox="0 0 16 16"
            fill="none" aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>


      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="chat-body" id="chat-body">

          {/* Chat history */}
          <div
            className="chat-history"
            ref={historyRef}
            role="log"
            aria-label="Conversation history"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!hasMessages ? (
              <ChatEmptyState
                hasData={hasData}
                institution={institution}
                cgpa={cgpa}
              />
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onRetry={onRetry}
                    onDismiss={onDismissError}
                  />
                ))}

                {/* Typing indicator */}
                {isLoading && <TypingIndicator />}

                {/* Scroll anchor */}
                <div ref={bottomRef} className="chat-history__anchor" aria-hidden="true" />
              </>
            )}
          </div>

          
          
            <FallbackNotice />
          

          {/* Suggested chips */}
          <SuggestedChips
            chips={suggestedChips}
            onSelect={handleChipClick}
            disabled={isLoading}
          />

          {/* Input area */}
          <div className="chat-input-area">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                !institution
                  ? "Select your university first."
                  : !hasData
                  ? "Enter your courses first for personalised advice."
                  : "Ask about your CGPA, a failed course, what you need next…"
              }
              disabled={isLoading || !institution}
              rows={1}
              maxLength={500}
              aria-label="Type your question to the academic assistant"
            />

            <button
              className={`chat-send-btn${isLoading ? " chat-send-btn--loading" : ""}`}
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || !institution}
              aria-label="Send message"
              title="Send (Enter)"
              type="button"
            >
              {isLoading ? <IconSpinner /> : <IconSend />}
            </button>
          </div>

          {/* Character count — only when approaching limit */}
          {inputValue.length > 400 && (
            <p className="chat-char-count" aria-live="polite">
              {inputValue.length} / 500
            </p>
          )}

        </div>
      )}

    </div>
  );
}



// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div
      className="chat-typing"
      role="status"
      aria-label="Academic Assistant is thinking"
    >
      <div className="chat-typing__bubble">
        <span className="chat-typing__dot" />
        <span className="chat-typing__dot" />
        <span className="chat-typing__dot" />
      </div>
    </div>
  );
}


// ── Empty chat state ──────────────────────────────────────────────────────────

function ChatEmptyState({ hasData, institution, cgpa }) {
  let heading, body;

  if (!institution) {
    heading = "Select your university first.";
    body    = "The assistant uses your institution's grading scale to give accurate, numerical answers.";
  } else if (!hasData) {
    heading = "Enter your courses to get started.";
    body    = "The assistant gives personalised advice based on your actual credit units and grades. Add your courses first.";
  } else {
    heading = "Ask me anything about your CGPA.";
    body    = cgpa !== null
      ? `Your current CGPA is ${cgpa.toFixed(2)}. Ask me what you need next semester, what happens if you fail a course, or how close you are to a class upgrade.`
      : "Ask me what GPA you need, how to calculate your CGPA, or what a failed course means for your results.";
  }

  return (
    <div className="chat-empty">
      <span className="chat-empty__icon" aria-hidden="true">
        <IconAssistant />
      </span>
      <p className="chat-empty__heading">{heading}</p>
      <p className="chat-empty__body">{body}</p>
    </div>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M14 8L2 2l3 6-3 6 12-6z"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M2 2l10 10M12 2L2 12"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false"
      className="chat-send-btn__spinner">
      <circle cx="8" cy="8" r="6"
        stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="28" strokeDashoffset="10"
        strokeLinecap="round" />
    </svg>
  );
}

function IconAssistant() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32"
      fill="none" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--color-surface-3)" />
      <path d="M5 22 L16 13 L27 22"
        stroke="var(--color-text-muted)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <rect x="10" y="22" width="12" height="7" rx="1.5"
        fill="var(--color-text-muted)" opacity="0.4" />
      <rect x="14.5" y="10" width="3" height="3.5" rx="1.5"
        fill="var(--color-text-muted)" opacity="0.6" />
      <circle cx="16" cy="9" r="2" fill="var(--color-text-muted)" opacity="0.5" />
    </svg>
  );
}