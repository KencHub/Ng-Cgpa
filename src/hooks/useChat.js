// ── useChat.js ────────────────────────────────────────────────────────────────
// Manages the AI chat assistant with four fallback layers.
//
// Layer 1: Anthropic API (primary)
// Layer 1.5: QA cache — past answers stored in localStorage, searched by keyword
// Layer 2: Built-in knowledge base (hardcoded, keyword matching)
// Layer 3: Help Center (triggered separately — always offline)
// Layer 4: Contextual field tooltips (per-input, always offline)
//
// The QA cache is populated automatically every time the API returns a
// successful answer. It persists in localStorage under 'ng-cgpa-qa-cache'.
// When offline, the cache is searched before falling back to the hardcoded
// knowledge base, so the app gets smarter the more it is used online.


import { useState, useRef, useCallback, useEffect } from "react";
import { generateId } from "../utils/idGenerator.js";


// ── Constants ─────────────────────────────────────────────────────────────────

const API_ENDPOINT   = "https://api.anthropic.com/v1/messages";
const API_MODEL      = "claude-sonnet-4-20250514";
const API_MAX_TOKENS = 1000;
const AUTO_RETRY_MS  = 30000;
const MAX_HISTORY    = 20;

const QA_CACHE_KEY   = "ng-cgpa-qa-cache";
const QA_CACHE_MAX   = 100;  // maximum Q&A pairs kept in localStorage


// ── QA cache helpers (module-level, no React state) ──────────────────────────

