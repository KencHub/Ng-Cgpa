// ── useChat.js ────────────────────────────────────────────────────────────────
// Groq API (via /api/chat Vercel function) with knowledge base fallback.
//
// Changes in this version:
//   - Chat messages persisted to localStorage with 24-hour expiry.
//   - API history reconstructed from saved messages on page load.
//   - Student profile block now exposes faculty, matric number, and session.
//   - HOW TO RESPOND block includes letter/document drafting rule.
//   - fmtReq never includes numbers above the scale maximum in the prompt.
//     Groq cannot quote what it never sees.
//   - HOW TO RESPOND block includes scale guard and anti-filler rules.
//   - Full conversation history (apiHistoryRef) sent to Groq every turn.
//   - System prompt built here. /api/chat.js is a thin pass-through.
//   - Multi-semester consistent GPA figures pre-computed in JS.
//     Model reads ready numbers — no arithmetic delegated to Groq.

import { useState, useCallback, useRef, useEffect } from "react";

import { generateId }                       from "../utils/idGenerator.js";
import { matchQuery }                       from "../utils/queryMatcher.js";
import { buildContext }                     from "../utils/responseRenderer.js";
import { KNOWLEDGE_BASE, SUGGESTED_CHIPS } from "../data/knowledgeBase.js";

export { SUGGESTED_CHIPS };


// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_API_HISTORY_TURNS = 6;
const RESPONSE_DELAY_MS     = 320;

const CHAT_STORAGE_KEY = "ngcgpa_chat_v1";
const CHAT_EXPIRY_MS   = 24 * 60 * 60 * 1000; // 24 hours

const NO_MATCH_RESPONSE =
  "I don't have a specific answer for that right now. Here are things I can help with:\n\n" +
  "- Am I on track for First Class?\n" +
  "- What GPA do I need next semester?\n" +
  "- I failed a course — how bad is it?\n" +
  "- What class will I graduate with at this rate?\n" +
  "- How do I move from a 2:2 to a 2:1?\n" +
  "- What is the minimum to avoid Third Class?\n\n" +
  "Try rephrasing, or tap one of the suggestions above.";


// ── Helpers ───────────────────────────────────────────────────────────────────

