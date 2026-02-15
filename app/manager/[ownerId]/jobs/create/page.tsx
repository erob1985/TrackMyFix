"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface Template {
  id: string;
  name: string;
  tasks: string[];
}

interface Technician {
  id: string;
  name: string;
}

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
  assignedTechnician: Technician | null;
}

export default function ManagerCreateJobPage() {
  const params = useParams<{ ownerId: string }>();
  const ownerId = params.ownerId;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [jobTitle, setJobTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [jobTaskDraft, setJobTaskDraft] = useState("");
  const [jobTasks, setJobTasks] = useState<string[]>([]);
  const [latestCreatedJob, setLatestCreatedJob] = useState<JobSummary | null>(null);

  const canCreateJob =
    jobTitle.trim().length > 0 &&
    customerName.trim().length > 0 &&
    location.trim().length > 0 &&
    selectedTechnicianId.trim().length > 0 &&
    jobTasks.length > 0;

  const origin = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.origin;
  }, []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    async function loadTemplates(): Promise<void> {
      setLoadingTemplates(true);
      setError(null);

      try {
        const [templateResponse, ownerResponse] = await Promise.all([
          fetch(`/api/templates?ownerId=${ownerId}`),
          fetch(`/api/owners/${ownerId}`),
        ]);
        const templatePayload = await templateResponse.json();
        const ownerPayload = await ownerResponse.json();

        if (!templateResponse.ok) {
          throw new Error(templatePayload.error ?? "Unable to load templates.");
        }
        if (!ownerResponse.ok) {
          throw new Error(ownerPayload.error ?? "Unable to load technicians.");
        }

        const loadedTechnicians = (ownerPayload.owner?.technicians ?? []) as Technician[];
        setTemplates((templatePayload.templates ?? []) as Template[]);
        setTechnicians(loadedTechnicians);
        setSelectedTechnicianId((current) =>
          current || loadedTechnicians[0]?.id || "",
        );
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load templates.";
        setError(message);
      } finally {
        setLoadingTemplates(false);
      }
    }

    void loadTemplates();
  }, [ownerId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    const template = templates.find((entry) => entry.id === selectedTemplateId);
    if (!template) {
      return;
    }

    setJobTasks(template.tasks);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (technicians.length === 0) {
      setSelectedTechnicianId("");
      return;
    }

    const exists = technicians.some(
      (technician) => technician.id === selectedTechnicianId,
    );
    if (!exists) {
      setSelectedTechnicianId(technicians[0].id);
    }
  }, [technicians, selectedTechnicianId]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(null);
    }, 1300);

    return () => window.clearTimeout(timer);
  }, [copied]);

  function addJobTask(): void {
    const value = jobTaskDraft.trim();
    if (!value) {
      return;
    }

    if (jobTasks.includes(value)) {
      setJobTaskDraft("");
      return;
    }

    setJobTasks((current) => [...current, value]);
    setJobTaskDraft("");
  }

  function clearJobForm(): void {
    setJobTitle("");
    setCustomerName("");
    setCustomerPhone("");
    setLocation("");
    setJobTasks([]);
    setJobTaskDraft("");
    setSelectedTemplateId("");
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateJob || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          title: jobTitle,
          customerName,
          customerPhone,
          location,
          assignedTechnicianId: selectedTechnicianId,
          tasks: jobTasks,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create job.");
      }

      const createdJob = payload.job as JobSummary;
      setLatestCreatedJob(createdJob);
      clearJobForm();
      setSuccess("Job created. Technician and customer links are ready.");
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "Unable to create job.";
      setError(message);
    } finally {
      setBusy(false);
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

  const techUrl = latestCreatedJob
    ? `${origin}/technician/${latestCreatedJob.technicianToken}`
    : "";
  const customerUrl = latestCreatedJob
    ? `${origin}/customer/${latestCreatedJob.customerToken}`
    : "";

  return (
    <section className="card manager-panel">
      <h2 className="section-heading">Create Job</h2>
      <p className="page-subtitle">Every new job generates a unique customer link and technician link.</p>

      <form className="form-grid" onSubmit={handleCreateJob} style={{ marginTop: "0.7rem" }}>
        {technicians.length === 0 ? (
          <p className="error">
            Add at least one technician in Account before creating jobs.
          </p>
        ) : null}

        <div className="grid-two">
          <label>
            Job Title
            <input
              className="field"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Brake Repair"
            />
          </label>

          <label>
            Location
            <input
              className="field"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Service Bay 1"
            />
          </label>
        </div>

        <label>
          Lead Technician
          <select
            value={selectedTechnicianId}
            onChange={(event) => setSelectedTechnicianId(event.target.value)}
            disabled={technicians.length === 0}
          >
            {technicians.length === 0 ? (
              <option value="">No technicians available</option>
            ) : null}
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-two">
          <label>
            Customer Name
            <input
              className="field"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="John Smith"
            />
          </label>

          <label>
            Customer Phone (optional)
            <input
              className="field"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="555-555-5555"
            />
          </label>
        </div>

        <label>
          Load Job Tasklist Template (optional)
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
          >
            <option value="">Start from blank</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Add Job Task
          <div className="btn-row">
            <input
              className="field"
              value={jobTaskDraft}
              onChange={(event) => setJobTaskDraft(event.target.value)}
              placeholder="Example: Run Diagnostics"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addJobTask();
                }
              }}
            />
            <button className="btn btn-secondary" type="button" onClick={addJobTask}>
              Add
            </button>
          </div>
        </label>

        {jobTasks.length > 0 ? (
          <div className="list-inline">
            {jobTasks.map((task) => (
              <span className="chip" key={task}>
                {task}
                <button
                  type="button"
                  onClick={() => setJobTasks((current) => current.filter((item) => item !== task))}
                  aria-label={`Remove ${task}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="btn-row">
          <button className="btn btn-secondary" type="button" onClick={clearJobForm} disabled={busy}>
            Clear Form
          </button>
          <button className="btn btn-primary" type="submit" disabled={!canCreateJob || busy}>
            Create Job
          </button>
        </div>
      </form>

      {loadingTemplates ? (
        <p className="page-subtitle" style={{ marginTop: "0.8rem" }}>
          Loading templates...
        </p>
      ) : null}

      {latestCreatedJob ? (
        <section className="card-muted" style={{ marginTop: "1rem" }}>
          <strong>Latest Created Job</strong>
          <p className="page-subtitle" style={{ marginTop: "0.35rem" }}>
            {latestCreatedJob.title} · {latestCreatedJob.customerName}
          </p>
          <p className="page-subtitle" style={{ marginTop: "0.25rem" }}>
            Lead Technician: {latestCreatedJob.assignedTechnician?.name ?? "Unassigned"}
          </p>

          <div style={{ marginTop: "0.7rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Technician Link</strong>
            <a className="job-link" href={techUrl} target="_blank" rel="noreferrer">
              {techUrl}
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copyText(techUrl, "tech")}
            >
              {copied === "tech" ? "Copied" : "Copy Technician Link"}
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
              onClick={() => void copyText(customerUrl, "customer")}
            >
              {copied === "customer" ? "Copied" : "Copy Customer Link"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: "0.8rem" }}>{success}</p> : null}
    </section>
  );
}
