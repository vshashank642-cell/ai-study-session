"use client";

import { FormEvent, useState } from "react";

type Step = { time: string; title: string; detail: string };
type Session = { title: string; steps: Step[] };

export default function Home() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Class 10");
  const [minutes, setMinutes] = useState("45");
  const [goal, setGoal] = useState("Understand the topic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);

  async function generateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSession(null);

    if (!topic.trim()) {
      setError("Tell us what you want to study first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/study-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), level, minutes: Number(minutes), goal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <nav className="navbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-name">StudyFlow</div>
        </div>
        <div className="nav-note">A focused session, not another endless study plan.</div>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">Your next study session</div>
          <h1>Stop planning.<br />Start learning.</h1>
          <p className="hero-copy">
            Tell StudyFlow <strong>what you&apos;re studying, how much time you have, and your goal.</strong>
            We&apos;ll turn that into a focused session designed around learning, practice, testing, and recall.
          </p>
        </div>

        <form className="planner-card" onSubmit={generateSession}>
          <h2 className="card-title">Build my session</h2>
          <p className="card-subtitle">Start with one topic. We&apos;ll handle the structure.</p>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="topic">What are you studying?</label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Electricity — Ohm&apos;s law"
                maxLength={200}
              />
            </div>

            <div className="field">
              <label htmlFor="level">Your level</label>
              <select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Class 8</option>
                <option>Class 9</option>
                <option>Class 10</option>
                <option>Class 11</option>
                <option>Class 12</option>
                <option>College</option>
                <option>Other</option>
              </select>
            </div>

            <div className="time-row">
              <div className="field">
                <label htmlFor="minutes">Time available</label>
                <select id="minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">90 minutes</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="goal">Main goal</label>
                <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
                  <option>Understand the topic</option>
                  <option>Prepare for a test</option>
                  <option>Practice problems</option>
                  <option>Revise quickly</option>
                </select>
              </div>
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Building your session…" : "Build my session →"}
            </button>

            {error && <div className="result-error" role="alert">{error}</div>}
          </div>
        </form>
      </section>

      <section className="proof-row" aria-label="How StudyFlow works">
        <div className="proof"><b>01 · Learn</b><span>Get the minimum concepts you need before practicing.</span></div>
        <div className="proof"><b>02 · Practice</b><span>Spend your limited time on targeted questions.</span></div>
        <div className="proof"><b>03 · Recall</b><span>Finish by checking whether the knowledge actually stuck.</span></div>
      </section>

      {session && (
        <section className="result-wrap">
          <div className="result-card">
            <div className="eyebrow">Your session</div>
            <h2>{session.title}</h2>
            <div className="session-list">
              {session.steps.map((step, index) => (
                <div className="session-step" key={`${step.title}-${index}`}>
                  <div className="step-time">{step.time}</div>
                  <div>
                    <div className="step-title">{step.title}</div>
                    <div className="step-detail">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="footer">StudyFlow MVP · Built to test whether focused AI study sessions are genuinely useful.</footer>
    </main>
  );
}
