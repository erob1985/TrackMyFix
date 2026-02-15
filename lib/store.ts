import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import {
  AssignedTechnician,
  CreateJobInput,
  CreateOwnerInput,
  CreateTemplateInput,
  Job,
  JobNoteEntry,
  JobSession,
  JobTask,
  Owner,
  OwnerTechnician,
  StoreData,
  Template,
  UpdateOwnerInput,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const EMPTY_STORE: StoreData = {
  owners: [],
  templates: [],
  jobs: [],
};

let writeQueue: Promise<void> = Promise.resolve();

const nowIso = () => new Date().toISOString();

const token = () => randomBytes(16).toString("hex");

function sanitizeList(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function sanitizeTechnicians(items: OwnerTechnician[]): OwnerTechnician[] {
  const cleaned: OwnerTechnician[] = [];
  const seenIds = new Set<string>();

  for (const candidate of items) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const id = typeof candidate.id === "string" && candidate.id ? candidate.id : randomUUID();
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const phone =
      typeof candidate.phone === "string" && candidate.phone.trim()
        ? candidate.phone.trim()
        : undefined;

    if (!name || seenIds.has(id)) {
      continue;
    }

    cleaned.push({ id, name, phone });
    seenIds.add(id);
  }

  return cleaned;
}

function normalizeOwner(candidate: Partial<Owner> & { id: string }): Owner {
  const technicians = Array.isArray(candidate.technicians)
    ? sanitizeTechnicians(candidate.technicians)
    : [];

  return {
    id: candidate.id,
    name: String(candidate.name ?? ""),
    email: String(candidate.email ?? ""),
    businessName: String(candidate.businessName ?? ""),
    businessPhone: String(candidate.businessPhone ?? ""),
    technicians,
    createdAt: String(candidate.createdAt ?? nowIso()),
  };
}

function normalizeAssignedTechnician(value: unknown): AssignedTechnician | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AssignedTechnician>;
  const id = typeof candidate.id === "string" ? candidate.id : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const phone =
    typeof candidate.phone === "string" && candidate.phone.trim()
      ? candidate.phone.trim()
      : undefined;

  if (!id || !name) {
    return null;
  }

  return { id, name, phone };
}

function normalizeJob(candidate: Partial<Job> & { id: string }): Job {
  const assignedTechnician = normalizeAssignedTechnician(candidate.assignedTechnician);

  const legacyNotes =
    typeof (candidate as { notes?: unknown }).notes === "string"
      ? String((candidate as { notes?: unknown }).notes)
      : "";

  const noteEntries =
    Array.isArray(candidate.noteEntries) && candidate.noteEntries.length > 0
      ? candidate.noteEntries
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return null;
            }

            const value = entry as Partial<JobNoteEntry>;
            if (!value.message || typeof value.message !== "string") {
              return null;
            }

            const authorName =
              typeof value.authorName === "string" && value.authorName.trim()
                ? value.authorName.trim()
                : assignedTechnician?.name ?? "Technician";
            const authorTechnicianId =
              typeof value.authorTechnicianId === "string" &&
              value.authorTechnicianId
                ? value.authorTechnicianId
                : assignedTechnician?.id;

            const normalized: JobNoteEntry = {
              id: typeof value.id === "string" ? value.id : randomUUID(),
              authorName,
              message: value.message,
              createdAt:
                typeof value.createdAt === "string" ? value.createdAt : nowIso(),
            };
            if (authorTechnicianId) {
              normalized.authorTechnicianId = authorTechnicianId;
            }

            return normalized;
          })
          .filter((entry): entry is JobNoteEntry => Boolean(entry))
      : legacyNotes.trim()
        ? [
            {
              id: `legacy-${candidate.id}`,
              authorName: assignedTechnician?.name ?? "Technician",
              authorTechnicianId: assignedTechnician?.id,
              message: legacyNotes.trim(),
              createdAt:
                typeof candidate.updatedAt === "string"
                  ? candidate.updatedAt
                  : nowIso(),
            },
          ]
        : [];

  return {
    id: candidate.id,
    ownerId: String(candidate.ownerId ?? ""),
    title: String(candidate.title ?? ""),
    businessName: String(candidate.businessName ?? ""),
    customerName: String(candidate.customerName ?? ""),
    customerPhone:
      typeof candidate.customerPhone === "string"
        ? candidate.customerPhone
        : undefined,
    location: String(candidate.location ?? ""),
    businessPhone: String(candidate.businessPhone ?? ""),
    assignedTechnician,
    noteEntries,
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    technicianToken: String(candidate.technicianToken ?? ""),
    customerToken: String(candidate.customerToken ?? ""),
    createdAt: String(candidate.createdAt ?? nowIso()),
    updatedAt: String(candidate.updatedAt ?? nowIso()),
  };
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as {
      owners?: unknown[];
      templates?: Template[];
      jobs?: unknown[];
    };
    const owners = Array.isArray(parsed.owners)
      ? parsed.owners
          .filter((owner): owner is Partial<Owner> & { id: string } => {
            return Boolean(owner && typeof (owner as { id?: unknown }).id === "string");
          })
          .map((owner) => normalizeOwner(owner))
      : [];

    const jobs = Array.isArray(parsed.jobs)
      ? parsed.jobs
          .filter((job): job is Partial<Job> & { id: string } => {
            return Boolean(job && typeof (job as { id?: unknown }).id === "string");
          })
          .map((job) => normalizeJob(job))
      : [];

    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
    for (const job of jobs) {
      if (!job.businessName) {
        job.businessName = ownersById.get(job.ownerId)?.businessName ?? "";
      }
    }

    return {
      owners,
      templates: parsed.templates ?? [],
      jobs,
    };
  } catch {
    return EMPTY_STORE;
  }
}

