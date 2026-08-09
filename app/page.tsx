"use client";

import { FormEvent, useState } from "react";

type Step = { time: string; title: string; detail: string };
type Session = { title: string; steps: Step[] };
const examples = ["Electricity", "Trigonometry", "Carbon compounds"];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Class 10");
  const [minutes, setMinutes] = useState("45");
  const [goal, setGoal] = useState("Understand the topic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);

  async function generateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSession(null);
    if (!topic.trim()) { setError("Tell us what you want to study first."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/study-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: topic.trim(), level, minutes: Number(minutes), goal }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      setSession(data.session);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <nav className="navbar">
        <div className="brand"><div className="brand-mark">S</div><div><div className="brand-name">StudyFlow</div><div className="brand-caption">AI study sessions</div></div></div>
        <div className="nav-pill"><span className="live-dot" /> Built for focused learning</div>
      </nav>

      <section className="hero">
        <div className="hero-copy-block">
          <div className="eyebrow"><span>✦</span> Your next study session</div>
          <h1>Make the next <em>45 minutes</em> count.</h1>
          <p className="hero-copy">Stop wondering what to study next. Give StudyFlow a topic, your time, and your goal — and get a focused AI session built around <strong>learning, practice, testing, and recall.</strong></p>
          <div className="mini-proof"><div className="avatars"><span>✦</span><span>✓</span><span>→</span></div><div><strong>Less planning. More learning.</strong><small>Designed for the session you have right now.</small></div></div>
        </div>

        <form className="planner-card" onSubmit={generateSession}>
          <div className="card-topline"><span className="spark">✦</span><span>BUILD A SESSION</span></div>
          <h2 className="card-title">What are you studying?</h2><p className="card-subtitle">One topic is enough. StudyFlow handles the structure.</p>
          <div className="field"><label htmlFor="topic">Topic</label><input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Electricity — Ohm's law" maxLength={200} autoComplete="off" /><div className="example-row">{examples.map((example) => <button type="button" key={example} onClick={() => setTopic(example)}>{example}</button>)}</div></div>
          <div className="form-two-col">
            <div className="field"><label htmlFor="level">Level</label><select id="level" value={level} onChange={(e) => setLevel(e.target.value)}><option>Class 8</option><option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option><option>College</option><option>Other</option></select></div>
            <div className="field"><label htmlFor="minutes">Time available</label><select id="minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></div>
          </div>
          <div className="field"><label htmlFor="goal">What do you want to accomplish?</label><select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}><option>Understand the topic</option><option>Prepare for a test</option><option>Practice problems</option><option>Revise quickly</option></select></div>
          <button className="primary-button" type="submit" disabled={loading}><span>{loading ? "Building your session…" : "Build my session"}</span><span className="button-arrow">→</span></button>
          {error && <div className="result-error" role="alert">{error}</div>}
          <div className="privacy-note"><span>●</span> No account needed to try the MVP.</div>
        </form>
      </section>

      <section className="process-section"><div className="section-heading"><span className="eyebrow">HOW IT WORKS</span><h2>A study session with a purpose.</h2></div>
        <div className="process-grid">
          <div className="process-card"><div className="process-number">01</div><div className="process-icon">◒</div><h3>Learn</h3><p>Start with the concepts that matter most for your goal.</p></div>
          <div className="process-card featured"><div className="process-number">02</div><div className="process-icon">✦</div><h3>Practice</h3><p>Turn understanding into ability with targeted practice.</p></div>
          <div className="process-card"><div className="process-number">03</div><div className="process-icon">✓</div><h3>Recall</h3><p>Finish by checking what actually stayed in your memory.</p></div>
        </div>
      </section>

      {session && <section className="result-wrap"><div className="result-card"><div className="result-header"><div><div className="eyebrow">YOUR SESSION</div><h2>{session.title}</h2></div><div className="result-badge">AI planned</div></div><div className="session-list">{session.steps.map((step, index) => <div className="session-step" key={`${step.title}-${index}`}><div className="step-index">{String(index + 1).padStart(2, "0")}</div><div className="step-time">{step.time}</div><div><div className="step-title">{step.title}</div><div className="step-detail">{step.detail}</div></div></div>)}</div></div></section>}
      <footer className="footer"><div><strong>StudyFlow</strong> · AI-powered focused study sessions</div><div>Built to help students spend less time planning and more time learning.</div></footer>
    </main>
  );
}
