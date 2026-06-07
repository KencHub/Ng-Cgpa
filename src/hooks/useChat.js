// ── useChat.js ────────────────────────────────────────────────────────────────
// Groq API first, knowledge base fallback.
//
// Flow:
//   1. Build context from current state
//   2. Call /api/chat (Vercel serverless → Groq)
//   3. If API fails for any reason, silently fall back to knowledge base
//   4. User always gets an answer
//
// Return shape is identical to the previous version.
// App.jsx and ImprovementChat.jsx require no structural changes.

import { useState, useCallback } from "react";

import { generateId }                        from "../utils/idGenerator.js";
import { matchQuery }                        from "../utils/queryMatcher.js";
import { buildContext }                      from "../utils/responseRenderer.js";
import { KNOWLEDGE_BASE, SUGGESTED_CHIPS }  from "../data/knowledgeBase.js";

export { SUGGESTED_CHIPS };


// ── Fallback response when nothing matches the knowledge base ─────────────────

const NO_MATCH_RESPONSE =
  "I don't have a specific answer for that in my knowledge base. Here are topics I can help with:\n\n" +
  "- Am I on track for First Class?\n" +
  "- What GPA do I need next semester?\n" +
  "- I failed a course, how bad is it?\n" +
  "- What class will I graduate with at this rate?\n" +
  "- How do I move from a 2:2 to a 2:1?\n" +
  "- What is the minimum to avoid Third Class?\n\n" +
  "Try rephrasing, or tap one of the suggestions above.";

const RESPONSE_DELAY_MS = 380;


// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat({
  institution,
  student,
  semesters,
  cgpa,
  degreeClass,
  semesterSummaries,
  totals,
  activeScale,
  activeClassifications,
  degreeClassShort,
  degreeClassEntry,
  activePassmark,
  projection,
  projectionResult,
}) {
  const [messages,    setMessages]    = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isAPIOnline, setIsAPIOnline] = useState(true);  // optimistic default
  const [pendingRetry, setPendingRetry] = useState(null);


  // ── Build flat context object for the Groq API system prompt ─────────────────

  const buildAPIContext = useCallback(() => {

    // Semester GPA list
    const semGPAs = (semesters ?? [])
      .map((s, i) => {
        const qp = (s.courses ?? []).reduce((sum, c) => sum + (Number(c.qualityPoint) || 0), 0);
        const cu = (s.courses ?? []).reduce((sum, c) => sum + (Number(c.creditUnits)  || 0), 0);
        if (cu === 0) return null;
        return `Sem ${i + 1}: ${(qp / cu).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(", ");

    // Totals from raw course data
    const calcTotalCU = (semesters ?? []).reduce((sum, s) =>
      sum + (s.courses ?? []).reduce((acc, c) => acc + (Number(c.creditUnits) || 0), 0), 0);

    const calcTotalQP = (semesters ?? []).reduce((sum, s) =>
      sum + (s.courses ?? []).reduce((acc, c) => acc + (Number(c.qualityPoint) || 0), 0), 0);

    // School boundaries
    const scale           = institution?.scale ?? 5;
    const classifications = institution?.classifications ?? [];

    const firstMin  = classifications.find(c =>
      c.label?.toLowerCase().includes("first"))?.min ?? (scale >= 5 ? 4.50 : 3.50);
    const upperMin  = classifications.find(c =>
      c.short?.includes("2:1") || c.label?.toLowerCase().includes("upper"))?.min ?? (scale >= 5 ? 3.50 : 3.00);
    const lowerMin  = classifications.find(c =>
      c.short?.includes("2:2") || c.label?.toLowerCase().includes("lower"))?.min ?? (scale >= 5 ? 2.40 : 2.00);
    const thirdMin  = classifications.find(c =>
      c.label?.toLowerCase().includes("third"))?.min ?? (scale >= 5 ? 1.50 : 1.00);

    // Required GPA calculator
    function reqGPA(targetCGPA, futureCU) {
      if (calcTotalCU === 0 || futureCU === 0) return null;
      const neededQP = targetCGPA * (calcTotalCU + futureCU) - calcTotalQP;
      const gpa = neededQP / futureCU;
      return Math.round(gpa * 100) / 100;
    }

    // Pre-calculated figures for 15, 18, 20 CU scenarios
    function fmt(val) {
      if (val === null) return "N/A";
      if (val > scale)  return `Not achievable in one semester (requires ${val.toFixed(2)}, above ${scale} scale max)`;
      if (val < 0)      return "Already achieved";
      return val.toFixed(2);
    }

    // Borderline
    const borderlineInfo = (() => {
      if (cgpa === null || cgpa === undefined) return "No data";
      for (const cls of classifications) {
        if (cgpa >= cls.min && cgpa < cls.min + 0.10) {
          return `Within 0.10 of ${cls.label} (boundary: ${cls.min})`;
        }
      }
      return "Not borderline";
    })();

    // Max achievable CGPA (perfect score every remaining semester)
    function maxCGPA(futureSems, cuPerSem) {
      if (calcTotalCU === 0) return null;
      const futCU = futureSems * cuPerSem;
      return Math.round(((calcTotalQP + scale * futCU) / (calcTotalCU + futCU)) * 100) / 100;
    }

    return {
      institutionName:    institution?.name  ?? null,
      scale,
      passmark:           institution?.passmark ?? 40,
      cgpa:               cgpa ?? null,
      degreeClass:        degreeClass ?? null,
      semesterCount:      (semesters ?? []).length,
      totalCreditUnits:   calcTotalCU,
      totalQualityPoints: calcTotalQP,
      semesterGPAList:    semGPAs || "None yet",
      borderlineInfo,

      // Class boundaries
      firstClassMin:  firstMin,
      upperSecMin:    upperMin,
      lowerSecMin:    lowerMin,
      thirdClassMin:  thirdMin,

      // Pre-calculated required GPAs — Groq reads these directly
      toFirstClass: {
        at15CU: fmt(reqGPA(firstMin, 15)),
        at18CU: fmt(reqGPA(firstMin, 18)),
        at20CU: fmt(reqGPA(firstMin, 20)),
      },
      toUpperSec: {
        at15CU: fmt(reqGPA(upperMin, 15)),
        at18CU: fmt(reqGPA(upperMin, 18)),
        at20CU: fmt(reqGPA(upperMin, 20)),
      },
      toLowerSec: {
        at18CU: fmt(reqGPA(lowerMin, 18)),
      },
      toThirdClass: {
        at18CU: fmt(reqGPA(thirdMin, 18)),
      },

      // Max achievable CGPAs
      maxCGPAin2Sems: maxCGPA(2, 18) ?? "N/A",
      maxCGPAin4Sems: maxCGPA(4, 18) ?? "N/A",
      maxCGPAin6Sems: maxCGPA(6, 18) ?? "N/A",
    };
  }, [institution, semesters, cgpa, degreeClass]);


  // ── Build rich context object for the knowledge base ─────────────────────────

  const buildKBContext = useCallback(() => {
    return buildContext({
      institution, student, semesters, cgpa, degreeClass,
      degreeClassShort, degreeClassEntry, semesterSummaries,
      totals, activeScale, activeClassifications,
      activePassmark, projection, projectionResult,
    });
  }, [
    institution, student, semesters, cgpa, degreeClass,
    degreeClassShort, degreeClassEntry, semesterSummaries,
    totals, activeScale, activeClassifications,
    activePassmark, projection, projectionResult,
  ]);


  // ── Call /api/chat (Vercel serverless → Groq) ─────────────────────────────────

  const callGroq = useCallback(async (message) => {
    const context = buildAPIContext();

    const res = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message, context }),
    });

    if (!res.ok) throw new Error(`API responded with ${res.status}`);

    const data = await res.json();
    if (!data.content) throw new Error("Empty response");

    return data.content;
  }, [buildAPIContext]);


  // ── Knowledge base fallback ───────────────────────────────────────────────────

  const callKnowledgeBase = useCallback((message) => {
    const ctx     = buildKBContext();
    const matched = matchQuery(message, KNOWLEDGE_BASE);

    if (matched) {
      try {
        return { content: matched.generateResponse(ctx), topic: matched.title };
      } catch {
        return { content: NO_MATCH_RESPONSE, topic: null };
      }
    }
    return { content: NO_MATCH_RESPONSE, topic: null };
  }, [buildKBContext]);


  // ── Send message ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (userMessage) => {
    const trimmed = userMessage?.trim();
    if (!trimmed || isLoading) return;

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
    setPendingRetry(null);

    let responseContent;
    let isFromKnowledgeBase = false;
    let matchedTopic        = null;

    try {
      // Primary: Groq API
      responseContent = await callGroq(trimmed);
      setIsAPIOnline(true);

    } catch (err) {
      // Fallback: knowledge base — silent, no error shown to user
      console.warn("Groq unavailable, using knowledge base:", err.message);
      setIsAPIOnline(false);
      setPendingRetry(trimmed);

      const fallback    = callKnowledgeBase(trimmed);
      responseContent   = fallback.content;
      matchedTopic      = fallback.topic;
      isFromKnowledgeBase = true;
    }

    setTimeout(() => {
      const assistantMsg = {
        id:                  generateId("msg"),
        role:                "assistant",
        content:             responseContent,
        timestamp:           new Date().toISOString(),
        isError:             false,
        isPending:           false,
        isFromKnowledgeBase,
        isFromCache:         false,
        matchedTopic,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);
    }, RESPONSE_DELAY_MS);

  }, [isLoading, callGroq, callKnowledgeBase]);


  // ── Retry last failed message ─────────────────────────────────────────────────

  const retryMessage = useCallback((message) => {
    const msg = message ?? pendingRetry;
    if (!msg) return;
    setPendingRetry(null);
    sendMessage(msg);
  }, [pendingRetry, sendMessage]);


  // ── Clear ─────────────────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setPendingRetry(null);
  }, []);


  // ── Dismiss error message ─────────────────────────────────────────────────────

  const dismissError = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);


  // ── Return (shape identical to previous version) ──────────────────────────────

  return {
    messages,
    isLoading,
    pendingRetry,
    isAPIOnline,
    sendMessage,
    retryMessage,
    clearChat,
    dismissError,
    clearQACache:   () => {},
    suggestedChips: SUGGESTED_CHIPS,
  };
}