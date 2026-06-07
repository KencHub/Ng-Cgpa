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
    institutionName, scale, passmark, cgpa,
    degreeClass, semesterCount, totalCreditUnits,
    totalQualityPoints, semesterGPAList, borderlineInfo,
  } = ctx;

  return `You are an academic advisor for Nigerian university students. Be direct, specific, and numerical. Never give generic advice. Always reference the student's actual data. Do not use em-dashes. Use colons, commas, or periods instead. Never start a response with the word "I".

Student data:
- University: ${institutionName ?? "Not selected"}
- Grading scale: ${scale ?? 5} point scale
- Pass mark: ${passmark ?? 40}%
- Current CGPA: ${cgpa !== null && cgpa !== undefined ? Number(cgpa).toFixed(2) : "No data yet"} out of ${scale ?? 5}
- Current class: ${degreeClass ?? "Not yet classified"}
- Semesters completed: ${semesterCount ?? 0}
- Total credit units: ${totalCreditUnits ?? 0}
- Total quality points: ${totalQualityPoints ?? 0}
- Semester GPAs: ${semesterGPAList ?? "None yet"}
- Borderline status: ${borderlineInfo ?? "Not borderline"}

Answer the student's question using their exact numbers. Calculate what they need. If they ask about improving, give specific required GPAs. If they ask about a failed course, explain the exact CGPA impact using their total credit units. Keep responses under 200 words. Use short paragraphs.`;
}