function loadChatFromStorage() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { messages: [], history: [] };

    const parsed = JSON.parse(raw);
    if (!parsed?.lastMessageAt) return { messages: [], history: [] };

    const expired = Date.now() - parsed.lastMessageAt > CHAT_EXPIRY_MS;
    if (expired) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return { messages: [], history: [] };
    }

    const messages = parsed.messages ?? [];

    // Reconstruct API history from non-KB, non-error messages only.
    // This gives Groq context continuity across page refreshes.
    const history = messages
      .filter(m => !m.isFromKnowledgeBase && !m.isError)
      .map(m => ({ role: m.role, content: m.content }));

    return { messages, history };
  } catch {
    return { messages: [], history: [] };
  }
}


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
  // ── Load persisted chat on first render ──────────────────────────────────
  const { messages: savedMessages, history: savedHistory } = loadChatFromStorage();

  const [messages,     setMessages]     = useState(savedMessages);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isAPIOnline,  setIsAPIOnline]  = useState(true);
  const [pendingRetry, setPendingRetry] = useState(null);

  // API-formatted conversation history.
  // Separate from `messages` so KB/error messages never pollute the API context.
  // Seeded from localStorage on mount for cross-refresh continuity.
  // Shape: Array<{ role: "user" | "assistant", content: string }>
  const apiHistoryRef = useRef(savedHistory);


  // ── Persist messages to localStorage ─────────────────────────────────────
  // Fires whenever messages change. lastMessageAt resets on every new message,
  // so active conversations naturally extend their own 24-hour window.

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        messages,
        lastMessageAt: Date.now(),
      }));
    } catch {
      // Storage full or unavailable — silent fail.
    }
  }, [messages]);


  // ── Build system prompt ────────────────────────────────────────────────────

  const buildSystemPrompt = useCallback(() => {
    const inst      = institution;
    const scaleMax  = inst?.scale ?? 5;
    const classList = inst?.classifications ?? [];
    const totalCU   = totals?.totalCU ?? 0;
    const totalQP   = totals?.totalQP ?? 0;
    const cgpaVal   = cgpa ?? null;
    const passmark  = inst?.passmark ?? 40;


    // ── Classification boundaries ────────────────────────────────────────────

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


    // ── Semester GPA list ────────────────────────────────────────────────────

    const semGPAs = (semesters ?? [])
      .map((s, i) => {
        const qp = (s.courses ?? []).reduce((acc, c) => acc + (Number(c.qualityPoint) || 0), 0);
        const cu = (s.courses ?? []).reduce((acc, c) => acc + (Number(c.creditUnits)  || 0), 0);
        if (cu === 0) return null;
        return `Sem ${i + 1} (${s.label}): ${(qp / cu).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(" | ");


    // ── Failed courses ───────────────────────────────────────────────────────

    const failedCourses = (semesters ?? [])
      .flatMap(s =>
        (s.courses ?? [])
          .filter(c => Number(c.gradePoint) === 0 && Number(c.creditUnits) > 0)
          .map(c => `${c.name || "Unnamed"} (${c.creditUnits} units, ${s.label})`)
      );


    // ── Borderline check ─────────────────────────────────────────────────────

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


    // ── Required GPA calculator ──────────────────────────────────────────────

    function reqGPAat(targetCGPA, futureCU) {
      if (!totalCU || !futureCU) return null;
      const needed = (targetCGPA * (totalCU + futureCU) - totalQP) / futureCU;
      if (isNaN(needed) || !isFinite(needed)) return null;
      return Math.round(needed * 100) / 100;
    }


    // ── Max reachable CGPA ───────────────────────────────────────────────────

    function maxReachableCGPA(futureSems, cuPerSem = 18) {
      if (!totalCU) return null;
      const futCU = futureSems * cuPerSem;
      return Math.round(((totalQP + scaleMax * futCU) / (totalCU + futCU)) * 100) / 100;
    }


    // ── Format required GPA for display in prompt ────────────────────────────

    function fmtReq(val) {
      if (val === null)          return `N/A — no course data entered yet`;
      if (val < 0)               return `Already achieved`;
      if (val > scaleMax)        return `Not achievable in one semester — exceeds the ${scaleMax} scale maximum`;
      if (val > scaleMax * 0.90) return `${val.toFixed(2)} — very challenging`;
      if (val > scaleMax * 0.75) return `${val.toFixed(2)} — challenging but realistic`;
      return `${val.toFixed(2)} — achievable`;
    }

    function fmtConsistent(val, sems) {
      if (val === null)    return `N/A — no course data entered yet`;
      if (val < 0)         return `Already achieved`;
      if (val > scaleMax)  return `Not reachable even over ${sems} perfect semesters`;
      if (val > scaleMax * 0.90) return `${val.toFixed(2)} per semester — very challenging`;
      if (val > scaleMax * 0.75) return `${val.toFixed(2)} per semester — challenging but realistic`;
      return `${val.toFixed(2)} per semester — achievable`;
    }


    // ── Pre-compute key figures ──────────────────────────────────────────────

    const hasData = totalCU > 0;

    const toFirst18    = hasData ? reqGPAat(firstMin, 18)      : null;
    const toUpper18    = hasData ? reqGPAat(upperMin, 18)      : null;
    const toLower18    = hasData ? reqGPAat(lowerMin, 18)      : null;
    const maxIn2       = hasData ? maxReachableCGPA(2)         : null;
    const maxIn4       = hasData ? maxReachableCGPA(4)         : null;
    const maxIn6       = hasData ? maxReachableCGPA(6)         : null;
    const toFirst4Sems = hasData ? reqGPAat(firstMin, 4 * 18) : null;
    const toFirst6Sems = hasData ? reqGPAat(firstMin, 6 * 18) : null;


    // ── Student profile fields ───────────────────────────────────────────────

    const studentName    = student?.name            || null;
    const dept           = student?.department      || null;
    const faculty        = student?.faculty         || null;
    const matricNumber   = student?.matricNumber    || null;
    const level          = student?.level           || null;
    const academicSession = student?.academicSession || null;


    // ── Assemble prompt ──────────────────────────────────────────────────────

    return `You are an academic advisor for Nigerian university students. Give direct, specific, personalised advice using the student's real numbers below.

STUDENT PROFILE:
Name: ${studentName ?? "not provided"}
Department: ${dept ?? "not provided"}
Faculty: ${faculty ?? "not provided"}
Matric number: ${matricNumber ?? "not provided"}
Level: ${level ?? "not provided"}
Academic session: ${academicSession ?? "not provided"}
University: ${inst?.name ?? "Not selected"}
Grading scale: ${scaleMax} point scale (this is the absolute maximum any GPA or CGPA can reach)
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
First Class:        ${firstMin} and above
Second Upper (2:1): ${upperMin} and above
Second Lower (2:2): ${lowerMin} and above
Third Class:        ${thirdMin} and above
Scale maximum:      ${scaleMax} (no GPA or CGPA can exceed this number)

${hasData ? `REQUIRED GPA NEXT SEMESTER (assuming 18 credit units — most common load):
To reach First Class (${firstMin}):  ${fmtReq(toFirst18)}
To reach 2:1 (${upperMin}):          ${fmtReq(toUpper18)}
To reach 2:2 (${lowerMin}):          ${fmtReq(toLower18)}

MAXIMUM CGPA STILL REACHABLE (scoring ${scaleMax}.00 every remaining semester at 18 CU):
After 2 more perfect semesters: ${maxIn2 ?? "N/A"}
After 4 more perfect semesters: ${maxIn4 ?? "N/A"}
After 6 more perfect semesters: ${maxIn6 ?? "N/A"}

CONSISTENT GPA PER SEMESTER TO APPROACH FIRST CLASS OVER MULTIPLE SEMESTERS:
Over 4 semesters (72 CU total): ${fmtConsistent(toFirst4Sems, 4)}
Over 6 semesters (108 CU total): ${fmtConsistent(toFirst6Sems, 6)}` : "No course data entered yet — ask the student to add their courses first."}

HOW TO RESPOND:
- Answer exactly what was asked. Do not dump all figures into every response.
- If they ask what GPA they need, give the single most relevant figure (18 CU default). State clearly if it is achievable or not, then move on.
- If they ask how close they are, lead with the gap in CGPA points and what it means — not a list of required GPAs.
- SCALE RULE: No GPA or CGPA can ever exceed ${scaleMax} at this university. If a required GPA shows "Not achievable in one semester", never mention any number above ${scaleMax}. Say clearly the target cannot be reached in one semester. Then tell the student two things only: (1) the maximum CGPA they can still reach from the figures above, and (2) the consistent GPA per semester from the "CONSISTENT GPA PER SEMESTER" section above. Do not pivot to lower classifications. Do not talk about maintaining their current class unless they specifically ask about that.
- When a target is not achievable in one semester, open with a clean declarative like "First Class isn't reachable in one semester from your current standing." Never say "To reach [target], it's not achievable" — that is grammatically broken. Then use the pre-computed "CONSISTENT GPA PER SEMESTER TO APPROACH FIRST CLASS" figures from the data above. State the 4-semester figure if it is within the scale maximum. If not, state the 6-semester figure. If neither is achievable, tell the student First Class is out of reach entirely and they should focus on securing the best class still available to them. Never say "strong consistent performance" without attaching a specific GPA number.
- Never open with filler phrases like "You're looking for a specific answer", "Great question", "That's a good question", or any sentence that restates what the student just asked. Start directly with the answer or the key number.
- Keep responses under 150 words unless the student asks for a detailed breakdown or a letter or document.
- Vary your phrasing — do not start every response the same way.
- Be direct and warm, like a knowledgeable senior who genuinely wants them to succeed.
- If the student has no data yet, ask them to enter their courses before you can give specific numbers.
- Do not list scenarios for 15 CU, 18 CU, and 20 CU in the same response unless the student specifically asks about different credit loads.
- Never use em-dashes. Use commas, colons, or periods instead.
- LETTER AND DOCUMENT REQUESTS: When the student asks you to draft any letter, appeal, or petition, you must use their real data in the letter body. Use their actual university name, department, faculty, CGPA to 4 decimal places, and degree class. For the matric number and academic session, use the real value if provided; use a bracket placeholder like [Matric Number] only if the field shows "not provided". For the student name, if it shows "not provided", use "[Your Name]" as the signature placeholder but write the rest of the letter in first person as though it belongs to this specific student. Never produce a fully generic template. Every letter must reference at least the real university name and real CGPA.`;

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

  const callGroq = useCallback(async (userMessage) => {
    const systemPrompt = buildSystemPrompt();

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
      responseContent = await callGroq(trimmed);
      setIsAPIOnline(true);

      apiHistoryRef.current = [
        ...apiHistoryRef.current,
        { role: "user",      content: trimmed         },
        { role: "assistant", content: responseContent },
      ];

    } catch (err) {
      console.warn("[NG CGPA] Groq unavailable, using knowledge base:", err.message);
      setIsAPIOnline(false);
      setPendingRetry(trimmed);

      const fallback      = callKnowledgeBase(trimmed);
      responseContent     = fallback.content;
      matchedTopic        = fallback.topic;
      isFromKnowledgeBase = true;
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
    apiHistoryRef.current = [];
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Silent
    }
  }, []);


  // ── Dismiss error ──────────────────────────────────────────────────────────

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