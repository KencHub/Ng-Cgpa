// api/chat.js — Vercel Serverless Function
// Calls Groq API server-side. GROQ_API_KEY never reaches the browser.
//
// The system prompt and conversation history are built in useChat.js
// and sent here as { systemPrompt, messages }. This function does not
// build any prompt or inject any context itself.
//
// Hardening added:
//   - CORS locked to ALLOWED_ORIGINS (env var, comma-separated) instead of "*".
//   - Payload shape/size validation before forwarding to Groq.
//   - AbortController timeout on the Groq fetch so we fail fast instead of
//     waiting for Vercel's own function timeout.
//   - Retry with backoff on transient errors (429 rate limit, 502/503/504).
//   - Dynamic max_tokens: letters/documents get a higher ceiling so they
//     don't get cut off mid-sentence.
//   - Distinct error codes returned so the client can tell "Groq is down"
//     apart from "bad request" apart from "rate limited", if it wants to.

// Timeout budget:
//   - GROQ_TIMEOUT_MS is generous because the system prompt now includes full
//     per-course grade records, which measurably slows Groq's response time.
//     4s (the previous value) was too aggressive and caused every request to
//     time out — this is the bug that broke local testing.
//   - We do NOT retry after our own timeout fires. If Groq took the full
//     budget once, retrying with the same budget just doubles the wait for
//     the same likely outcome. Retries are reserved for genuine transient
//     HTTP errors (429/502/503/504), which usually resolve fast.
//   - GROQ_RETRY_TIMEOUT_MS covers those retry attempts, and also the
//     truncation-escalation call further down.
const GROQ_TIMEOUT_MS       = 15000;
const GROQ_RETRY_TIMEOUT_MS = 9000;
const MAX_MESSAGES      = 40;   // MAX_API_HISTORY_TURNS(6)*2 + current turn, with margin
const MAX_MESSAGE_CHARS = 8000; // generous ceiling per message, well above normal use
const MAX_SYSTEM_CHARS  = 18000; // raised to fit full per-course grade records
const RETRYABLE_STATUS  = new Set([429, 502, 503, 504]);
const MAX_RETRIES       = 1;    // applies only to retryable HTTP errors, not timeouts.
                                 // Worst case: 15000 (initial) + 300 (backoff) + 9000
                                 // (retry) = ~24.3s, under the 30s maxDuration below.

const LETTER_KEYWORDS = [
  "letter", "draft", "appeal", "petition", "plan", "hod",
  "document", "improvement plan",
];

// Questions that pull from the full course-record / grade-distribution data
// in the prompt tend to produce longer, list-style answers (e.g. "how many
// Cs did I have and which courses"). These get a higher token ceiling too.
const DATA_HEAVY_KEYWORDS = [
  "how many", "which course", "which courses", "list", "all my",
  "every course", "breakdown", "all grades", "all my grades",
  "each course", "all courses",
];

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function resolveCORSOrigin(req) {
  const allowed = getAllowedOrigins();
  const origin  = req.headers.origin;
  if (allowed.length === 0) {
    // No env var configured yet — fail closed rather than "*".
    return null;
  }
  if (origin && allowed.includes(origin)) return origin;
  return null;
}

function validatePayload(body) {
  const { systemPrompt, messages } = body ?? {};

  if (!systemPrompt || typeof systemPrompt !== "string") {
    return "Missing or invalid systemPrompt";
  }
  if (systemPrompt.length > MAX_SYSTEM_CHARS) {
    return "systemPrompt too large";
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Missing or empty messages array";
  }
  if (messages.length > MAX_MESSAGES) {
    return "Too many messages in request";
  }
  for (const m of messages) {
    if (!m || typeof m !== "object") return "Malformed message entry";
    if (m.role !== "user" && m.role !== "assistant") return "Invalid message role";
    if (typeof m.content !== "string" || m.content.length === 0) return "Invalid message content";
    if (m.content.length > MAX_MESSAGE_CHARS) return "Message content too large";
  }
  return null; // valid
}

function pickMaxTokens(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content || "").toLowerCase();
  if (LETTER_KEYWORDS.some((kw) => text.includes(kw)))     return 1100;
  if (DATA_HEAVY_KEYWORDS.some((kw) => text.includes(kw))) return 950;
  return 700;
}

