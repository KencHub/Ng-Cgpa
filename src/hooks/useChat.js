// ── useChat.js ────────────────────────────────────────────────────────────────
// Knowledge-mode chat hook. No API. No external requests. Fully offline.
//
// Flow for every message:
//   1. Build a rich context object from the current useCGPA state
//   2. Run the query through the weighted keyword matcher
//   3. If matched: call the entry's generateResponse(ctx) for a personalized answer
//   4. If no match: show the no-match fallback with topic suggestions
//
// Return shape is identical to the previous API-backed version so that
// App.jsx, ImprovementChat.jsx, and ChatMessage.jsx require no changes.
//
// SUGGESTED_CHIPS is re-exported from the knowledge base so it can grow
// without touching this file.


import { useState, useCallback } from "react";

import { generateId }            from "../utils/idGenerator.js";
import { matchQuery }            from "../utils/queryMatcher.js";
import { buildContext }          from "../utils/responseRenderer.js";
import { KNOWLEDGE_BASE, SUGGESTED_CHIPS } from "../data/knowledgeBase.js";

export { SUGGESTED_CHIPS };


// ── Response when nothing matches ─────────────────────────────────────────────

const NO_MATCH_RESPONSE =
  "I don't have a specific answer for that in my knowledge base. Here are topics I can help with:\n\n" +
  "- Am I on track for First Class?\n" +
  "- What GPA do I need next semester?\n" +
  "- I failed a course — how bad is it?\n" +
  "- What class will I graduate with at this rate?\n" +
  "- How do I move from a 2:2 to a 2:1?\n" +
  "- What is the minimum to avoid Third Class?\n" +
  "- Draft an academic appeal letter\n" +
  "- Is First Class still possible for me?\n" +
  "- What is CGPA / GPA / a quality point?\n" +
  "- Classification boundaries at my university\n\n" +
  "Try rephrasing, or tap one of the suggestions above.";


// ── Response delay (ms) ───────────────────────────────────────────────────────
// A short pause before the assistant reply renders. Makes it feel considered,
// not instantaneous, without being slow.

const RESPONSE_DELAY_MS = 380;


// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat({
  // Existing params — all preserved to avoid breaking App.jsx
  institution,
  student,
  semesters,
  cgpa,
  degreeClass,
  semesterSummaries,
  totals,
  activeScale,
  activeClassifications,
  // Extended params — new, passed in addition to the above
  // If App.jsx does not yet pass these, they default to null/undefined
  // and buildContext handles them gracefully.
  degreeClassShort,
  degreeClassEntry,
  activePassmark,
  projection,
  projectionResult,
}) {
  const [messages,  setMessages]  = useState([]);
  const [isLoading, setIsLoading] = useState(false);


  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (userMessage) => {
      const trimmed = userMessage?.trim();
      if (!trimmed || isLoading) return;

      // Append the user's message immediately
      const userMsg = {
        id:                  generateId("msg"),
        role:                "user",
        content:             trimmed,
        timestamp:           new Date().toISOString(),
        isError:             false,
        isPending:           false,
        isFromKnowledgeBase: false,
        isFromCache:         false,
      };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      // Build the context from current state
      const ctx = buildContext({
        institution,
        student,
        semesters,
        cgpa,
        degreeClass,
        degreeClassShort,
        degreeClassEntry,
        semesterSummaries,
        totals,
        activeScale,
        activeClassifications,
        activePassmark,
        projection,
        projectionResult,
      });

      // Match against knowledge base
      const matched = matchQuery(trimmed, KNOWLEDGE_BASE);

      let responseContent;
      let matchedTopic = null;

      if (matched) {
        try {
          responseContent = matched.generateResponse(ctx);
          matchedTopic    = matched.title;
        } catch {
          responseContent = NO_MATCH_RESPONSE;
        }
      } else {
        responseContent = NO_MATCH_RESPONSE;
      }

      // Append the assistant reply after a short delay
      setTimeout(() => {
        const assistantMsg = {
          id:                  generateId("msg"),
          role:                "assistant",
          content:             responseContent,
          timestamp:           new Date().toISOString(),
          isError:             false,
          isPending:           false,
          isFromKnowledgeBase: true,
          isFromCache:         false,
          matchedTopic,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
      }, RESPONSE_DELAY_MS);
    },
    // Re-compute when any state that affects context changes
    [
      isLoading,
      institution, student, semesters, cgpa,
      degreeClass, degreeClassShort, degreeClassEntry,
      semesterSummaries, totals, activeScale,
      activeClassifications, activePassmark,
      projection, projectionResult,
    ]
  );


  // ── Clear ─────────────────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
  }, []);


  // ── Dismiss a message (used by ChatMessage error dismiss) ─────────────────────

  const dismissError = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);


  // ── Return ────────────────────────────────────────────────────────────────────
  // Shape is identical to the previous version. App.jsx and ImprovementChat.jsx
  // need no changes.

  return {
    messages,
    isLoading,
    pendingRetry:   null,
    isAPIOnline:    false,    // Knowledge mode — always false, triggers notice
    sendMessage,
    retryMessage:   () => {}, // No-op: no API to retry
    clearChat,
    dismissError,
    clearQACache:   () => {}, // No-op: cache removed
    suggestedChips: SUGGESTED_CHIPS,
  };
}