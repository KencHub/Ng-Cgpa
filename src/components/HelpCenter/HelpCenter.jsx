// ── HelpCenter.jsx ────────────────────────────────────────────────────────────
// Full-screen offline help overlay.
//
// Layout (desktop):  260px sidebar | flexible content area
// Layout (mobile):   Topic list → content pane (single panel toggle)
//
// All content is static and from HelpTopics.js — no network required.
// CSS lives in HelpCenter.css (Batch 27).


import React, {
  useState, useEffect, useMemo, useCallback,
} from "react";
import { createPortal }           from "react-dom";
import { HELP_TOPICS, searchTopics } from "./HelpTopics.js";
import "./HelpCenter.css";


// ── Main component ────────────────────────────────────────────────────────────

export default function HelpCenter({ onClose }) {
  const [query,          setQuery]          = useState("");
  const [activeTopic,    setActiveTopic]    = useState(HELP_TOPICS[0]);
  const [mobileShowList, setMobileShowList] = useState(true);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const filteredTopics = useMemo(() => searchTopics(query), [query]);

  const handleTopicSelect = useCallback((topic) => {
    setActiveTopic(topic);
    setMobileShowList(false); // On mobile, switch to content
    setQuery("");
  }, []);

  // If search changes and active topic is filtered out, reset to first result
  useEffect(() => {
    if (filteredTopics.length > 0 && !filteredTopics.find((t) => t.id === activeTopic?.id)) {
      setActiveTopic(filteredTopics[0]);
    }
  }, [filteredTopics, activeTopic]);


  return createPortal(
    <div
      className="help-center"
      role="dialog"
      aria-modal="true"
      aria-label="Help Centre"
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="help-center__topbar">
        <div className="help-center__topbar-left">
          {/* Mobile back button (shown when viewing content) */}
          {!mobileShowList && (
            <button
              className="btn-icon help-center__back"
              onClick={() => setMobileShowList(true)}
              aria-label="Back to topic list"
              type="button"
            >
              <IconChevronLeft />
            </button>
          )}
          <span className="help-center__brand">
            <IconBook />
            NG CGPA Help
          </span>
        </div>

        <button
          className="btn btn-secondary help-center__close"
          onClick={onClose}
          type="button"
          aria-label="Close help and return to app"
        >
          <IconX />
          Back to App
        </button>
      </div>


      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="help-center__layout">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div
          className={`help-center__sidebar${mobileShowList ? "" : " help-center__sidebar--hidden-mobile"}`}
          aria-label="Help topics"
        >
          {/* Search */}
          <div className="help-center__search-wrap">
            <span className="help-center__search-icon" aria-hidden="true">
              <IconSearch />
            </span>
            <input
              type="text"
              className="help-center__search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help topics…"
              autoComplete="off"
              spellCheck="false"
              aria-label="Search help topics"
            />
            {query && (
              <button
                className="help-center__search-clear btn-icon"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                type="button"
              >
                <IconXSmall />
              </button>
            )}
          </div>

          {/* Topic list */}
          <nav
            className="help-center__topic-list"
            role="list"
            aria-label="Help topics"
          >
            {filteredTopics.length === 0 ? (
              <p className="help-center__no-results">
                No topics match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  className={[
                    "help-topic-item",
                    activeTopic?.id === topic.id
                      ? "help-topic-item--active"
                      : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => handleTopicSelect(topic)}
                  type="button"
                  role="listitem"
                  aria-current={activeTopic?.id === topic.id ? "page" : undefined}
                >
                  <span className="help-topic-item__title">{topic.title}</span>
                  <span className="help-topic-item__desc">{topic.shortDesc}</span>
                </button>
              ))
            )}
          </nav>
        </div>


        {/* ── Content area ────────────────────────────────────────────────── */}
        <div
          className={`help-center__content${mobileShowList ? " help-center__content--hidden-mobile" : ""}`}
          role="main"
          aria-label={`Help: ${activeTopic?.title}`}
        >
          {activeTopic ? (
            <TopicContent topic={activeTopic} />
          ) : (
            <div className="help-center__pick">
              <IconBook />
              <p>Select a topic from the left to begin.</p>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}


// ── Topic content renderer ────────────────────────────────────────────────────

function TopicContent({ topic }) {
  return (
    <article className="help-article">
      <h1 className="help-article__title">{topic.title}</h1>
      <p className="help-article__intro">{topic.shortDesc}</p>
      <hr className="help-article__rule" />

      {topic.sections.map((section, idx) => (
        <ContentSection key={idx} section={section} />
      ))}
    </article>
  );
}


// ── Section router ────────────────────────────────────────────────────────────

function ContentSection({ section }) {
  switch (section.type) {

    case "text":
      return <p className="help-section__text">{section.content}</p>;

    case "formula":
      return (
        <div className="help-formula">
          {section.label && (
            <p className="help-formula__label">{section.label}</p>
          )}
          <pre className="help-formula__block">{section.formula}</pre>
        </div>
      );

    case "example":
      return (
        <div className="help-example">
          <p className="help-example__title">{section.title}</p>
          {section.table && <SectionTable table={section.table} />}
          {section.result && (
            <p className="help-example__result">
              <strong>Result: </strong>{section.result}
            </p>
          )}
        </div>
      );

    case "tip":
      return (
        <div className="help-callout help-callout--tip">
          <span className="help-callout__icon" aria-hidden="true">
            <IconTip />
          </span>
          <p className="help-callout__text">{section.content}</p>
        </div>
      );

    case "warning":
      return (
        <div className="help-callout help-callout--warning">
          <span className="help-callout__icon" aria-hidden="true">
            <IconWarning />
          </span>
          <p className="help-callout__text">{section.content}</p>
        </div>
      );

    case "list":
      return (
        <div className="help-list">
          {section.title && (
            <p className="help-list__title">{section.title}</p>
          )}
          <ul className="help-list__items">
            {section.items.map((item, i) => (
              <li key={i} className="help-list__item">{item}</li>
            ))}
          </ul>
        </div>
      );

    case "steps":
      return (
        <div className="help-steps">
          {section.title && (
            <p className="help-steps__title">{section.title}</p>
          )}
          <ol className="help-steps__list">
            {section.items.map((item, i) => (
              <li key={i} className="help-steps__item">{item}</li>
            ))}
          </ol>
        </div>
      );

    case "table":
      return <SectionTable table={section} />;

    case "comparison":
      return (
        <div className="help-comparison">
          {section.title && (
            <p className="help-comparison__title">{section.title}</p>
          )}
          <div className="help-comparison__grid">
            <ComparisonColumn
              label={section.correct.label}
              steps={section.correct.steps}
              variant="correct"
            />
            <ComparisonColumn
              label={section.incorrect.label}
              steps={section.incorrect.steps}
              variant="incorrect"
            />
          </div>
          {section.note && (
            <p className="help-comparison__note">{section.note}</p>
          )}
        </div>
      );

    case "faq":
      return (
        <div className="help-faq">
          {section.questions.map((item, i) => (
            <FAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      );

    default:
      return null;
  }
}


// ── Section table ─────────────────────────────────────────────────────────────

function SectionTable({ table }) {
  const { title, headers, rows, footer, note } = table;
  return (
    <div className="help-table">
      {title && <p className="help-table__title">{title}</p>}
      <div className="help-table__scroll">
        <table className="help-table__el" aria-label={title}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="help-table__th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="help-table__row">
                {row.map((cell, ci) => (
                  <td key={ci} className="help-table__td">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="help-table__footer-row">
                {footer.map((cell, ci) => (
                  <td key={ci} className="help-table__td help-table__td--footer">
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {note && <p className="help-table__note">{note}</p>}
    </div>
  );
}


// ── Comparison column ─────────────────────────────────────────────────────────

function ComparisonColumn({ label, steps, variant }) {
  return (
    <div className={`help-comparison__col help-comparison__col--${variant}`}>
      <p className="help-comparison__col-label">
        {variant === "correct" ? <IconCheck /> : <IconCross />}
        {label}
      </p>
      <ol className="help-comparison__col-steps">
        {steps.map((step, i) => (
          <li key={i} className="help-comparison__col-step">
            {step || <span aria-hidden="true">&nbsp;</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}


// ── FAQ item ──────────────────────────────────────────────────────────────────

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className={`faq-item${open ? " faq-item--open" : ""}`}
      open={open}
      onToggle={(e) => setOpen(e.target.open)}
    >
      <summary className="faq-item__question">
        <span className="faq-item__q-text">{question}</span>
        <span className="faq-item__chevron" aria-hidden="true">
          <IconChevronDown open={open} />
        </span>
      </summary>
      <div className="faq-item__answer">
        <p>{answer}</p>
      </div>
    </details>
  );
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M3 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11H5a2 2 0 0 0-2 2V4z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 15a2 2 0 0 0 2 2h10"
        stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6h4M7 9h4M7 12h2"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M2 2l10 10M12 2L2 12"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconXSmall() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M1.5 1.5l8 8M9.5 1.5l-8 8"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M10 4L6 8l4 4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true" focusable="false"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)",
               transition: "transform 200ms ease" }}>
      <path d="M3 5l4 4 4-4"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTip() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 7v3.5" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
      <circle cx="7.5" cy="5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M7.5 2L14 13H1L7.5 2z"
        stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 6v3.5" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" />
      <circle cx="7.5" cy="11.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="5.5"
        fill="var(--color-success-light)"
        stroke="var(--color-success)" strokeWidth="1.2" />
      <path d="M3.5 6.5l2 2 4-4"
        stroke="var(--color-success)" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCross() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13"
      fill="none" aria-hidden="true" focusable="false">
      <circle cx="6.5" cy="6.5" r="5.5"
        fill="var(--color-danger-light)"
        stroke="var(--color-danger)" strokeWidth="1.2" />
      <path d="M4 4l5 5M9 4l-5 5"
        stroke="var(--color-danger)" strokeWidth="1.4"
        strokeLinecap="round" />
    </svg>
  );
}