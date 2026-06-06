// ── ChatMessage.jsx ───────────────────────────────────────────────────────────
// Renders a single message in the chat history.
//
// Handles five states:
//   1. User message       — right-aligned, primary tint
//   2. Assistant (API)    — left-aligned, surface card
//   3. Knowledge base     — assistant variant + "Knowledge base" tag
//   4. QA cache           — assistant variant + "From your history" tag
//   5. Error / pending    — warning card with retry + dismiss controls


import React, { useState } from "react";


export default function ChatMessage({ message, onRetry, onDismiss }) {
  const {
    id,
    role,
    content,
    timestamp,
    isError,
    isPending,
    isFromKnowledgeBase,
    isFromCache,
    retryPayload,
  } = message;

  const isUser = role === "user";

  return (
    <div
      className={[
        "chat-message",
        `chat-message--${isUser ? "user" : "assistant"}`,
        isError   ? "chat-message--error"   : "",
        isPending ? "chat-message--pending" : "",
        isFromKnowledgeBase ? "chat-message--kb" : "",
        isFromCache         ? "chat-message--cache" : "",
      ].filter(Boolean).join(" ")}
      aria-label={isUser ? "Your message" : "Assistant response"}
    >
      {isUser ? (
        <UserMessage content={content} timestamp={timestamp} />
      ) : (
        <AssistantMessage
          id={id}
          content={content}
          timestamp={timestamp}
          isError={isError}
          isPending={isPending}
          isFromKnowledgeBase={isFromKnowledgeBase}
          isFromCache={isFromCache}
          retryPayload={retryPayload}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
}


// ── User message ──────────────────────────────────────────────────────────────

function UserMessage({ content, timestamp }) {
  return (
    <div className="user-message">
      <div className="user-message__bubble">
        <p className="user-message__text">{content}</p>
      </div>
      {timestamp && (
        <span className="message-time" aria-label={`Sent at ${formatTime(timestamp)}`}>
          {formatTime(timestamp)}
        </span>
      )}
    </div>
  );
}


// ── Assistant message ─────────────────────────────────────────────────────────

function AssistantMessage({
  id,
  content,
  timestamp,
  isError,
  isPending,
  isFromKnowledgeBase,
  isFromCache,
  retryPayload,
  onRetry,
  onDismiss,
}) {
  const [retrying, setRetrying] = useState(false);

  function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    onRetry(retryPayload);
  }

  // Error / offline state
  if (isError) {
    return (
      <div className="assistant-message assistant-message--error">
        <div className="assistant-message__header">
          <span className="assistant-message__avatar" aria-hidden="true">
            <IconAssistantSmall />
          </span>
          <span className="assistant-message__name">Academic Assistant</span>
          <span className="assistant-message__status-tag">Offline</span>
        </div>

        <div className="assistant-message__error-body">
          <span className="assistant-message__error-icon" aria-hidden="true">
            <IconWifi />
          </span>
          <p className="assistant-message__error-text">{content}</p>
        </div>

        {retryPayload && (
          <div className="assistant-message__retry-row">
            <button
              className="btn btn-secondary assistant-message__retry-btn"
              onClick={handleRetry}
              disabled={retrying || isPending === false}
              type="button"
            >
              {retrying ? (
                <><IconSpinnerSmall /> Retrying…</>
              ) : (
                <><IconRetry /> Retry</>
              )}
            </button>

            <button
              className="btn btn-ghost assistant-message__dismiss-btn"
              onClick={() => onDismiss(id)}
              type="button"
              aria-label="Dismiss this error"
            >
              Dismiss
            </button>
          </div>
        )}

        {timestamp && (
          <span className="message-time">{formatTime(timestamp)}</span>
        )}
      </div>
    );
  }

  // Normal assistant message (API, QA cache, or knowledge base)
  return (
    <div className="assistant-message">
      <div className="assistant-message__header">
        <span className="assistant-message__avatar" aria-hidden="true">
          <IconAssistantSmall />
        </span>
        <span className="assistant-message__name">Academic Assistant</span>

        {/* QA cache tag — shown when answer comes from saved past sessions */}
        {isFromCache && (
          <span
            className="assistant-message__kb-tag"
            style={{
              background: "var(--color-primary-light)",
              color:      "#ffffff",
            }}
            title="This answer was saved from a previous session when you had internet access."
          >
            From your history
          </span>
        )}

        {/* Knowledge base tag — shown for hardcoded fallback answers */}
        {isFromKnowledgeBase && !isFromCache && (
          <span
            className="assistant-message__kb-tag"
            title="This answer comes from the built-in knowledge base, personalised to your entered data."
          >
            Knowledge base
          </span>
        )}
      </div>

      <div className="assistant-message__body">
        {renderContent(content)}
      </div>

      <div className="assistant-message__footer">
        {timestamp && (
          <span className="message-time">{formatTime(timestamp)}</span>
        )}

        {isFromCache && (
          <span className="assistant-message__kb-note">
            <IconInfo />
            Saved answer. Connect for a live personalised response.
          </span>
        )}

        
      </div>
    </div>
  );
}


// ── Content renderer ──────────────────────────────────────────────────────────

function renderContent(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split("\n");
    return (
      <p key={pIdx} className="assistant-message__para">
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </p>
    );
  });
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString("en-NG", {
      hour:   "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconAssistantSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <rect width="14" height="14" rx="3" fill="var(--color-primary)" />
      <path d="M2.5 9.5 L7 5.5 L11.5 9.5"
        stroke="var(--color-accent)" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4.5" y="9.5" width="5" height="3.5" rx="0.8"
        fill="var(--color-accent)" opacity="0.8" />
    </svg>
  );
}

function IconRetry() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M11 6.5A4.5 4.5 0 1 1 4.5 2.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
      <path d="M4.5 1v3H1.5"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWifi() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M1.5 5.5A8.5 8.5 0 0 1 13.5 5.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <path d="M3.5 8A5.5 5.5 0 0 1 11.5 8"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <path d="M5.5 10.5A2.5 2.5 0 0 1 9.5 10.5"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
      <circle cx="7.5" cy="13" r="1" fill="currentColor" />
      <path d="M1.5 2L13.5 13"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="5.5" cy="5.5" r="4.5"
        stroke="currentColor" strokeWidth="1.1" />
      <path d="M5.5 5v3.5"
        stroke="currentColor" strokeWidth="1.2"
        strokeLinecap="round" />
      <circle cx="5.5" cy="3.5" r="0.65" fill="currentColor" />
    </svg>
  );
}

function IconSpinnerSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13"
      fill="none" aria-hidden="true" focusable="false"
      className="chat-send-btn__spinner">
      <circle cx="6.5" cy="6.5" r="5"
        stroke="currentColor" strokeWidth="1.4"
        strokeDasharray="22" strokeDashoffset="7"
        strokeLinecap="round" />
    </svg>
  );
}