async function writeStore(store: StoreData): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function withWriteLock<T>(
  updater: (store: StoreData) => T | Promise<T>,
): Promise<T> {
  const operation = writeQueue.then(async () => {
    const current = await readStore();
    const result = await updater(current);
    await writeStore(current);
    return result;
  });

  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function sortNoteEntriesDesc(noteEntries: JobNoteEntry[]): JobNoteEntry[] {
  return [...noteEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function toJobSession(job: Job): JobSession {
  const totalTasks = job.tasks.length;
  const completedTasks = job.tasks.filter((task) => task.completed).length;
  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    id: job.id,
    title: job.title,
    businessName: job.businessName,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    location: job.location,
    businessPhone: job.businessPhone,
    assignedTechnician: job.assignedTechnician,
    noteEntries: sortNoteEntriesDesc(job.noteEntries),
    tasks: job.tasks,
    updatedAt: job.updatedAt,
    progressPercent,
    completedTasks,
    totalTasks,
    allCompleted: totalTasks > 0 && completedTasks === totalTasks,
  };
}

export async function createOwner(input: CreateOwnerInput): Promise<Owner> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  const businessPhone = input.businessPhone.trim();

  if (!name || !email || !businessName || !businessPhone) {
    throw new Error("All owner fields are required.");
  }

  return withWriteLock((store) => {
    const owner: Owner = {
      id: randomUUID(),
      name,
      email,
      businessName,
      businessPhone,
      technicians: [],
      createdAt: nowIso(),
    };

    store.owners.push(owner);
    return owner;
  });
}

export async function getOwner(ownerId: string): Promise<Owner | null> {
  const store = await readStore();
  return store.owners.find((owner) => owner.id === ownerId) ?? null;
}

export async function updateOwner(
  ownerId: string,
  input: UpdateOwnerInput,
): Promise<Owner | null> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  const businessPhone = input.businessPhone.trim();
  const technicians = input.technicians
    ? sanitizeTechnicians(input.technicians)
    : undefined;

  if (!ownerId || !name || !email || !businessName || !businessPhone) {
    throw new Error("All owner fields are required.");
  }

  return withWriteLock((store) => {
    const owner = store.owners.find((candidate) => candidate.id === ownerId);
    if (!owner) {
      return null;
    }

    owner.name = name;
    owner.email = email;
    owner.businessName = businessName;
    owner.businessPhone = businessPhone;
    if (technicians) {
      owner.technicians = technicians;
    }

    // Keep existing jobs in sync so customer views use latest business details.
    for (const job of store.jobs) {
      if (job.ownerId === ownerId) {
        job.businessName = businessName;
        job.businessPhone = businessPhone;
      }
    }

    return owner;
  });
}

export async function deleteOwner(ownerId: string): Promise<Owner | null> {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  return withWriteLock((store) => {
    const ownerIndex = store.owners.findIndex((owner) => owner.id === ownerId);
    if (ownerIndex === -1) {
      return null;
    }

    const [deletedOwner] = store.owners.splice(ownerIndex, 1);
    store.templates = store.templates.filter(
      (template) => template.ownerId !== ownerId,
    );
    store.jobs = store.jobs.filter((job) => job.ownerId !== ownerId);

    return deletedOwner ?? null;
  });
}

export async function listTemplates(ownerId: string): Promise<Template[]> {
  const store = await readStore();
  return store.templates.filter((template) => template.ownerId === ownerId);
}

export async function updateTemplateByOwner(
  ownerId: string,
  templateId: string,
  name: string,
  tasks: string[],
): Promise<Template | null> {
  const nextName = name.trim();
  const nextTasks = sanitizeList(tasks);

  if (!ownerId || !templateId || !nextName || nextTasks.length === 0) {
    throw new Error("Template name and at least one task are required.");
  }

  return withWriteLock((store) => {
    const template = store.templates.find(
      (candidate) =>
        candidate.id === templateId && candidate.ownerId === ownerId,
    );
    if (!template) {
      return null;
    }

    template.name = nextName;
    template.tasks = nextTasks;
    return template;
  });
}

