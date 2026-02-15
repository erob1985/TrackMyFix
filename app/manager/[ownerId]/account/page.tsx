"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Owner {
  id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
  technicians: Technician[];
}

interface Technician {
  id: string;
  name: string;
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `tech-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ManagerAccountPage() {
  const params = useParams<{ ownerId: string }>();
  const router = useRouter();
  const ownerId = params.ownerId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techNameDraft, setTechNameDraft] = useState("");
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);

  const canSave = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      businessName.trim().length > 0 &&
      businessPhone.trim().length > 0 &&
      !saving &&
      !deleting
    );
  }, [name, email, businessName, businessPhone, saving, deleting]);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    async function loadOwner(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/owners/${ownerId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load account profile.");
        }

        const owner = payload.owner as Owner;
        setName(owner.name);
        setEmail(owner.email);
        setBusinessName(owner.businessName);
        setBusinessPhone(owner.businessPhone);
        setTechnicians(
          (owner.technicians ?? []).map((technician) => ({
            id: technician.id,
            name: technician.name,
          })),
        );
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load account profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadOwner();
  }, [ownerId]);

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/owners/${ownerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          businessName,
          businessPhone,
          technicians,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update account profile.");
      }

      const owner = payload.owner as Owner;
      setName(owner.name);
      setEmail(owner.email);
      setBusinessName(owner.businessName);
      setBusinessPhone(owner.businessPhone);
      setTechnicians(
        (owner.technicians ?? []).map((technician) => ({
          id: technician.id,
          name: technician.name,
        })),
      );
      setSuccess("Account profile updated.");

      window.dispatchEvent(new Event("trackmyfix:owner-updated"));
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update account profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function addTechnician(): void {
    const nameValue = techNameDraft.trim();

    if (!nameValue) {
      return;
    }

    setTechnicians((current) => [
      ...current,
      {
        id: createLocalId(),
        name: nameValue,
      },
    ]);
    setTechNameDraft("");
  }

  function updateTechnicianName(technicianId: string, value: string): void {
    setTechnicians((current) =>
      current.map((technician) =>
        technician.id === technicianId
          ? {
              ...technician,
              name: value,
            }
          : technician,
      ),
    );
  }

  function removeTechnician(technicianId: string): void {
    setTechnicians((current) =>
      current.filter((technician) => technician.id !== technicianId),
    );
  }

  async function handleDeleteAccount(): Promise<void> {
    if (saving || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete account "${businessName}"? This permanently removes your account, templates, jobs, and all technician/customer links.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/owners/${ownerId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete account.");
      }

      const savedOwnerId = window.localStorage.getItem("trackmyfix-owner-id");
      if (savedOwnerId === ownerId) {
        window.localStorage.removeItem("trackmyfix-owner-id");
      }

      router.replace("/");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete account.";
      setError(message);
      setDeleting(false);
    }
  }

  return (
    <section className="card manager-panel">
      <h2 className="section-heading">Account Settings</h2>
      <p className="page-subtitle">
        Update your manager profile and business contact details.
      </p>

      {loading ? (
        <p className="page-subtitle" style={{ marginTop: "0.8rem" }}>
          Loading account profile...
        </p>
      ) : (
        <form className="form-grid" style={{ marginTop: "0.8rem" }} onSubmit={handleSave}>
          <section className="card-muted manager-collapsible">
            <button
              type="button"
              className="manager-collapsible-toggle"
              onClick={() => setProfileExpanded((current) => !current)}
              aria-expanded={profileExpanded}
            >
              <h3 className="section-heading">Profile Details</h3>
              <span className={`manager-collapsible-icon${profileExpanded ? " open" : ""}`}>
                v
              </span>
            </button>

            {profileExpanded ? (
              <div className="manager-collapsible-body">
                <label>
                  Manager Name
                  <input
                    className="field"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
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
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="card-muted manager-collapsible">
            <button
              type="button"
              className="manager-collapsible-toggle"
              onClick={() => setRosterExpanded((current) => !current)}
              aria-expanded={rosterExpanded}
            >
              <h3 className="section-heading">Technician Roster</h3>
              <span className={`manager-collapsible-icon${rosterExpanded ? " open" : ""}`}>
                v
              </span>
            </button>

            {rosterExpanded ? (
              <div className="manager-collapsible-body">
                <p className="page-subtitle">
                  Adding technicians here will enable you to assign resources when creating new jobs.
                </p>

                <div style={{ marginTop: "0.7rem" }}>
                  <input
                    className="field"
                    placeholder="Technician name"
                    value={techNameDraft}
                    onChange={(event) => setTechNameDraft(event.target.value)}
                  />
                </div>

                <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addTechnician}
                  >
                    Add Technician
                  </button>
                </div>

                {technicians.length === 0 ? (
                  <p className="page-subtitle" style={{ marginTop: "0.7rem" }}>
                    No technicians added yet.
                  </p>
                ) : (
                  <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.55rem" }}>
                    {technicians.map((technician) => (
                      <article className="card-muted" key={technician.id}>
                        <div>
                          <input
                            className="field"
                            value={technician.name}
                            onChange={(event) =>
                              updateTechnicianName(technician.id, event.target.value)
                            }
                            placeholder="Technician name"
                          />
                        </div>
                        <div style={{ marginTop: "0.55rem" }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => removeTechnician(technician.id)}
                          >
                            Remove Technician
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <button className="btn btn-primary" type="submit" disabled={!canSave}>
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <section className="card-muted manager-collapsible">
            <button
              type="button"
              className="manager-collapsible-toggle"
              onClick={() => setDangerExpanded((current) => !current)}
              aria-expanded={dangerExpanded}
            >
              <h3 className="section-heading">Danger Zone</h3>
              <span className={`manager-collapsible-icon${dangerExpanded ? " open" : ""}`}>
                v
              </span>
            </button>

            {dangerExpanded ? (
              <div className="manager-collapsible-body">
                <p className="page-subtitle">
                  Permanently delete this manager account and all associated data.
                </p>
                <div style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleDeleteAccount()}
                    disabled={saving || deleting}
                  >
                    {deleting ? "Deleting Account..." : "Delete Account"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </form>
      )}

      {error ? <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: "0.8rem" }}>{success}</p> : null}
    </section>
  );
}
