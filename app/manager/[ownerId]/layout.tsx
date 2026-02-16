"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface Owner {
  id: string;
  name: string;
  businessName: string;
  businessPhone: string;
}

interface ManagerLayoutProps {
  children: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href.endsWith("/jobs")) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ManagerOwnerLayout({ children }: ManagerLayoutProps) {
  const params = useParams<{ ownerId: string }>();
  const pathname = usePathname();
  const ownerId = params.ownerId;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navItems = useMemo(
    () => [
      { href: `/manager/${ownerId}/account`, label: "Account" },
      { href: `/manager/${ownerId}/templates`, label: "Templates" },
      { href: `/manager/${ownerId}/jobs/create`, label: "Create Job" },
      { href: `/manager/${ownerId}/jobs`, label: "Active Jobs" },
    ],
    [ownerId],
  );

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    async function loadOwner(): Promise<void> {
      if (!owner) {
        setLoadingOwner(true);
      }
      setError(null);

      try {
        const response = await fetch(`/api/owners/${ownerId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load manager dashboard.");
        }

        setOwner(payload.owner as Owner);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load manager dashboard.";
        setError(message);
      } finally {
        setLoadingOwner(false);
      }
    }

    void loadOwner();
  }, [ownerId, refreshKey]);

  useEffect(() => {
    const handler = () => {
      setRefreshKey((current) => current + 1);
    };

    window.addEventListener("trackmyfix:owner-updated", handler);
    return () => {
      window.removeEventListener("trackmyfix:owner-updated", handler);
    };
  }, []);

  if (loadingOwner) {
    return (
      <main className="app-shell">
        <section className="card">Loading manager dashboard...</section>
      </main>
    );
  }

  if (!owner) {
    return (
      <main className="app-shell">
        <section className="card">
          <h1 className="page-title">Owner Not Found</h1>
          <p className="page-subtitle">The dashboard URL is invalid or account no longer exists.</p>
          {error ? <p className="error" style={{ marginTop: "0.6rem" }}>{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem" }}>
          <div>
            <p className="kicker">Manager Dashboard</p>
            <h1 className="page-title">{owner.businessName}</h1>
            <p className="page-subtitle">
              {owner.name} · {owner.businessPhone}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </section>

      <section className="card manager-nav-wrap">
        <nav className="manager-nav" aria-label="Manager sections">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`manager-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      {children}
    </main>
  );
}
