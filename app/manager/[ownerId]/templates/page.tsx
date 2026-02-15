"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Template {
  id: string;
  name: string;
  tasks: string[];
}

export default function ManagerTemplatesPage() {
  const params = useParams<{ ownerId: string }>();
  const ownerId = params.ownerId;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [templateTaskDraft, setTemplateTaskDraft] = useState("");
  const [templateTasks, setTemplateTasks] = useState<string[]>([]);
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<string[]>([]);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateTaskDraft, setEditTemplateTaskDraft] = useState("");
  const [editTemplateTasks, setEditTemplateTasks] = useState<string[]>([]);

  const canSaveTemplate = templateName.trim().length > 0 && templateTasks.length > 0;
  const canSaveEditedTemplate =
    Boolean(editingTemplateId) &&
    editTemplateName.trim().length > 0 &&
    editTemplateTasks.length > 0;

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    async function loadTemplates(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/templates?ownerId=${ownerId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load templates.");
        }

        setTemplates((payload.templates ?? []) as Template[]);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load templates.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadTemplates();
  }, [ownerId]);

  function addTemplateTask(): void {
    const value = templateTaskDraft.trim();
    if (!value) {
      return;
    }

    if (templateTasks.includes(value)) {
      setTemplateTaskDraft("");
      return;
    }

    setTemplateTasks((current) => [...current, value]);
    setTemplateTaskDraft("");
  }

  function addEditTemplateTask(): void {
    const value = editTemplateTaskDraft.trim();
    if (!value) {
      return;
    }

    if (editTemplateTasks.includes(value)) {
      setEditTemplateTaskDraft("");
      return;
    }

    setEditTemplateTasks((current) => [...current, value]);
    setEditTemplateTaskDraft("");
  }

  function startEditingTemplate(template: Template): void {
    setEditingTemplateId(template.id);
    setEditTemplateName(template.name);
    setEditTemplateTasks(template.tasks);
    setEditTemplateTaskDraft("");
    setExpandedTemplateIds((current) =>
      current.includes(template.id) ? current : [...current, template.id],
    );
    setError(null);
    setSuccess(null);
  }

  function cancelEditingTemplate(): void {
    setEditingTemplateId(null);
    setEditTemplateName("");
    setEditTemplateTasks([]);
    setEditTemplateTaskDraft("");
  }

  async function handleSaveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveTemplate || creating) {
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, name: templateName, tasks: templateTasks }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save template.");
      }

      setTemplates((current) => [payload.template as Template, ...current]);
      setTemplateName("");
      setTemplateTasks([]);
      setTemplateTaskDraft("");
      setSuccess("Template saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save template.";
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateTemplate(templateId: string): Promise<void> {
    if (!canSaveEditedTemplate || savingTemplateId) {
      return;
    }

    setSavingTemplateId(templateId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          name: editTemplateName,
          tasks: editTemplateTasks,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update template.");
      }

      const updated = payload.template as Template;
      setTemplates((current) =>
        current.map((template) =>
          template.id === updated.id ? updated : template,
        ),
      );
      cancelEditingTemplate();
      setSuccess("Template updated.");
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Unable to update template.";
      setError(message);
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function handleDeleteTemplate(template: Template): Promise<void> {
    if (deletingTemplateId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete template "${template.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(template.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/templates/${template.id}?ownerId=${ownerId}`,
        { method: "DELETE" },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete template.");
      }

      setTemplates((current) =>
        current.filter((candidate) => candidate.id !== template.id),
      );
      setExpandedTemplateIds((current) =>
        current.filter((candidate) => candidate !== template.id),
      );
      if (editingTemplateId === template.id) {
        cancelEditingTemplate();
      }
      setSuccess("Template deleted.");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unable to delete template.";
      setError(message);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  function isTemplateExpanded(templateId: string): boolean {
    return expandedTemplateIds.includes(templateId);
  }

  function toggleTemplateExpanded(templateId: string): void {
    setExpandedTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((candidate) => candidate !== templateId)
        : [...current, templateId],
    );
  }

  return (
    <section className="card manager-panel">
      <h2 className="section-heading">Task Templates</h2>
      <p className="page-subtitle">
        Save repeatable job tasklists so new jobs can be created in seconds.
      </p>

      <form className="form-grid" onSubmit={handleSaveTemplate} style={{ marginTop: "0.7rem" }}>
        <label>
          Tasklist Template Name
          <input
            className="field"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Example: Full Brake Service"
          />
        </label>

        <label>
          Task Name
          <div className="btn-row">
            <input
              className="field"
              value={templateTaskDraft}
              onChange={(event) => setTemplateTaskDraft(event.target.value)}
              placeholder="Add template task"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTemplateTask();
                }
              }}
            />
            <button className="btn btn-secondary" type="button" onClick={addTemplateTask}>
              Add
            </button>
          </div>
        </label>

        {templateTasks.length > 0 ? (
          <div className="list-inline">
            {templateTasks.map((task) => (
              <span className="chip" key={task}>
                {task}
                <button
                  type="button"
                  onClick={() =>
                    setTemplateTasks((current) => current.filter((value) => value !== task))
                  }
                  aria-label={`Remove ${task}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={!canSaveTemplate || creating}>
          {creating ? "Saving..." : "Save Template"}
        </button>
      </form>

      {loading ? (
        <p className="page-subtitle" style={{ marginTop: "1rem" }}>
          Loading templates...
        </p>
      ) : null}

      {templates.length > 0 ? (
        <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
          {templates.map((template) => {
            const isEditing = editingTemplateId === template.id;
            const isExpanded = isEditing || isTemplateExpanded(template.id);

            return (
              <div
                className={`card-muted${isEditing ? "" : " manager-collapsible"}`}
                key={template.id}
              >
                {isEditing ? (
                  <div style={{ display: "grid", gap: "0.65rem" }}>
                    <label>
                      Tasklist Template Name
                      <input
                        className="field"
                        value={editTemplateName}
                        onChange={(event) => setEditTemplateName(event.target.value)}
                      />
                    </label>

                    <label>
                      Task Name
                      <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                        <input
                          className="field"
                          value={editTemplateTaskDraft}
                          onChange={(event) => setEditTemplateTaskDraft(event.target.value)}
                          placeholder="Add template task"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addEditTemplateTask();
                            }
                          }}
                        />
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={addEditTemplateTask}
                        >
                          Add
                        </button>
                      </div>
                    </label>

                    {editTemplateTasks.length > 0 ? (
                      <div className="list-inline">
                        {editTemplateTasks.map((task) => (
                          <span className="chip" key={task}>
                            {task}
                            <button
                              type="button"
                              onClick={() =>
                                setEditTemplateTasks((current) =>
                                  current.filter((value) => value !== task),
                                )
                              }
                              aria-label={`Remove ${task}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="btn-row" style={{ marginTop: "0.6rem" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void handleUpdateTemplate(template.id)}
                        disabled={
                          !canSaveEditedTemplate ||
                          savingTemplateId === template.id ||
                          deletingTemplateId === template.id
                        }
                      >
                        {savingTemplateId === template.id ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={cancelEditingTemplate}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => void handleDeleteTemplate(template)}
                        disabled={deletingTemplateId === template.id}
                      >
                        {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="manager-collapsible-toggle"
                      onClick={() => toggleTemplateExpanded(template.id)}
                      aria-expanded={isExpanded}
                    >
                      <div>
                        <strong>{template.name}</strong>
                        <p className="page-subtitle" style={{ marginTop: "0.2rem" }}>
                          {template.tasks.length} task{template.tasks.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className={`manager-collapsible-icon${isExpanded ? " open" : ""}`}>
                        v
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="manager-collapsible-body">
                        <div className="list-inline">
                          {template.tasks.map((task) => (
                            <span className="chip" key={task}>
                              {task}
                            </span>
                          ))}
                        </div>
                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => startEditingTemplate(template)}
                          >
                            Edit Template
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => void handleDeleteTemplate(template)}
                            disabled={deletingTemplateId === template.id}
                          >
                            {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : !loading ? (
        <p className="page-subtitle" style={{ marginTop: "1rem" }}>
          No templates yet.
        </p>
      ) : null}

      {error ? <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
      {success ? <p className="success" style={{ marginTop: "0.8rem" }}>{success}</p> : null}
    </section>
  );
}