async function callGroqOnce(apiKey, systemPrompt, messages, maxTokens, signal) {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model:       "openai/gpt-oss-120b",
      max_tokens:  maxTokens,
      temperature: 0.72,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });
  return groqRes;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Optional: raises this function's execution time limit if your Vercel plan
// supports it (Hobby allows up to 60s, Pro higher). Harmless if your plan
// caps lower — Vercel just uses its own limit instead. This gives headroom
// for the token-escalation retry above on top of the normal retry loop.
export const config = {
  maxDuration: 45,
};

export default async function handler(req, res) {
  const corsOrigin = resolveCORSOrigin(req);
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
  }

    // 👇 ADD THESE TWO LINES HERE REMOVE LATER
  console.error("[DEBUG] origin header:", JSON.stringify(req.headers.origin));
  console.error("[DEBUG] allowed list:", JSON.stringify(getAllowedOrigins()));
  // Reject cross-origin POSTs outright if origin is present and not allowed.
  // (Same-origin requests, curl, and server-to-server calls have no Origin header
  //  and can't be distinguished this way — that's what payload limits + rate
  //  limiting below are for.)
  if (req.headers.origin && !corsOrigin) {
    return res.status(403).json({ error: "Origin not allowed", code: "origin_denied" });
  }

  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError, code: "invalid_payload" });
  }

  const { systemPrompt, messages } = req.body;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured", code: "no_api_key" });
  }

  const maxTokens = pickMaxTokens(messages);

  let lastErr = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptTimeout = attempt === 0 ? GROQ_TIMEOUT_MS : GROQ_RETRY_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), attemptTimeout);

    try {
      const groqRes = await callGroqOnce(apiKey, systemPrompt, messages, maxTokens, controller.signal);
      clearTimeout(timeoutId);

      if (groqRes.ok) {
        const data         = await groqRes.json();
        const content      = data?.choices?.[0]?.message?.content ?? "";
        const finishReason = data?.choices?.[0]?.finish_reason;

        if (!content) {
          return res.status(502).json({ error: "Empty response from Groq", code: "empty_response" });
        }

        // Response was cut off before finishing — retry once with a higher
        // token ceiling rather than silently returning a truncated answer.
        if (finishReason === "length" && maxTokens < 1500) {
          const escalatedTokens = Math.min(Math.round(maxTokens * 1.8), 1500);
          const retryController = new AbortController();
          const retryTimeout    = setTimeout(() => retryController.abort(), GROQ_RETRY_TIMEOUT_MS);
          try {
            const retryRes = await callGroqOnce(apiKey, systemPrompt, messages, escalatedTokens, retryController.signal);
            clearTimeout(retryTimeout);
            if (retryRes.ok) {
              const retryData    = await retryRes.json();
              const retryContent = retryData?.choices?.[0]?.message?.content ?? "";
              if (retryContent) return res.status(200).json({ content: retryContent });
            }
          } catch {
            clearTimeout(retryTimeout);
            // Fall through and return the original (truncated) content below
            // rather than failing the whole request over a completeness retry.
          }
        }

        return res.status(200).json({ content });
      }

      const errText = await groqRes.text();
      console.error("[NG CGPA] Groq error:", groqRes.status, errText);

      if (RETRYABLE_STATUS.has(groqRes.status) && attempt < MAX_RETRIES) {
        lastErr = { status: groqRes.status, errText };
        await sleep(300 * Math.pow(2, attempt)); // 300ms, 600ms backoff
        continue;
      }

      const code =
        groqRes.status === 401 ? "auth_error" :
        groqRes.status === 429 ? "rate_limited" :
        groqRes.status === 404 ? "model_not_found" :
        groqRes.status >= 500  ? "groq_unavailable" :
        "groq_error";

      return res.status(502).json({ error: "Groq API error", status: groqRes.status, code });

    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err.name === "AbortError";
      console.error("[NG CGPA] Handler error:", isAbort ? `timeout after ${attemptTimeout}ms` : err.message);

      // Do not retry after our own timeout — see note above on GROQ_TIMEOUT_MS.
      // Only genuine HTTP errors (handled in the branch above) get retried.
      return res.status(isAbort ? 504 : 500).json({
        error: isAbort ? "Groq request timed out" : "Internal error",
        code:  isAbort ? "timeout" : "internal_error",
      });
    }
  }

  // Exhausted retries
  return res.status(502).json({
    error: "Groq API error after retries",
    status: lastErr?.status ?? null,
    code:  "retries_exhausted",
  });
}
