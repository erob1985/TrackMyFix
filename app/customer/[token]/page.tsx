"use client";

import { useEffect, useMemo, useState } from "react";
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

interface JobSession {
  id: string;
  title: string;
  businessName: string;
  customerName: string;
  location: string;
  businessPhone: string;
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

function findInProgressTaskId(tasks: Task[]): string | null {
  const lastCompletedIndex = tasks.reduce(
    (latestIndex, task, index) => (task.completed ? index : latestIndex),
    -1,
  );

  if (lastCompletedIndex < 0) {
    return null;
  }

  const candidate = tasks[lastCompletedIndex + 1];
  if (!candidate || candidate.completed) {
    return null;
  }

  return candidate.id;
}

export default function CustomerJobPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [job, setJob] = useState<JobSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const inProgressTaskId = useMemo(() => {
    if (!job) {
      return null;
    }

    return findInProgressTaskId(job.tasks);
  }, [job]);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function loadJob(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/session/customer/${token}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load job.");
        }

        setJob(payload.job as JobSession);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load job.";
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
      `/api/events/${job.id}?role=customer&token=${encodeURIComponent(token)}`,
    );

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; job: JobSession };
        if (payload.job) {
          setJob(payload.job);
        }
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

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">Loading job status...</section>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="app-shell">
        <section className="card">
          <h1 className="page-title">Job Not Found</h1>
          <p className="page-subtitle">The customer link is invalid or expired.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header>
        <p className="kicker">Customer Job Status</p>
        <h1 className="page-title">{job.businessName || job.title}</h1>
        <p className="page-subtitle">{job.customerName || job.location}</p>
      </header>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 className="section-heading">Current Progress</h2>

        <div style={{ marginTop: "0.75rem" }}>
          <div className="progress-head">
            <span className="muted">Completion</span>
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

        <h3 className="section-heading">{job.title}</h3>
        <div className="tasks">
          {job.tasks.map((task) => {
            const status = task.completed
              ? "Complete"
              : task.id === inProgressTaskId
                ? "In Progress"
                : "Incomplete";

            return (
              <article className={`task-row ${task.completed ? "done" : ""}`} key={task.id}>
                <input type="checkbox" checked={task.completed} readOnly tabIndex={-1} />
                <span className="task-name">{task.name}</span>
                <span
                  className={`task-pill ${
                    status === "In Progress"
                      ? "is-in-progress"
                      : status === "Incomplete"
                        ? "is-incomplete"
                        : "is-complete"
                  }`}
                >
                  {status}
                </span>
              </article>
            );
          })}
        </div>

        <hr className="hr" />
        <details
          className="notes-log"
          open={notesExpanded}
          onToggle={(event) => {
            setNotesExpanded((event.currentTarget as HTMLDetailsElement).open);
          }}
        >
          <summary>
            Technician Notes ({job.noteEntries.length})
          </summary>
          <div className="notes-log-list">
            {job.noteEntries.length === 0 ? (
              <p className="page-subtitle">No technician notes yet.</p>
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

        <hr className="hr" />
        <p className="page-subtitle">Last updated: {formatUpdatedAt(job.updatedAt)}</p>
      </section>

      <section className="card">
        <h2 className="section-heading">Need Help?</h2>
        <p className="page-subtitle" style={{ marginTop: "0.45rem" }}>
          Tap to call the service team.
        </p>
        <a
          className="btn btn-primary"
          href={`tel:${job.businessPhone}`}
          style={{ marginTop: "0.8rem", display: "inline-block", width: "100%", textAlign: "center" }}
        >
          Call {job.businessPhone}
        </a>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
