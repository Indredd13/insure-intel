import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required. Configure it in Settings." },
        { status: 400 }
      );
    }

    // Call Google Gemini REST API (v1 + gemini-1.5-flash for reliable free tier)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("[ai/generate] Gemini error:", geminiRes.status, errBody);

      if (geminiRes.status === 400 && errBody.includes("API_KEY_INVALID")) {
        return NextResponse.json(
          { error: "Invalid API key. Check your Gemini key in Settings." },
          { status: 401 }
        );
      }
      if (geminiRes.status === 429) {
        const isZeroQuota = errBody.includes("limit: 0");
        return NextResponse.json(
          {
            error: isZeroQuota
              ? "Your API key has no quota. Create a new key at aistudio.google.com/apikey (not Google Cloud Console) to get free tier access."
              : "Rate limit exceeded. Gemini free tier allows 15 requests/minute. Wait a moment and try again.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Gemini API error (${geminiRes.status})` },
        { status: 502 }
      );
    }

    const data = await geminiRes.json();

    // Extract text from Gemini response
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return NextResponse.json(
        { error: "Gemini returned an empty response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[ai/generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI analysis" },
      { status: 500 }
    );
  }
}
