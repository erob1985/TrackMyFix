"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface Task {
  id: string;
  name: string;
  completed: boolean;
}

interface JobNoteEntry {
  id: string;
  authorName: string;
  authorTechnicianId?: string;
  message: string;
  createdAt: string;
}

interface AssignedTechnician {
  id: string;
  name: string;
  phone?: string;
}

interface JobSession {
  id: string;
  title: string;
  businessName: string;
  customerName: string;
  location: string;
  businessPhone: string;
  assignedTechnician: AssignedTechnician | null;
  noteEntries: JobNoteEntry[];
  tasks: Task[];
  updatedAt: string;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  allCompleted: boolean;
}

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleString();
}

function findNewlyCompletedTaskIds(
  previous: JobSession | null,
  next: JobSession,
): string[] {
  if (!previous) {
    return [];
  }

  const previousById = new Map(
    previous.tasks.map((task) => [task.id, task.completed] as const),
  );

  return next.tasks
    .filter((task) => task.completed && !previousById.get(task.id))
    .map((task) => task.id);
}

export default function TechnicianJobPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [job, setJob] = useState<JobSession | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [animatedTaskIds, setAnimatedTaskIds] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);

  const jobRef = useRef<JobSession | null>(null);
  const taskAnimationTimersRef = useRef<Record<string, number>>({});
  const celebrationTimerRef = useRef<number | null>(null);
  const completionInitializedRef = useRef(false);
  const wasAllCompletedRef = useRef(false);

  const allCompleted = useMemo(() => {
    return job?.allCompleted ?? false;
  }, [job]);

  const confettiPalette = useMemo(
    () => ["#34d399", "#38bdf8", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee"],
    [],
  );

  function triggerTaskAnimations(taskIds: string[]): void {
    if (taskIds.length === 0) {
      return;
    }

    setAnimatedTaskIds((current) => [...new Set([...current, ...taskIds])]);

    for (const taskId of taskIds) {
      const existingTimer = taskAnimationTimersRef.current[taskId];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      taskAnimationTimersRef.current[taskId] = window.setTimeout(() => {
        setAnimatedTaskIds((current) => current.filter((id) => id !== taskId));
        delete taskAnimationTimersRef.current[taskId];
      }, 760);
    }
  }

  function applyJobUpdate(nextJob: JobSession): void {
    const newlyCompletedIds = findNewlyCompletedTaskIds(jobRef.current, nextJob);
    jobRef.current = nextJob;
    setJob(nextJob);
    triggerTaskAnimations(newlyCompletedIds);
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadJob(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/session/technician/${token}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load job.");
        }

        const session = payload.job as JobSession;
        jobRef.current = session;
        setJob(session);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load technician view.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadJob();
  }, [token]);

  useEffect(() => {
    if (!job?.id || !token) {
      return;
    }

    const source = new EventSource(
      `/api/events/${job.id}?role=technician&token=${encodeURIComponent(token)}`,
    );

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; job: JobSession };
        if (!payload.job) {
          return;
        }

        applyJobUpdate(payload.job);
      } catch {
        // no-op
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [job?.id, token]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatus(null);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!job) {
      return;
    }

    if (!completionInitializedRef.current) {
      completionInitializedRef.current = true;
      wasAllCompletedRef.current = job.allCompleted;
      return;
    }

    if (job.allCompleted && !wasAllCompletedRef.current) {
      wasAllCompletedRef.current = true;
      setShowCelebration(true);
      setCelebrationKey((current) => current + 1);
      setStatus("Excellent work. Job complete.");

      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current);
      }

      celebrationTimerRef.current = window.setTimeout(() => {
        setShowCelebration(false);
      }, 3200);
      return;
    }

    if (!job.allCompleted) {
      wasAllCompletedRef.current = false;
      setShowCelebration(false);
    }
  }, [job]);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    return () => {
      for (const timerId of Object.values(taskAnimationTimersRef.current)) {
        window.clearTimeout(timerId);
      }

      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  async function toggleTask(taskId: string): Promise<void> {
    try {
      const response = await fetch(`/api/session/technician/${token}/task`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update task.");
      }

      const nextJob = payload.job as JobSession;
      applyJobUpdate(nextJob);
      setStatus("Task updated");
      setError(null);
    } catch (toggleError) {
      const message =
        toggleError instanceof Error ? toggleError.message : "Unable to update task.";
      setError(message);
    }
  }

  async function toggleAllTasks(): Promise<void> {
    if (!job) {
      return;
    }

    try {
      const response = await fetch(`/api/session/technician/${token}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !job.allCompleted }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update all tasks.");
      }

      const nextJob = payload.job as JobSession;
      applyJobUpdate(nextJob);
      setStatus(payload.job.allCompleted ? "All tasks complete" : "All tasks reset");
      setError(null);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Unable to update all tasks.";
      setError(message);
    }
  }

  async function saveNotes(): Promise<void> {
    if (!noteDraft.trim()) {
      setStatus("Enter a note before saving.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/session/technician/${token}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteDraft }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save notes.");
      }

      applyJobUpdate(payload.job as JobSession);
      setNoteDraft("");
      setNotesExpanded(true);
      setStatus("Note added to log.");
      setError(null);
    } catch (notesError) {
      const message = notesError instanceof Error ? notesError.message : "Unable to save notes.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">Loading technician view...</section>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="app-shell">
        <section className="card">
          <h1 className="page-title">Job Not Found</h1>
          <p className="page-subtitle">The technician link is invalid or expired.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header>
        <p className="kicker">Technician View</p>
        <h1 className="page-title">
          Hi, {job.assignedTechnician?.name ?? "Technician"}
        </h1>
        <p className="page-subtitle">{job.businessName || job.title}</p>
      </header>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 className="section-heading">
          {job.title} · {job.location}
        </h2>
        <p className="page-subtitle" style={{ marginTop: "0.35rem" }}>
          Customer: {job.customerName}
        </p>

        <div style={{ marginTop: "0.95rem" }}>
          <div className="progress-head">
            <span className="muted">Progress</span>
            <strong style={{ color: "#34d399" }}>{job.progressPercent}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${job.progressPercent}%` }} />
          </div>
          <p className="page-subtitle" style={{ marginTop: "0.45rem" }}>
            {job.completedTasks} of {job.totalTasks} tasks complete
          </p>
        </div>

        <hr className="hr" />

        <h3 className="section-heading">Task Checklist</h3>
        <div className="tasks">
          {job.tasks.map((task) => (
            <label
              key={task.id}
              className={`task-row ${task.completed ? "done" : ""} ${
                animatedTaskIds.includes(task.id) ? "just-completed" : ""
              }`}
              htmlFor={`task-${task.id}`}
            >
              <input
                id={`task-${task.id}`}
                type="checkbox"
                checked={task.completed}
                onChange={() => void toggleTask(task.id)}
              />
              <span className="task-name">{task.name}</span>
              <span
                className={`task-pill ${animatedTaskIds.includes(task.id) ? "pop" : ""}`}
              >
                {task.completed ? "Done" : "Pending"}
              </span>
            </label>
          ))}
        </div>

        <hr className="hr" />

        <h3 className="section-heading">Job Notes</h3>
        <textarea
          value={noteDraft}
          onChange={(event) => {
            setNoteDraft(event.target.value);
          }}
          placeholder="Share a note with your customer..."
          style={{ marginTop: "0.7rem" }}
        />

        <button
          className="btn btn-secondary"
          type="button"
          style={{ marginTop: "0.65rem", width: "100%" }}
          onClick={() => void saveNotes()}
          disabled={saving}
        >
          {saving ? "Saving..." : "Add Note"}
        </button>

        <details
          className="notes-log"
          open={notesExpanded}
          onToggle={(event) => {
            setNotesExpanded((event.currentTarget as HTMLDetailsElement).open);
          }}
          style={{ marginTop: "0.8rem" }}
        >
          <summary>
            Technician Note History ({job.noteEntries.length})
          </summary>
          <div className="notes-log-list">
            {job.noteEntries.length === 0 ? (
              <p className="page-subtitle">No notes logged yet.</p>
            ) : (
              job.noteEntries.map((entry) => (
                <article className="note-item" key={entry.id}>
                  <p className="note-time">
                    {entry.authorName} · {formatUpdatedAt(entry.createdAt)}
                  </p>
                  <p className="note-message">{entry.message}</p>
                </article>
              ))
            )}
          </div>
        </details>

        <p className="page-subtitle" style={{ marginTop: "0.6rem" }}>
          Last updated: {formatUpdatedAt(job.updatedAt)}
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="success">{status}</p> : null}
      {showCelebration ? (
        <div className="celebration-overlay" role="status" aria-live="polite">
          <div className="celebration-dialog" key={celebrationKey}>
            <div className="celebration-confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    left: `${8 + (index % 8) * 11}%`,
                    animationDelay: `${(index % 8) * 0.08}s`,
                    background: confettiPalette[index % confettiPalette.length],
                  }}
                />
              ))}
            </div>
            <p className="kicker">Excellent Work</p>
            <h3>All Tasks Complete</h3>
            <p>Great job. This service checklist is fully done.</p>
          </div>
        </div>
      ) : null}

      <footer className="bottom-bar">
        <div className="bottom-inner">
          <button className="btn btn-primary" type="button" onClick={() => void toggleAllTasks()}>
            {allCompleted ? "Mark None Completed" : "Mark All Completed"}
          </button>
        </div>
      </footer>
    </main>
  );
}
