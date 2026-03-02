"use client";

import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsPhone, isValidUsPhone } from "@/lib/phone";

interface OwnerPayload {
  id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
}

function TrackMyFixLogo() {
  return (
    <div className="tmf-logo" aria-hidden="true">
      <div className="tmf-logo-core">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="tmf-logo-wrench"
          role="img"
        >
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"
          />
        </svg>
      </div>
    </div>
  );
}

function LiveDemoPanel() {
  return (
    <div className="home-demo" aria-hidden="true">
      <div className="home-demo-head">
        <span className="home-demo-dot" />
        <span className="home-demo-dot" />
        <span className="home-demo-dot" />
      </div>
      <div className="home-demo-body">
        <p className="home-demo-kicker">Service Job 1</p>
        <div className="home-demo-sync-grid">
          <div className="home-demo-sync-card">
            <p className="home-demo-sync-title">Technician</p>
            <div className="home-demo-task-item demo-check-1">
              <span className="home-demo-checkbox">✓</span>
              <span className="home-demo-task-label">Pre-check complete</span>
            </div>
            <div className="home-demo-task-item demo-check-2">
              <span className="home-demo-checkbox">✓</span>
              <span className="home-demo-task-label">Install and test</span>
            </div>
            <div className="home-demo-task-item demo-check-3">
              <span className="home-demo-checkbox">✓</span>
              <span className="home-demo-task-label">Final cleanup</span>
            </div>
          </div>
          <div className="home-demo-sync-card">
            <p className="home-demo-sync-title">Customer</p>
            <p className="home-demo-sync-caption">Progress updates instantly</p>
            <div className="home-demo-progress">
              <div className="home-demo-progress-fill" />
            </div>
            <p className="home-demo-sync-count">
              <span className="count-0">0 of 3 tasks complete</span>
              <span className="count-1">1 of 3 tasks complete</span>
              <span className="count-2">2 of 3 tasks complete</span>
              <span className="count-3">3 of 3 tasks complete</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [lookupPending, setLookupPending] = useState(true);
  const [existingOwner, setExistingOwner] = useState<OwnerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setExistingOwner(null);
      setLookupPending(false);
      return;
    }

    let cancelled = false;

    async function lookupOwnerAccount(): Promise<void> {
      setLookupPending(true);
      setError(null);

      try {
        const response = await fetch("/api/owners/me");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load manager account.");
        }

        if (cancelled) {
          return;
        }

        const owner = (payload.owner ?? null) as OwnerPayload | null;
        setExistingOwner(owner);

        if (owner) {
          window.localStorage.setItem("trackmyfix-owner-id", owner.id);
        }
      } catch (lookupError) {
        if (cancelled) {
          return;
        }

        const message =
          lookupError instanceof Error
            ? lookupError.message
            : "Unable to load manager account.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLookupPending(false);
        }
      }
    }

    void lookupOwnerAccount();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (lookupPending || !existingOwner) {
      return;
    }

    router.replace(`/manager/${existingOwner.id}`);
  }, [lookupPending, existingOwner, router]);

  useEffect(() => {
    const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? "";
    if (signedInEmail && !email) {
      setEmail(signedInEmail);
    }
  }, [user, email]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(name && email && businessName && businessPhone) &&
      isValidUsPhone(businessPhone) &&
      !pending
    );
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
        throw new Error(payload.error ?? "Unable to complete account setup.");
      }

      const owner = payload.owner as OwnerPayload;
      window.localStorage.setItem("trackmyfix-owner-id", owner.id);
      // New account setup should continue into technician onboarding.
      router.push(`/manager/${owner.id}/account?onboarding=1`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete account setup.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-shell app-shell-home">
      <section className="card home-topbar">
        <p className="kicker" style={{ margin: 0 }}>Manager Access</p>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button type="button" className="btn btn-secondary">Sign In</button>
          </SignInButton>
        </SignedOut>
      </section>

      <section className="card home-hero">
        <div>
          <p className="kicker">TrackMyFix</p>
          <h1 className="home-title">Keep Every Service Job Visible In Real Time</h1>
          <p className="home-subtitle">
            Give managers, technicians, and customers a shared live view of job progress.
            Create jobs in seconds and reduce inbound status calls.
          </p>
          <div className="home-chip-row">
            <span className="home-chip">Live Progress</span>
            <span className="home-chip">Customer Links</span>
            <span className="home-chip">Technician Notes</span>
          </div>
        </div>
        <div className="home-visual-stack">
          <TrackMyFixLogo />
          <LiveDemoPanel />
        </div>
      </section>

      <section className="home-grid">
        <article className="card">
          <h2 className="section-heading">How It Works</h2>
          <div className="home-step-list">
            <p><strong>1.</strong> Manager creates a job and assigns a lead technician.</p>
            <p><strong>2.</strong> Technician checks off tasks from a mobile-friendly checklist.</p>
            <p><strong>3.</strong> Customer sees progress updates instantly from a private link.</p>
          </div>
        </article>

        <article className="card">
          <h2 className="section-heading">Built For Field Teams</h2>
          <div className="home-feature-list">
            <p>Large touch-friendly controls for technicians on mobile devices.</p>
            <p>Template-based tasklists for repeat jobs and faster setup.</p>
            <p>Manager dashboard with active jobs and completion visibility.</p>
          </div>
        </article>
      </section>

      <SignedIn>
        {lookupPending ? (
          <section className="card home-access">
            <h2 className="section-heading">Manager Access</h2>
            <p className="page-subtitle">Loading your account details...</p>
          </section>
        ) : existingOwner ? (
          <section className="card home-access">
            <h2 className="section-heading">Opening Your Dashboard</h2>
            <p className="page-subtitle">
              Welcome back. Redirecting you to {existingOwner.businessName}.
            </p>
          </section>
        ) : (
          <section className="card home-access">
            <h2 className="section-heading">Initial Account Setup</h2>
            <p className="page-subtitle">
              Start your manager workspace to create templates, jobs, and live status links.
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
                  onChange={(event) => setBusinessPhone(formatUsPhone(event.target.value))}
                  placeholder="(555) 555-5555"
                />
              </label>
              {businessPhone && !isValidUsPhone(businessPhone) ? (
                <p className="error">Enter a valid 10-digit phone number.</p>
              ) : null}

              <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                {pending ? "Setting Up..." : "Complete Setup"}
              </button>
            </form>
          </section>
        )}
      </SignedIn>

      <SignedOut>
        <section className="card home-access">
          <h2 className="section-heading">Start Free In Minutes</h2>
          <p className="page-subtitle">
            Create your manager account to launch your first live-tracked service job.
          </p>
          <SignInButton mode="modal">
            <button type="button" className="btn btn-primary" style={{ marginTop: "0.8rem", width: "100%" }}>
              Get Started
            </button>
          </SignInButton>
        </section>
      </SignedOut>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
