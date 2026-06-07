// api/chat.js — Vercel Serverless Function
// Calls Groq API server-side. GROQ_API_KEY never reaches the browser.

export default async function handler(req, res) {
  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, context } = req.body ?? {};

  if (!message || !context) {
    return res.status(400).json({ error: "Missing message or context" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const systemPrompt = buildSystemPrompt(context);

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 400,
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: message },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq error:", groqRes.status, errText);
      return res.status(502).json({ error: "Groq API error", status: groqRes.status });
    }

    const data = await groqRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return res.status(502).json({ error: "Empty response from Groq" });
    }

    return res.status(200).json({ content });

  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}

function buildSystemPrompt(ctx) {
  const {
    institutionName, scale, passmark, cgpa, degreeClass,
    semesterCount, totalCreditUnits, totalQualityPoints,
    semesterGPAList, borderlineInfo,
    firstClassMin, upperSecMin, lowerSecMin, thirdClassMin,
    toFirstClass, toUpperSec, toLowerSec, toThirdClass,
    maxCGPAin2Sems, maxCGPAin4Sems, maxCGPAin6Sems,
  } = ctx;

  return `You are an academic advisor for Nigerian university students. Be direct, specific, and numerical. Never give generic advice. Always use the student's exact data provided below. Do not use em-dashes. Use colons, commas, or periods instead. Never start a response with "I".

STUDENT DATA:
- University: ${institutionName ?? "Not selected"}
- Grading scale: ${scale} point scale
- Pass mark: ${passmark}%
- Current CGPA: ${cgpa !== null ? Number(cgpa).toFixed(2) : "No data"} / ${scale}
- Current class: ${degreeClass ?? "Not yet classified"}
- Semesters completed: ${semesterCount}
- Total credit units: ${totalCreditUnits}
- Total quality points: ${totalQualityPoints}
- Semester GPAs: ${semesterGPAList}
- Borderline status: ${borderlineInfo}

CLASS BOUNDARIES AT THIS UNIVERSITY:
- First Class: ${firstClassMin} and above
- Second Class Upper (2:1): ${upperSecMin} and above
- Second Class Lower (2:2): ${lowerSecMin} and above
- Third Class: ${thirdClassMin} and above

PRE-CALCULATED REQUIRED GPAs (USE THESE DIRECTLY, DO NOT RECALCULATE):
To reach First Class (${firstClassMin}):
  - Next semester at 15 credit units: ${toFirstClass?.at15CU}
  - Next semester at 18 credit units: ${toFirstClass?.at18CU}
  - Next semester at 20 credit units: ${toFirstClass?.at20CU}

To reach 2:1 (${upperSecMin}):
  - Next semester at 15 credit units: ${toUpperSec?.at15CU}
  - Next semester at 18 credit units: ${toUpperSec?.at18CU}
  - Next semester at 20 credit units: ${toUpperSec?.at20CU}

To reach 2:2 (${lowerSecMin}):
  - Next semester at 18 credit units: ${toLowerSec?.at18CU}

To stay above Third Class (${thirdClassMin}):
  - Next semester at 18 credit units: ${toThirdClass?.at18CU}

MAXIMUM ACHIEVABLE CGPA (if student scores ${scale}.00 every future semester at 18 CU):
  - After 2 more semesters: ${maxCGPAin2Sems}
  - After 4 more semesters: ${maxCGPAin4Sems}
  - After 6 more semesters: ${maxCGPAin6Sems}

STRICT INSTRUCTIONS:
- Use ONLY the pre-calculated figures above. Never redo the arithmetic yourself.
- If a required GPA shows "Not achievable in one semester", explain that the student needs multiple strong semesters and reference the max achievable CGPA figures.
- If a required GPA shows "Already achieved", confirm the student is on track.
- Quote exact numbers. Never say "approximately" when an exact figure is provided.
- Keep responses under 180 words. Use short paragraphs.
- Never say "total credit units and quality points will be recalculated".`;
}