import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";

export const runtime = "nodejs";

const MAX_TOPIC_LENGTH = 200;
const MAX_MINUTES = 120;
const MIN_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;

// This is a lightweight MVP guard. It is intentionally supplemented by the
// persistent Vercel Data Cache below; a durable cross-instance rate limiter
// should be added with a database/Redis when StudyFlow becomes public at scale.
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
  if (requestLog.size > 5000) {
    for (const [storedKey, timestamps] of requestLog) {
      if (!timestamps.some((timestamp) => now - timestamp < WINDOW_MS)) requestLog.delete(storedKey);
    }
  }
  return true;
}

function cacheKey(topic: string, level: string, minutes: number, goal: string) {
  return createHash("sha256")
    .update(JSON.stringify({ topic, level, minutes, goal }))
    .digest("hex");
}

function fallbackSession(topic: string, minutes: number, goal: string) {
  const orientation = Math.max(2, Math.round(minutes * 0.1));
  const learn = Math.max(4, Math.round(minutes * 0.22));
  const example = Math.max(3, Math.round(minutes * 0.16));
  const practice = Math.max(4, Math.round(minutes * 0.24));
  const test = Math.max(3, Math.round(minutes * 0.16));
  const recap = Math.max(2, minutes - orientation - learn - example - practice - test);

  return {
    title: `${topic}: a ${minutes}-minute ${goal.toLowerCase()} session`,
    steps: [
      { time: `${orientation} min`, title: "Set the target", detail: `Write one sentence describing what you need to be able to do with ${topic} by the end. Skim your notes or textbook headings for 60–90 seconds, then list the 2–3 parts you are least confident about. Finish by choosing one concrete question you want this session to answer.` },
      { time: `${learn} min`, title: "Build the core understanding", detail: `Study only the essential ideas behind ${topic}. For each key concept, write: (1) what it means, (2) the rule/formula/process involved, and (3) one simple example. After each idea, close your notes and explain it in your own words before moving on.` },
      { time: `${example} min`, title: "Work through an example", detail: `Choose one representative ${topic} problem or example. Attempt it before looking at the solution. Then compare your work line by line, identify the first mistake or missing idea, and write a short “why this step works” note.` },
      { time: `${practice} min`, title: "Practice without support", detail: `Complete 2–4 targeted questions on ${topic}, starting with a straightforward one and then increasing the difficulty. Keep your notes closed for the first attempt. For every mistake, record the concept tested, what you did, and the correction you should remember next time.` },
      { time: `${test} min`, title: "Retrieve and test yourself", detail: `Close everything and answer 3–5 quick questions from memory: define the key idea, state the main rule/formula, explain when to use it, and solve one short application. Mark answers as confident or uncertain instead of checking immediately.` },
      { time: `${recap} min`, title: "Lock it in", detail: `Give a 60-second explanation of ${topic} without notes. Write the three most important takeaways, one mistake you made, and one weak point to revisit. End by writing the exact next action for your next study session.` },
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

function validateSession(session: any, minutes: number) {
  if (!session?.title || !Array.isArray(session?.steps) || session.steps.length < 3) return false;
  if (!session.steps.every((step: any) => typeof step?.time === "string" && typeof step?.title === "string" && typeof step?.detail === "string")) return false;

  const total = session.steps.reduce((sum: number, step: any) => {
    const match = String(step.time).match(/(\d+(?:\.\d+)?)/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  // Allow a small parsing tolerance, but reject obviously incomplete plans.
  return total >= minutes - 1 && total <= minutes + 1;
}

async function generateFreshSession(topic: string, level: string, minutes: number, goal: string) {
  const fallback = fallbackSession(topic, minutes, goal);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { session: fallback, mode: "demo" as const };

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are StudyFlow, an expert study-session designer. Create a genuinely actionable study plan that a student can follow minute-by-minute, not a high-level checklist.\n\nStudent level: ${level}\nTopic: ${topic}\nAvailable time: ${minutes} minutes\nGoal: ${goal}\n\nRules:\n- Use the entire available time; step durations must add up to exactly ${minutes} minutes.\n- Create 5 to 6 distinct phases, unless the short time makes 5 impossible.\n- Include a deliberate progression: orient/diagnose, learn core concepts, work an example, active practice, retrieval/testing, and a final recap when time permits.\n- Be specific to ${topic} and ${level}; avoid generic advice that could apply to any subject.\n- Every step's detail must contain concrete actions the student should perform, what they should produce/write/solve, and a quick way to check whether they understood it. Aim for 2–4 sentences per step.\n- Include active learning, practice, retrieval, and correction rather than passive rereading.\n- Make the plan realistic for the stated time. Do not assign more work than can fit.\n- Return ONLY valid JSON, with no markdown.\n- Use exactly this shape: {"title":"string","steps":[{"time":"string","title":"string","detail":"string"}]}\n- The time fields should be short human-readable durations such as "8 min" or "12 min".`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 1800, responseMimeType: "application/json" } }),
    });

    if (!response.ok) {
      const providerBody = await response.text();
      console.error("Gemini provider error", response.status, providerBody.slice(0, 500));
      return { session: fallback, mode: "fallback" as const, aiUnavailable: true };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Missing AI response text.");
    const session = parseModelJson(text);
    if (!validateSession(session, minutes)) throw new Error("Invalid session structure or duration.");
    return { session, mode: "ai" as const };
  } catch (error) {
    console.error("Study session generation failed", error);
    return { session: fallback, mode: "fallback" as const, aiUnavailable: true };
  }
}

// Vercel/Next persistent Data Cache: identical session requests reuse the
// stored result instead of invoking Gemini again. The cache key is derived
// from normalized session inputs, so unrelated requests remain independent.
async function getCachedSession(topic: string, level: string, minutes: number, goal: string) {
  const key = cacheKey(topic, level, minutes, goal);
  const cachedGenerator = unstable_cache(
    () => generateFreshSession(topic, level, minutes, goal),
    ["study-session", key],
    { revalidate: 60 * 60 * 24 * 7, tags: [`study-session:${key}`] },
  );
  return cachedGenerator();
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request);
  if (!allowedByRateLimit(key)) {
    return NextResponse.json({ error: "You have reached the study-session limit for this hour. Please try again later." }, { status: 429, headers: { "Retry-After": "3600", "X-StudyFlow-Cache": "rate-limited" } });
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

  if (!topic || topic.length > MAX_TOPIC_LENGTH) return NextResponse.json({ error: `Topic must be between 1 and ${MAX_TOPIC_LENGTH} characters.` }, { status: 400 });
  if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return NextResponse.json({ error: `Study time must be between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.` }, { status: 400 });

  const normalizedTopic = topic.replace(/\s+/g, " ");
  const normalizedLevel = level || "Class 10";
  const normalizedGoal = goal || "Understand the topic";
  const cacheKeyValue = cacheKey(normalizedTopic, normalizedLevel, minutes, normalizedGoal);

  const result = await getCachedSession(normalizedTopic, normalizedLevel, minutes, normalizedGoal);
  const response = NextResponse.json(result);
  response.headers.set("X-StudyFlow-Cache-Key", cacheKeyValue);
  response.headers.set("X-StudyFlow-Cache-Strategy", "persistent-session-cache");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
