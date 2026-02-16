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
    <main className="app-shell">
      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

      <section className="card">
        <p className="kicker">TrackMyFix</p>
        <h1 className="page-title">Service Job Tracking</h1>
        <p className="page-subtitle">
          Create jobs, send unique customer/technician links, and keep everyone synced in
          real time.
        </p>
      </section>

      <SignedIn>
        {lookupPending ? (
          <section className="card">
            <h2 className="section-heading">Manager Access</h2>
            <p className="page-subtitle">Loading your account details...</p>
          </section>
        ) : existingOwner ? (
          <section className="card">
            <h2 className="section-heading">Opening Your Dashboard</h2>
            <p className="page-subtitle">
              Welcome back. Redirecting you to {existingOwner.businessName}.
            </p>
          </section>
        ) : (
          <section className="card">
            <h2 className="section-heading">Initial Account Setup</h2>
            <p className="page-subtitle">
              Set up your manager dashboard for templates and jobs.
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
        <section className="card">
          <h2 className="section-heading">Sign In Required</h2>
          <p className="page-subtitle">
            Sign in to create and manage your TrackMyFix manager dashboard.
          </p>
        </section>
      </SignedOut>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