function loadQACache() {
  try {
    const raw = localStorage.getItem(QA_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQACache(pairs) {
  try {
    // Keep only the most recent QA_CACHE_MAX pairs
    localStorage.setItem(QA_CACHE_KEY, JSON.stringify(pairs.slice(-QA_CACHE_MAX)));
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

function storeQAPair(question, answer) {
  const cache = loadQACache();
  // Skip if this exact question was already stored
  const alreadyStored = cache.some(
    (p) => p.question.toLowerCase().trim() === question.toLowerCase().trim()
  );
  if (alreadyStored) return;

  cache.push({ question: question.trim(), answer, timestamp: Date.now() });
  saveQACache(cache);
}

function searchQACache(question) {
  const cache = loadQACache();
  if (!cache.length) return null;

  // Tokenise the query, stripping stop words and short tokens
  const stopWords = new Set([
    "what", "how", "does", "will", "can", "the", "my", "your",
    "with", "from", "this", "that", "have", "for", "are", "not",
    "when", "were", "which", "about", "would", "could", "should",
    "just", "like", "some", "than", "then", "also", "very",
  ]);

  const queryWords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  if (queryWords.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const pair of cache) {
    const text  = `${pair.question} ${pair.answer}`.toLowerCase();
    const score = queryWords.filter((w) => text.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pair;
    }
  }

  // Require at least 2 meaningful keyword overlaps
  return bestScore >= 2 ? bestMatch : null;
}

function clearAllQACache() {
  try { localStorage.removeItem(QA_CACHE_KEY); } catch { /* ignore */ }
}

export function getQACacheSize() {
  return loadQACache().length;
}


// ── Knowledge base ────────────────────────────────────────────────────────────
// Hardcoded fallback — only reached if QA cache also misses.

const KNOWLEDGE_BASE = [
  {
    id:       "what-is-cgpa",
    keywords: ["what is cgpa", "cgpa mean", "cgpa stand", "cumulative gpa"],
    answer:
      "CGPA (Cumulative Grade Point Average) measures your overall academic " +
      "performance across all semesters. It is calculated by dividing your " +
      "total quality points across ALL semesters by your total credit units " +
      "across ALL semesters. It is NOT the average of your semester GPAs. " +
      "Those two methods only agree when every semester has identical credit " +
      "unit loads, which is almost never the case.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "what-is-gpa",
    keywords: ["what is gpa", "gpa mean", "gpa stand", "grade point average", "how is gpa"],
    answer:
      "GPA (Grade Point Average) is the result of dividing your total quality " +
      "points for one semester by the total credit units in that semester. " +
      "A quality point is the grade point multiplied by the credit unit of a " +
      "course. For example: a B (4 points) in a 3-unit course gives 12 quality " +
      "points. Sum all quality points, divide by sum of all credit units, and " +
      "you get your GPA for that semester.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "how-to-improve",
    keywords: ["improve cgpa", "boost cgpa", "increase cgpa", "raise cgpa", "improve my cgpa",
               "how do i improve", "how to improve", "move from", "go from"],
    answer:
      "Your CGPA is a weighted average. Past semesters are locked in, but " +
      "future semesters can shift it in either direction. The impact of each " +
      "new semester decreases as you accumulate more credit units, so the " +
      "earlier you act, the more leverage you have.\n\n" +
      "Focus on high-credit courses. A grade change in a 4-unit course moves " +
      "your CGPA more than the same change in a 1-unit course. Consistent Bs " +
      "across all courses is more effective than one A and several Ds.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "failed-course",
    keywords: ["fail", "failed", "zero", "f grade", "i got an f", "i failed"],
    answer:
      "An F grade contributes 0 quality points but its credit units are still " +
      "added to your total credit unit count, which is the denominator of your " +
      "CGPA. This lowers your CGPA in two ways: it adds nothing to the numerator " +
      "and it increases the denominator.\n\n" +
      "Retaking the course and passing adds quality points without increasing " +
      "the total credit unit count again (those units were already counted in " +
      "the first attempt), which improves your CGPA directly.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "carryover",
    keywords: ["carryover", "carry over", "carry-over", "retake", "supplementary",
               "resit", "re-sit"],
    answer:
      "A carryover is a course you failed and must retake in a subsequent " +
      "semester. When you retake and pass it, the new grade typically replaces " +
      "or supplements the original grade in the calculation, depending on your " +
      "institution's policy. Most Nigerian universities use the better grade.\n\n" +
      "The credit units are not counted twice since they were already in your " +
      "total from the first attempt. This means every quality point you add " +
      "from a retake goes directly toward improving your CGPA.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "credit-units",
    keywords: ["credit unit", "credit load", "unit", "course weight", "how many unit"],
    answer:
      "Credit units represent the weight of each course in your CGPA " +
      "calculation. A 3-unit course contributes three times as much to your " +
      "CGPA as a 1-unit course. This is why focusing extra effort on high-unit " +
      "courses is strategically important.\n\n" +
      "Most Nigerian university semesters carry between 15 and 24 credit units. " +
      "Laboratory and practical courses tend to carry more units. Check your " +
      "faculty handbook for the official credit load for each course.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "borderline",
    keywords: ["borderline", "close to first", "close to 2:1", "close to second",
               "just below", "0.1", "0.10", "boundary"],
    answer:
      "Borderline status means your CGPA is very close to a classification " +
      "boundary, typically within 0.10 grade points. For example, a CGPA of " +
      "3.41 on a 5.0 scale is borderline for a 2:1, which starts at 3.50.\n\n" +
      "At this point, one consistently strong semester is often enough to cross " +
      "the boundary. Some Nigerian universities apply discretionary upgrades for " +
      "borderline students with strong final-year performance, though this varies " +
      "by institution. Do not rely on a discretionary upgrade, aim to cross the " +
      "boundary on merit.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
  {
    id:       "first-class",
    keywords: ["first class", "first-class", "4.5", "4.50"],
    answer:
      "A First Class degree on the 5.0 NUC scale requires a CGPA of 4.50 or " +
      "above. On the 4.0 scale (used by Covenant University, Babcock, and " +
      "others), First Class requires 3.50 or above.\n\n" +
      "Achieving First Class requires sustained high performance. Most students " +
      "who reach it earn mostly As with very few Bs. Carryovers and low grades " +
      "in high-credit courses make it significantly harder to achieve later.\n\n" +
      "This is a general answer. Connect to the internet to get a personalised " +
      "response based on your actual data.",
  },
];


// ── Suggested prompt chips ────────────────────────────────────────────────────

export const SUGGESTED_CHIPS = [
  "Am I on track for a First Class?",
  "What GPA do I need next semester?",
  "I failed a course. How bad is it?",
  "What class will I graduate with at this rate?",
  "How do I move from a 2:2 to a 2:1?",
  "What is the minimum I need to avoid Third Class?",
];


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
}) {
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [pendingRetry, setPendingRetry] = useState(null);
  const [isAPIOnline,  setIsAPIOnline]  = useState(true);

  const retryTimerRef   = useRef(null);
  const abortController = useRef(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current)   clearTimeout(retryTimerRef.current);
      if (abortController.current) abortController.current.abort();
    };
  }, []);


  // ── System prompt builder ───────────────────────────────────────────────────

  function buildSystemPrompt() {
    const completedSemesters = semesters.filter(
      (s) => Array.isArray(s.courses) && s.courses.length > 0
    ).length;

    const semGPAList = semesterSummaries
      .filter((s) => s.gpa !== null)
      .map((s) => `${s.label}: ${s.gpa.toFixed(2)}`)
      .join(", ");

    const borderlineStatus = getBorderlineStatus(cgpa, activeClassifications);

    return (
      `You are an academic advisor for Nigerian university students. ` +
      `Be direct, specific, and numerical. Never give generic advice. ` +
      `Always reference the student's actual data. ` +
      `Do not use em-dashes. Use colons, commas, or periods instead.\n\n` +

      `Student data:\n` +
      `- University: ${institution?.name || "Not selected"}\n` +
      `- Grading scale: ${activeScale}\n` +
      `- Current CGPA: ${cgpa !== null ? cgpa.toFixed(2) : "No data"} out of ${activeScale}\n` +
      `- Current class: ${degreeClass || "Not yet determined"}\n` +
      `- Semesters completed: ${completedSemesters}\n` +
      `- Total credit units: ${totals.totalCU}\n` +
      `- Total quality points: ${Math.round(totals.totalQP * 100) / 100}\n` +
      `- Semester GPAs: ${semGPAList || "None yet"}\n` +
      `- Borderline status: ${borderlineStatus}\n\n` +

      `Answer the student's question using their exact numbers. ` +
      `Calculate what they need. If they ask about improving, give specific ` +
      `required GPAs. If they ask about a failed course, explain the exact ` +
      `CGPA impact using their total credit units. ` +
      `Keep responses under 200 words. Use short paragraphs.`
    );
  }


  // ── Knowledge base match ────────────────────────────────────────────────────

  function matchKnowledgeBase(userMessage) {
    const lower = userMessage.toLowerCase();
    for (const entry of KNOWLEDGE_BASE) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return entry.answer;
      }
    }
    return null;
  }


  // ── API call ────────────────────────────────────────────────────────────────

  async function callAPI(userMessage) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    const history = messages
      .filter((m) => !m.isError && !m.isPending && m.content)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    const apiMessages = [...history, { role: "user", content: userMessage }];

    abortController.current = new AbortController();

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type":                              "application/json",
        "x-api-key":                                 apiKey,
        "anthropic-version":                         "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model:      API_MODEL,
        max_tokens: API_MAX_TOKENS,
        system:     buildSystemPrompt(),
        messages:   apiMessages,
      }),
      signal: abortController.current.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP_${response.status}: ${errorText.slice(0, 120)}`);
    }

    const data = await response.json();
    if (!data.content || !data.content[0]?.text) throw new Error("EMPTY_RESPONSE");

    return data.content[0].text;
  }


  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (userMessage) => {
      const trimmed = userMessage?.trim();
      if (!trimmed || isLoading) return;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setPendingRetry(null);

      const userMsgId = generateId("msg");
      const userMsg   = {
        id:                  userMsgId,
        role:                "user",
        content:             trimmed,
        timestamp:           new Date().toISOString(),
        isError:             false,
        isPending:           false,
        isFromKnowledgeBase: false,
        isFromCache:         false,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // ── Layer 1: Try API ──────────────────────────────────────────────────
      try {
        const reply = await callAPI(trimmed);
        setIsAPIOnline(true);

        // Store the successful Q&A for future offline use
        storeQAPair(trimmed, reply);

        const assistantMsg = {
          id:                  generateId("msg"),
          role:                "assistant",
          content:             reply,
          timestamp:           new Date().toISOString(),
          isError:             false,
          isPending:           false,
          isFromKnowledgeBase: false,
          isFromCache:         false,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
        return;

      } catch (err) {
        if (err.name === "AbortError") {
          setIsLoading(false);
          return;
        }
        setIsAPIOnline(false);
      }

      // ── Layer 1.5: Search QA cache from past sessions ────────────────────
      const cachedPair = searchQACache(trimmed);
      if (cachedPair) {
        const cacheMsg = {
          id:                  generateId("msg"),
          role:                "assistant",
          content:             cachedPair.answer,
          timestamp:           new Date().toISOString(),
          isError:             false,
          isPending:           false,
          isFromKnowledgeBase: false,
          isFromCache:         true,
        };
        setMessages((prev) => [...prev, cacheMsg]);
        setIsLoading(false);
        return;
      }

      // ── Layer 2: Hardcoded knowledge base ────────────────────────────────
      const kbAnswer = matchKnowledgeBase(trimmed);
      if (kbAnswer) {
        const kbMsg = {
          id:                  generateId("msg"),
          role:                "assistant",
          content:             kbAnswer,
          timestamp:           new Date().toISOString(),
          isError:             false,
          isPending:           false,
          isFromKnowledgeBase: true,
          isFromCache:         false,
        };
        setMessages((prev) => [...prev, kbMsg]);
        setIsLoading(false);
        return;
      }

      // ── Unavailability notice ─────────────────────────────────────────────
      const retryPayload = { messageId: userMsgId, content: trimmed };
      setPendingRetry(retryPayload);

      const errorMsg = {
        id:                  generateId("msg"),
        role:                "assistant",
        content:
          "The Academic Assistant is temporarily unavailable. Your question " +
          "has been saved. All calculation features continue working normally. " +
          "Try again in a moment.",
        timestamp:           new Date().toISOString(),
        isError:             true,
        isPending:           true,
        isFromKnowledgeBase: false,
        isFromCache:         false,
        retryPayload,
      };

      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);

      retryTimerRef.current = setTimeout(() => {
        retryMessage(retryPayload);
      }, AUTO_RETRY_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, messages, institution, cgpa, degreeClass, totals, activeScale,
     semesterSummaries, activeClassifications, semesters]
  );


  // ── Retry ───────────────────────────────────────────────────────────────────

  const retryMessage = useCallback(
    async (payload) => {
      const retryPayload = payload || pendingRetry;
      if (!retryPayload || isLoading) return;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.isPending && m.retryPayload?.messageId === retryPayload.messageId
            ? { ...m, content: "Retrying…", isPending: false }
            : m
        )
      );

      setPendingRetry(null);
      setIsLoading(true);

      try {
        const reply = await callAPI(retryPayload.content);
        setIsAPIOnline(true);
        storeQAPair(retryPayload.content, reply);

        setMessages((prev) =>
          prev.map((m) =>
            m.retryPayload?.messageId === retryPayload.messageId
              ? { ...m, content: reply, isError: false, isPending: false, retryPayload: undefined }
              : m
          )
        );
      } catch {
        setIsAPIOnline(false);
        setPendingRetry(retryPayload);

        setMessages((prev) =>
          prev.map((m) =>
            m.retryPayload?.messageId === retryPayload.messageId
              ? {
                  ...m,
                  content:
                    "Still unavailable. Your question is saved. " +
                    "Tap Retry to try again when you have a connection.",
                  isError:   true,
                  isPending: true,
                }
              : m
          )
        );

        retryTimerRef.current = setTimeout(() => {
          retryMessage(retryPayload);
        }, AUTO_RETRY_MS);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingRetry, isLoading, messages, cgpa, totals, institution,
     degreeClass, activeScale, semesterSummaries, activeClassifications, semesters]
  );


  // ── Clear chat ───────────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setMessages([]);
    setPendingRetry(null);
    setIsLoading(false);
  }, []);


  // ── Dismiss error message ────────────────────────────────────────────────────

  const dismissError = useCallback((messageId) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setPendingRetry((prev) =>
      prev?.messageId === messageId ? null : prev
    );
  }, []);


  // ── Clear QA cache ───────────────────────────────────────────────────────────

  const clearQACache = useCallback(() => {
    clearAllQACache();
  }, []);


  return {
    messages,
    isLoading,
    pendingRetry,
    isAPIOnline,
    sendMessage,
    retryMessage,
    clearChat,
    dismissError,
    clearQACache,
    suggestedChips: SUGGESTED_CHIPS,
  };
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function getBorderlineStatus(cgpa, classifications) {
  if (cgpa === null || !Array.isArray(classifications)) return "Not borderline";

  const PROXIMITY = 0.10;
  const sorted    = [...classifications].sort((a, b) => b.min - a.min);

  for (const entry of sorted) {
    const gap = entry.min - cgpa;
    if (gap > 0 && gap <= PROXIMITY) {
      return (
        `${cgpa.toFixed(2)} is ${gap.toFixed(2)} points below ` +
        `${entry.label} (requires ${entry.min.toFixed(2)})`
      );
    }
  }

  return "Not borderline";
}