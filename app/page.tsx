"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface OwnerPayload {
  id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [existingOwnerId, setExistingOwnerId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("trackmyfix-owner-id");
    if (saved) {
      setExistingOwnerId(saved);
    }
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(name && email && businessName && businessPhone) && !pending;
  }, [name, email, businessName, businessPhone, pending]);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, businessName, businessPhone }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create account.");
      }

      const owner = payload.owner as OwnerPayload;
      window.localStorage.setItem("trackmyfix-owner-id", owner.id);
      router.push(`/manager/${owner.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to create account.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function handleOpenDashboard(): void {
    if (!existingOwnerId.trim()) {
      setError("Enter your manager ID first.");
      return;
    }

    window.localStorage.setItem("trackmyfix-owner-id", existingOwnerId.trim());
    router.push(`/manager/${existingOwnerId.trim()}`);
  }

  return (
    <main className="app-shell">
      <section className="card">
        <p className="kicker">TrackMyFix</p>
        <h1 className="page-title">Service Job Tracking</h1>
        <p className="page-subtitle">
          Create jobs, send unique customer/technician links, and keep everyone synced in
          real time.
        </p>
      </section>

      <section className="card">
        <h2 className="section-heading">Create Business Account</h2>
        <p className="page-subtitle">
          This account is the manager dashboard for templates and jobs.
        </p>
        <form className="form-grid" onSubmit={handleSignup}>
          <label>
            Manager Name
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label>
            Manager Email
            <input
              className="field"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Business Name
            <input
              className="field"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </label>

          <label>
            Business Phone
            <input
              className="field"
              value={businessPhone}
              onChange={(event) => setBusinessPhone(event.target.value)}
              placeholder="(555) 555-5555"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {pending ? "Creating..." : "Create Account"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="section-heading">Open Existing Dashboard</h2>
        <p className="page-subtitle">Use your saved manager ID to continue.</p>
        <div className="btn-row" style={{ marginTop: "0.7rem" }}>
          <input
            className="field"
            value={existingOwnerId}
            onChange={(event) => setExistingOwnerId(event.target.value)}
            placeholder="Manager ID"
          />
          <button className="btn btn-secondary" type="button" onClick={handleOpenDashboard}>
            Open
          </button>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
