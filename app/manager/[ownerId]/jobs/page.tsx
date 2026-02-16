"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface JobSummary {
  id: string;
  title: string;
  customerName: string;
  location: string;
  updatedAt: string;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  technicianToken: string;
  customerToken: string;
  assignedTechnician: {
    id: string;
    name: string;
    phone?: string;
  } | null;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return date.toLocaleString();
}

export default function ManagerActiveJobsPage() {
  const params = useParams<{ ownerId: string }>();
  const ownerId = params.ownerId;

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const refreshTimerRef = useRef<number | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.origin;
  }, []);

  const loadJobs = useCallback(
    async (silent = false): Promise<void> => {
      if (!ownerId) {
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(`/api/jobs?ownerId=${ownerId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load jobs.");
        }

        setJobs((payload.jobs ?? []) as JobSummary[]);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load jobs.";
        setError(message);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [ownerId],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const source = new EventSource(`/api/events/owner/${ownerId}`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type !== "owner.updated") {
          return;
        }

        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = window.setTimeout(() => {
          void loadJobs(true);
        }, 150);
      } catch {
        // no-op
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [ownerId, loadJobs]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(null);
    }, 1300);

    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleDeleteJob(jobId: string, title: string): Promise<void> {
    if (deletingJobId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete job "${title}"? This removes the job and its customer/technician links.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingJobId(jobId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}?ownerId=${ownerId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete job.");
      }

      setJobs((current) => current.filter((job) => job.id !== jobId));
      setExpandedJobIds((current) =>
        current.filter((candidate) => candidate !== jobId),
      );
      setSuccess("Job deleted.");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete job.";
      setError(message);
    } finally {
      setDeletingJobId(null);
    }
  }

  async function copyText(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setError("Clipboard permission blocked. Copy link manually.");
    }
  }

  function isJobExpanded(jobId: string): boolean {
    return expandedJobIds.includes(jobId);
  }

  function toggleJobExpanded(jobId: string): void {
    setExpandedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((candidate) => candidate !== jobId)
        : [...current, jobId],
    );
  }

  return (
    <section className="card manager-panel">
      <h2 className="section-heading">Active Jobs</h2>

      {loading ? (
        <p className="page-subtitle" style={{ marginTop: "0.7rem" }}>
          Loading jobs...
        </p>
      ) : null}

      {!loading && jobs.length === 0 ? (
        <p className="page-subtitle" style={{ marginTop: "0.7rem" }}>
          No jobs yet.
        </p>
      ) : (
        <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.7rem" }}>
          {jobs.map((job) => {
            const techUrl = `${origin}/technician/${job.technicianToken}`;
            const customerUrl = `${origin}/customer/${job.customerToken}`;
            const isExpanded = isJobExpanded(job.id);

            return (
              <article className="card-muted manager-collapsible" key={job.id}>
                <button
                  type="button"
                  className="manager-collapsible-toggle"
                  style={{ alignItems: "flex-start" }}
                  onClick={() => toggleJobExpanded(job.id)}
                  aria-expanded={isExpanded}
                >
                  <div style={{ width: "100%" }}>
                    <strong>{job.title}</strong>
                    <p className="page-subtitle" style={{ marginTop: "0.35rem" }}>
                      {job.customerName}
                    </p>
                    <div className="progress-head" style={{ marginTop: "0.6rem" }}>
                      <span className="muted">Progress</span>
                      <strong style={{ color: "#34d399" }}>{job.progressPercent}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${job.progressPercent}%` }} />
                    </div>
                  </div>
                  <span className={`manager-collapsible-icon${isExpanded ? " open" : ""}`}>
                    v
                  </span>
                </button>

                {isExpanded ? (
                  <div className="manager-collapsible-body">
                    <p className="page-subtitle">
                      {job.location}
                    </p>
                    <p className="page-subtitle" style={{ marginTop: "0.2rem" }}>
                      Lead Technician: {job.assignedTechnician?.name ?? "Unassigned"}
                    </p>
                    <p className="page-subtitle" style={{ marginTop: "0.2rem" }}>
                      {job.completedTasks} of {job.totalTasks} tasks complete · Updated {formatUpdatedAt(job.updatedAt)}
                    </p>

                    <hr className="hr" style={{ margin: "0.2rem 0" }} />

                    <div>
                      <strong style={{ fontSize: "0.9rem" }}>Technician Link</strong>
                      <a className="job-link" href={techUrl} target="_blank" rel="noreferrer">
                        {techUrl}
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void copyText(techUrl, `${job.id}:tech`)}
                      >
                        {copied === `${job.id}:tech` ? "Copied" : "Copy Technician Link"}
                      </button>
                    </div>

                    <div style={{ marginTop: "0.75rem" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Customer Link</strong>
                      <a className="job-link" href={customerUrl} target="_blank" rel="noreferrer">
                        {customerUrl}
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void copyText(customerUrl, `${job.id}:customer`)}
                      >
                        {copied === `${job.id}:customer` ? "Copied" : "Copy Customer Link"}
                      </button>
                    </div>

                    <div style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void handleDeleteJob(job.id, job.title)}
                        disabled={deletingJobId === job.id}
                      >
                        {deletingJobId === job.id ? "Deleting..." : "Delete Job"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {error ? <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: "0.8rem" }}>{success}</p> : null}
    </section>
  );
}