export async function deleteTemplateByOwner(
  ownerId: string,
  templateId: string,
): Promise<Template | null> {
  return withWriteLock((store) => {
    const index = store.templates.findIndex(
      (template) =>
        template.id === templateId && template.ownerId === ownerId,
    );
    if (index === -1) {
      return null;
    }

    const [deleted] = store.templates.splice(index, 1);
    return deleted ?? null;
  });
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<Template> {
  const name = input.name.trim();
  const tasks = sanitizeList(input.tasks);

  if (!input.ownerId || !name || tasks.length === 0) {
    throw new Error("Template name and at least one task are required.");
  }

  return withWriteLock((store) => {
    const owner = store.owners.find((candidate) => candidate.id === input.ownerId);
    if (!owner) {
      throw new Error("Owner account not found.");
    }

    const template: Template = {
      id: randomUUID(),
      ownerId: input.ownerId,
      name,
      tasks,
      createdAt: nowIso(),
    };

    store.templates.push(template);
    return template;
  });
}

export async function listJobs(ownerId: string): Promise<Job[]> {
  const store = await readStore();
  const jobs = store.jobs.filter((job) => job.ownerId === ownerId);
  return sortByUpdatedAtDesc(jobs);
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const title = input.title.trim();
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone?.trim();
  const location = input.location.trim();
  const assignedTechnicianId = input.assignedTechnicianId?.trim();
  const taskNames = sanitizeList(input.tasks);

  if (!input.ownerId || !title || !customerName || !location || taskNames.length === 0) {
    throw new Error(
      "Job title, customer, location, and at least one task are required.",
    );
  }

  return withWriteLock((store) => {
    const owner = store.owners.find((candidate) => candidate.id === input.ownerId);
    if (!owner) {
      throw new Error("Owner account not found.");
    }

    let assignedTechnician: AssignedTechnician | null = null;
    if (owner.technicians.length > 0) {
      if (!assignedTechnicianId) {
        throw new Error("Select a lead technician for this job.");
      }

      const selected = owner.technicians.find(
        (technician) => technician.id === assignedTechnicianId,
      );
      if (!selected) {
        throw new Error("Assigned technician was not found.");
      }

      assignedTechnician = {
        id: selected.id,
        name: selected.name,
        phone: selected.phone,
      };
    } else if (assignedTechnicianId) {
      throw new Error("Assigned technician was not found.");
    }

    const timestamp = nowIso();
    const tasks: JobTask[] = taskNames.map((name) => ({
      id: randomUUID(),
      name,
      completed: false,
      updatedAt: timestamp,
    }));

    const job: Job = {
      id: randomUUID(),
      ownerId: input.ownerId,
      title,
      businessName: owner.businessName,
      customerName,
      customerPhone,
      location,
      businessPhone: owner.businessPhone,
      assignedTechnician,
      noteEntries: [],
      tasks,
      technicianToken: token(),
      customerToken: token(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.jobs.push(job);
    return job;
  });
}

export async function deleteJobByOwner(
  ownerId: string,
  jobId: string,
): Promise<Job | null> {
  return withWriteLock((store) => {
    const index = store.jobs.findIndex(
      (job) => job.id === jobId && job.ownerId === ownerId,
    );

    if (index === -1) {
      return null;
    }

    const [deleted] = store.jobs.splice(index, 1);
    return deleted ?? null;
  });
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const store = await readStore();
  return store.jobs.find((job) => job.id === jobId) ?? null;
}

export async function getJobByToken(
  role: "customer" | "technician",
  value: string,
): Promise<Job | null> {
  const store = await readStore();

  if (role === "customer") {
    return store.jobs.find((job) => job.customerToken === value) ?? null;
  }

  return store.jobs.find((job) => job.technicianToken === value) ?? null;
}

export async function updateTaskByTechnicianToken(
  technicianToken: string,
  taskId: string,
  completed?: boolean,
): Promise<Job | null> {
  return withWriteLock((store) => {
    const job = store.jobs.find((candidate) => candidate.technicianToken === technicianToken);
    if (!job) {
      return null;
    }

    const task = job.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error("Task not found.");
    }

    task.completed = completed ?? !task.completed;
    task.updatedAt = nowIso();
    job.updatedAt = nowIso();

    return job;
  });
}

export async function setAllTasksByTechnicianToken(
  technicianToken: string,
  completed: boolean,
): Promise<Job | null> {
  return withWriteLock((store) => {
    const job = store.jobs.find((candidate) => candidate.technicianToken === technicianToken);
    if (!job) {
      return null;
    }

    const timestamp = nowIso();
    for (const task of job.tasks) {
      task.completed = completed;
      task.updatedAt = timestamp;
    }
    job.updatedAt = timestamp;

    return job;
  });
}

export async function updateNotesByTechnicianToken(
  technicianToken: string,
  notes: string,
): Promise<Job | null> {
  const message = notes.trim();
  if (!message) {
    throw new Error("Note cannot be empty.");
  }

  return withWriteLock((store) => {
    const job = store.jobs.find((candidate) => candidate.technicianToken === technicianToken);
    if (!job) {
      return null;
    }

    const timestamp = nowIso();
    const authorName = job.assignedTechnician?.name ?? "Technician";
    const authorTechnicianId = job.assignedTechnician?.id;
    job.noteEntries.push({
      id: randomUUID(),
      authorName,
      authorTechnicianId,
      message,
      createdAt: timestamp,
    });
    job.updatedAt = timestamp;

    return job;
  });
}
