// api/chat.js — Vercel Serverless Function
// Calls Groq API server-side. GROQ_API_KEY never reaches the browser.
//
// This function is now a thin pass-through.
// The system prompt and conversation history are built in useChat.js
// and sent here as { systemPrompt, messages }.
// This function does not build any prompt or inject any context itself.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { systemPrompt, messages } = req.body ?? {};

  if (!systemPrompt || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing systemPrompt or messages" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      "openai/gpt-oss-120b",
        max_tokens: 500,
        temperature: 0.72,   // was 0.5 — higher temperature = more variation
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,        // full conversation history from useChat.js
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("[NG CGPA] Groq error:", groqRes.status, errText);
      return res.status(502).json({ error: "Groq API error", status: groqRes.status });
    }

    const data    = await groqRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return res.status(502).json({ error: "Empty response from Groq" });
    }

    return res.status(200).json({ content });

  } catch (err) {
    console.error("[NG CGPA] Handler error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
