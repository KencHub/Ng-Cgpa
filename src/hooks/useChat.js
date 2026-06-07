// ── useChat.js ────────────────────────────────────────────────────────────────
// Groq API (via /api/chat Vercel function) with knowledge base fallback.
//
// Key changes from previous version:
//   - Full conversation history (apiHistoryRef) sent to Groq every turn.
//     The model now knows what it said before and varies accordingly.
//   - System prompt is built HERE, not in the Vercel function.
//     The Vercel function is now a thin pass-through — it accepts
//     { systemPrompt, messages } and forwards them to Groq verbatim.
//   - Context gives raw numbers + a small set of pre-computed key figures.
//     The model is told to use only what the question needs.
//   - Anti-repetition instructions prevent the same structured breakdown
//     appearing for every question about First Class.
//   - Temperature note: ensure your /api/chat.js passes temperature: 0.7
//     to Groq. temperature: 0 causes deterministic, identical outputs.


import { useState, useCallback, useRef } from "react";

import { generateId }                       from "../utils/idGenerator.js";
import { matchQuery }                       from "../utils/queryMatcher.js";
import { buildContext }                     from "../utils/responseRenderer.js";
import { KNOWLEDGE_BASE, SUGGESTED_CHIPS } from "../data/knowledgeBase.js";

export { SUGGESTED_CHIPS };


// ── Constants ──────────────────────────────────────────────────────────────────

// Max turns kept in Groq context (each turn = 1 user + 1 assistant message).
// Keeps token usage bounded. Older turns are dropped from the API call
// but remain visible in the UI history.
const MAX_API_HISTORY_TURNS = 6;

const RESPONSE_DELAY_MS = 320;

const NO_MATCH_RESPONSE =
  "I don't have a specific answer for that right now. Here are things I can help with:\n\n" +
  "- Am I on track for First Class?\n" +
  "- What GPA do I need next semester?\n" +
  "- I failed a course — how bad is it?\n" +
  "- What class will I graduate with at this rate?\n" +
  "- How do I move from a 2:2 to a 2:1?\n" +
  "- What is the minimum to avoid Third Class?\n\n" +
  "Try rephrasing, or tap one of the suggestions above.";


// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat({
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
}) {
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isAPIOnline,  setIsAPIOnline]  = useState(true);
  const [pendingRetry, setPendingRetry] = useState(null);

  // Tracks the API-formatted conversation history.
  // Separate from `messages` so KB/error messages never pollute the API context.
  // Shape: Array<{ role: "user" | "assistant", content: string }>
  const apiHistoryRef = useRef([]);


  // ── Build system prompt ────────────────────────────────────────────────────
  //
  // This runs on every send so the prompt always reflects current state.
  // The Vercel function receives this string and passes it to Groq as-is.

  const buildSystemPrompt = useCallback(() => {
    const inst         = institution;
    const scaleMax     = inst?.scale ?? 5;
    const classList    = inst?.classifications ?? [];
    const totalCU      = totals?.totalCU ?? 0;
    const totalQP      = totals?.totalQP ?? 0;
    const cgpaVal      = cgpa ?? null;
    const passmark     = inst?.passmark ?? 40;

    // ── Classification boundaries ──────────────────────────────────────────

    const firstMin = classList.find(c =>
      c.label?.toLowerCase().includes("first"))?.min
      ?? (scaleMax >= 5 ? 4.50 : 3.50);

    const upperMin = classList.find(c =>
      c.short?.includes("2:1") || c.label?.toLowerCase().includes("upper"))?.min
      ?? (scaleMax >= 5 ? 3.50 : 3.00);

    const lowerMin = classList.find(c =>
      c.short?.includes("2:2") || c.label?.toLowerCase().includes("lower"))?.min
      ?? (scaleMax >= 5 ? 2.40 : 2.00);

    const thirdMin = classList.find(c =>
      c.label?.toLowerCase().includes("third"))?.min
      ?? (scaleMax >= 5 ? 1.50 : 1.00);

    // ── Semester GPA list ──────────────────────────────────────────────────

    const semGPAs = (semesters ?? [])
      .map((s, i) => {
        const qp = (s.courses ?? []).reduce((acc, c) => acc + (Number(c.qualityPoint) || 0), 0);
        const cu = (s.courses ?? []).reduce((acc, c) => acc + (Number(c.creditUnits)  || 0), 0);
        if (cu === 0) return null;
        return `Sem ${i + 1} (${s.label}): ${(qp / cu).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" | ");

    // ── Failed courses ─────────────────────────────────────────────────────

    const failedCourses = (semesters ?? [])
      .flatMap(s =>
        (s.courses ?? [])
          .filter(c => Number(c.gradePoint) === 0 && Number(c.creditUnits) > 0)
          .map(c => `${c.name || "Unnamed"} (${c.creditUnits} units, ${s.label})`)
      );

    // ── Borderline check ───────────────────────────────────────────────────

    const borderlineNote = (() => {
      if (cgpaVal === null) return "No data yet";
      for (const cls of classList) {
        const gap = cgpaVal - cls.min;
        if (gap >= 0 && gap < 0.10) {
          return `Within 0.10 of ${cls.label} boundary (${cls.min}). Gap: ${gap.toFixed(2)}.`;
        }
      }
      return "Not borderline";
    })();

    // ── Key required-GPA figures (18 CU default only) ─────────────────────
    // We pre-compute the most useful figure (18 CU) and the max reachable
    // CGPA for 2 and 4 semesters. The model is told to calculate other
    // credit unit loads itself only if the student asks.

    function reqGPAat(targetCGPA, futureCU) {
      if (!totalCU || !futureCU) return null;
      const needed = (targetCGPA * (totalCU + futureCU) - totalQP) / futureCU;
      if (isNaN(needed)) return null;
      return Math.round(needed * 100) / 100;
    }

    function maxReachableCGPA(futureSems, cuPerSem = 18) {
      if (!totalCU) return null;
      const futCU = futureSems * cuPerSem;
      return Math.round(((totalQP + scaleMax * futCU) / (totalCU + futCU)) * 100) / 100;
    }

    const hasData = totalCU > 0;

    const toFirst18  = hasData ? reqGPAat(firstMin, 18) : null;
    const toUpper18  = hasData ? reqGPAat(upperMin, 18) : null;
    const toLower18  = hasData ? reqGPAat(lowerMin, 18) : null;
    const maxIn2     = hasData ? maxReachableCGPA(2) : null;
    const maxIn4     = hasData ? maxReachableCGPA(4) : null;

    function fmtReq(val) {
      if (val === null)        return "N/A (no data)";
      if (val < 0)             return "Already achieved";
      if (val > scaleMax)      return `Not achievable (would need ${val.toFixed(2)}, above ${scaleMax} max)`;
      if (val > scaleMax * 0.90) return `${val.toFixed(2)} (very challenging)`;
      if (val > scaleMax * 0.75) return `${val.toFixed(2)} (challenging but realistic)`;
      return `${val.toFixed(2)} (achievable)`;
    }

    // ── Student profile ────────────────────────────────────────────────────

    const studentName = student?.name     || null;
    const dept        = student?.department || null;
    const level       = student?.level     || null;

    // ── Assemble prompt ────────────────────────────────────────────────────

    return `You are an academic advisor for Nigerian university students. Your job is to give direct, specific, personalised advice based on the student's real numbers below.

STUDENT PROFILE:
${studentName ? `Name: ${studentName}` : "Name: not provided"}
${dept        ? `Department: ${dept}` : ""}
${level       ? `Level: ${level}` : ""}
University: ${inst?.name ?? "Not selected"}
Grading scale: ${scaleMax} (maximum)
Pass mark: ${passmark}%

CURRENT PERFORMANCE:
CGPA: ${cgpaVal !== null ? cgpaVal.toFixed(4) : "No data"} / ${scaleMax}
Degree class: ${degreeClass ?? "Not classified"}
Total credit units: ${totalCU}
Total quality points: ${totalQP}
Semesters completed: ${(semesters ?? []).length}
Semester GPAs: ${semGPAs || "None yet"}
Failed courses: ${failedCourses.length > 0 ? failedCourses.join(", ") : "None"}
Borderline status: ${borderlineNote}

CLASSIFICATION BOUNDARIES AT ${inst?.name ?? "THIS UNIVERSITY"}:
First Class:         ${firstMin}+
Second Upper (2:1):  ${upperMin}+
Second Lower (2:2):  ${lowerMin}+
Third Class:         ${thirdMin}+

${hasData ? `REQUIRED GPA FIGURES (assuming 18 credit units next semester):
To reach First Class (${firstMin}):  ${fmtReq(toFirst18)}
To reach 2:1 (${upperMin}):          ${fmtReq(toUpper18)}
To reach 2:2 (${lowerMin}):          ${fmtReq(toLower18)}
Max CGPA achievable (2 perfect sems): ${maxIn2 ?? "N/A"}
Max CGPA achievable (4 perfect sems): ${maxIn4 ?? "N/A"}` : "No course data entered yet."}

HOW TO RESPOND:
- Answer exactly what was asked. Do not dump all the above data into every response.
- If they ask "what GPA do I need", give the single most relevant figure (18 CU default), state clearly if it's achievable or not, and move on.
- If they ask "how close am I", lead with the gap in CGPA points, what it means practically, and what it takes to close it — not a list of required GPAs for different credit loads.
- If a required GPA is above ${scaleMax}, clearly say it is not achievable in one semester, then tell them the maximum CGPA they CAN reach (use the figures above).
- Keep responses under 150 words unless the student asks for a detailed breakdown.
- Vary your phrasing — do not start every response the same way.
- Be direct and warm, like a knowledgeable senior who genuinely wants them to succeed.
- If the student has no data, ask them to enter their courses before you can give specific numbers.
- Do not list scenarios for 15 CU, 18 CU, and 20 CU in the same response unless specifically asked.
- Never say "em-dash" or use em-dashes. Use commas, colons, or periods instead.`;

  }, [
    institution, student, semesters, cgpa, degreeClass,
    totals, activeScale, activeClassifications,
  ]);


  // ── Build knowledge base context ───────────────────────────────────────────

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


  // ── Call /api/chat ─────────────────────────────────────────────────────────
  //
  // Sends the system prompt (built here) plus full conversation history.
  // The Vercel function should accept { systemPrompt, messages } and
  // forward them to Groq exactly. See comment block below for the
  // required /api/chat.js shape.

  const callGroq = useCallback(async (userMessage) => {
    const systemPrompt = buildSystemPrompt();

    // Trim history to last MAX_API_HISTORY_TURNS turns to control token usage.
    // Each "turn" is one user message + one assistant message = 2 entries.
    const trimmedHistory = apiHistoryRef.current.slice(-(MAX_API_HISTORY_TURNS * 2));

    const messagesForAPI = [
      ...trimmedHistory,
      { role: "user", content: userMessage },
    ];

    const res = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ systemPrompt, messages: messagesForAPI }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    if (!data.content) throw new Error("Empty response from API");

    return data.content;
  }, [buildSystemPrompt]);


  // ── Knowledge base fallback ────────────────────────────────────────────────

  const callKnowledgeBase = useCallback((userMessage) => {
    const ctx     = buildKBContext();
    const matched = matchQuery(userMessage, KNOWLEDGE_BASE);

    if (matched) {
      try {
        return { content: matched.generateResponse(ctx), topic: matched.title };
      } catch {
        return { content: NO_MATCH_RESPONSE, topic: null };
      }
    }
    return { content: NO_MATCH_RESPONSE, topic: null };
  }, [buildKBContext]);


  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (userMessage) => {
    const trimmed = userMessage?.trim();
    if (!trimmed || isLoading) return;

    // Add user message to displayed history
    const userMsg = {
      id:                  generateId("msg"),
      role:                "user",
      content:             trimmed,
      timestamp:           new Date().toISOString(),
      isError:             false,
      isFromKnowledgeBase: false,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setPendingRetry(null);

    let responseContent;
    let isFromKnowledgeBase = false;
    let matchedTopic        = null;

    try {
      // Primary: Groq via Vercel function
      responseContent = await callGroq(trimmed);
      setIsAPIOnline(true);

      // Update API history on success so the next message has context
      apiHistoryRef.current = [
        ...apiHistoryRef.current,
        { role: "user",      content: trimmed          },
        { role: "assistant", content: responseContent  },
      ];

    } catch (err) {
      console.warn("[NG CGPA] Groq unavailable, using knowledge base:", err.message);
      setIsAPIOnline(false);
      setPendingRetry(trimmed);

      const fallback      = callKnowledgeBase(trimmed);
      responseContent     = fallback.content;
      matchedTopic        = fallback.topic;
      isFromKnowledgeBase = true;
      // Do not append KB responses to API history — they are not from the model
    }

    setTimeout(() => {
      const assistantMsg = {
        id:                  generateId("msg"),
        role:                "assistant",
        content:             responseContent,
        timestamp:           new Date().toISOString(),
        isError:             false,
        isFromKnowledgeBase,
        matchedTopic,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);
    }, RESPONSE_DELAY_MS);

  }, [isLoading, callGroq, callKnowledgeBase]);


  // ── Retry ──────────────────────────────────────────────────────────────────

  const retryMessage = useCallback((message) => {
    const msg = message ?? pendingRetry;
    if (!msg) return;
    setPendingRetry(null);
    sendMessage(msg);
  }, [pendingRetry, sendMessage]);


  // ── Clear ──────────────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setPendingRetry(null);
    apiHistoryRef.current = []; // also clear the API history
  }, []);


  // ── Dismiss error message ──────────────────────────────────────────────────

  const dismissError = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);


  // ── Return ─────────────────────────────────────────────────────────────────

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


// ── REQUIRED /api/chat.js SHAPE ────────────────────────────────────────────────
//
// Your Vercel serverless function must now accept:
//   req.body = { systemPrompt: string, messages: Array<{role, content}> }
//
// Minimal working version:
//
//   import Groq from "groq-sdk";
//
//   const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
//
//   export default async function handler(req, res) {
//     if (req.method !== "POST") return res.status(405).end();
//
//     const { systemPrompt, messages } = req.body;
//     if (!systemPrompt || !Array.isArray(messages)) {
//       return res.status(400).json({ error: "Missing systemPrompt or messages" });
//     }
//
//     try {
//       const completion = await groq.chat.completions.create({
//         model:       "llama-3.3-70b-versatile",   // or your current model
//         max_tokens:  600,
//         temperature: 0.7,                          // IMPORTANT: not 0
//         messages: [
//           { role: "system", content: systemPrompt },
//           ...messages,
//         ],
//       });
//
//       const content = completion.choices[0]?.message?.content ?? "";
//       return res.status(200).json({ content });
//
//     } catch (err) {
//       console.error("[NG CGPA /api/chat]", err);
//       return res.status(500).json({ error: "Groq request failed" });
//     }
//   }
//
// If you share your current /api/chat.js I will rewrite it completely
// to match this shape and fix any other issues in it.
// ──────────────────────────────────────────────────────────────────────────────