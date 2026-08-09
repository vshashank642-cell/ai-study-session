import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_TOPIC_LENGTH = 200;
const MAX_MINUTES = 120;
const MIN_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;

const requestLog = new Map<string, number[]>();

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function allowedByRateLimit(key: string) {
  const now = Date.now();
  const existing = requestLog.get(key) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, recent);
    return false;
  }

  recent.push(now);
  requestLog.set(key, recent);

  // Prevent this process-local map from growing forever.
  if (requestLog.size > 5000) {
    for (const [storedKey, timestamps] of requestLog) {
      if (!timestamps.some((timestamp) => now - timestamp < WINDOW_MS)) requestLog.delete(storedKey);
    }
  }

  return true;
}

function fallbackSession(topic: string, minutes: number, goal: string) {
  const learn = Math.max(5, Math.round(minutes * 0.25));
  const practice = Math.max(5, Math.round(minutes * 0.35));
  const test = Math.max(3, Math.round(minutes * 0.2));
  const recall = Math.max(2, minutes - learn - practice - test);

  return {
    title: `${topic}: a ${minutes}-minute ${goal.toLowerCase()} session`,
    steps: [
      { time: `${learn} min`, title: "Learn the essentials", detail: `Identify the 3–5 ideas you must understand about ${topic}. Write a one-sentence explanation for each in your own words.` },
      { time: `${practice} min`, title: "Practice actively", detail: `Work through targeted questions on ${topic}. Start without notes, then use your notes only when you get stuck.` },
      { time: `${test} min`, title: "Test yourself", detail: `Close your notes and answer a few questions from memory. Mark every uncertain answer instead of guessing silently.` },
      { time: `${recall} min`, title: "Finish with recall", detail: `Explain ${topic} aloud as if teaching someone younger. List one remaining weak point to revisit later.` },
    ],
  };
}

function parseModelJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI returned an invalid session.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request);
  if (!allowedByRateLimit(key)) {
    return NextResponse.json(
      { error: "You have reached the study-session limit for this hour. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let body: { topic?: unknown; level?: unknown; minutes?: unknown; goal?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send valid session details." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "Class 10";
  const minutes = typeof body.minutes === "number" ? body.minutes : Number(body.minutes);
  const goal = typeof body.goal === "string" ? body.goal.trim() : "Understand the topic";

  if (!topic || topic.length > MAX_TOPIC_LENGTH) {
    return NextResponse.json({ error: `Topic must be between 1 and ${MAX_TOPIC_LENGTH} characters.` }, { status: 400 });
  }
  if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return NextResponse.json({ error: `Study time must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.` }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // The app remains usable before the API is configured. Once GEMINI_API_KEY is
  // added in Vercel, requests automatically use the AI provider.
  if (!apiKey) {
    return NextResponse.json({ session: fallbackSession(topic, minutes, goal), mode: "demo" });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are StudyFlow, an expert study-session designer. Create a realistic, focused study session for a student.\n\nStudent level: ${level}\nTopic: ${topic}\nAvailable time: ${minutes} minutes\nGoal: ${goal}\n\nRules:\n- Fit the complete session inside the available time.\n- Prefer active learning, practice, retrieval, and correction over passive rereading.\n- Be specific to the topic and student level.\n- Return ONLY valid JSON, with no markdown.\n- Use exactly this shape: {"title":"string","steps":[{"time":"string","title":"string","detail":"string"}]}\n- Include 3 to 6 steps.\n- The time fields should be short human-readable durations.\n`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("AI provider error", response.status);
      return NextResponse.json({ error: "The AI service is temporarily unavailable. Please try again shortly." }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Missing AI response text.");

    const session = parseModelJson(text);
    if (!session?.title || !Array.isArray(session?.steps) || session.steps.length === 0) {
      throw new Error("Invalid session structure.");
    }

    return NextResponse.json({ session, mode: "ai" });
  } catch (error) {
    console.error("Study session generation failed", error);
    return NextResponse.json({ error: "We couldn't build your session right now. Please try again." }, { status: 502 });
  }
}
