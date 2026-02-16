import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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
  Template,
  UpdateOwnerInput,
} from "./types";
import { prisma } from "./prisma";
import { formatUsPhone, getUsPhoneDigits, isValidUsPhone } from "./phone";

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
    if (!name || seenIds.has(id)) {
      continue;
    }

    cleaned.push({ id, name });
    seenIds.add(id);
  }

  return cleaned;
}

type DbOwner = Awaited<ReturnType<typeof prisma.owner.findUnique>>;
type DbOwnerWithTechnicians = Prisma.OwnerGetPayload<{
  include: { technicians: true };
}>;
type DbTemplate = Prisma.TemplateGetPayload<Record<string, never>>;
type DbJobWithRelations = Prisma.JobGetPayload<{
  include: { assignedTechnician: true; tasks: true; notes: true };
}>;

function mapAssignedTechnician(
  technician: { id: string; name: string } | null | undefined,
): AssignedTechnician | null {
  if (!technician) {
    return null;
  }

  return {
    id: technician.id,
    name: technician.name,
  };
}

function mapOwner(owner: DbOwnerWithTechnicians): Owner {
  return {
    id: owner.id,
    name: owner.name,
    email: owner.email,
    businessName: owner.businessName,
    businessPhone: owner.businessPhone,
    technicians: owner.technicians.map((technician) => ({
      id: technician.id,
      name: technician.name,
    })),
    createdAt: owner.createdAt.toISOString(),
  };
}

function mapTemplate(template: DbTemplate): Template {
  return {
    id: template.id,
    ownerId: template.ownerId,
    name: template.name,
    tasks: template.tasks,
    createdAt: template.createdAt.toISOString(),
  };
}

function mapJobTask(task: { id: string; name: string; completed: boolean; updatedAt: Date }): JobTask {
  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    updatedAt: task.updatedAt.toISOString(),
  };
}

function getTaskSequenceFromId(taskId: string): number | null {
  const match = /^(\d+)-/.exec(taskId);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function sortTasksForDisplay(tasks: JobTask[]): JobTask[] {
  return [...tasks].sort((a, b) => {
    const aSeq = getTaskSequenceFromId(a.id);
    const bSeq = getTaskSequenceFromId(b.id);

    if (aSeq !== null && bSeq !== null) {
      return aSeq - bSeq;
    }

    if (aSeq !== null) {
      return -1;
    }

    if (bSeq !== null) {
      return 1;
    }

    return a.id.localeCompare(b.id);
  });
}

function mapJobNoteEntry(entry: {
  id: string;
  authorName: string;
  authorTechnicianId: string | null;
  message: string;
  createdAt: Date;
}): JobNoteEntry {
  return {
    id: entry.id,
    authorName: entry.authorName,
    authorTechnicianId: entry.authorTechnicianId ?? undefined,
    message: entry.message,
    createdAt: entry.createdAt.toISOString(),
  };
}

function mapJob(job: DbJobWithRelations): Job {
  return {
    id: job.id,
    ownerId: job.ownerId,
    title: job.title,
    businessName: job.businessName,
    customerName: job.customerName,
    customerPhone: job.customerPhone ?? undefined,
    location: job.location,
    businessPhone: job.businessPhone,
    assignedTechnician: mapAssignedTechnician(job.assignedTechnician),
    noteEntries: job.notes.map(mapJobNoteEntry),
    tasks: sortTasksForDisplay(job.tasks.map(mapJobTask)),
    technicianToken: job.technicianToken,
    customerToken: job.customerToken,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
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

async function getJobWithRelationsById(jobId: string): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      assignedTechnician: true,
      tasks: true,
      notes: true,
    },
  });

  if (!job) {
    return null;
  }

  return mapJob(job);
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
  const businessPhone = formatUsPhone(input.businessPhone.trim());

  if (!name || !email || !businessName || !businessPhone) {
    throw new Error("All owner fields are required.");
  }
  if (!isValidUsPhone(businessPhone)) {
    throw new Error("Business phone must be a valid 10-digit phone number.");
  }

  const owner = await prisma.owner.create({
    data: {
      id: randomUUID(),
      name,
      email,
      businessName,
      businessPhone,
      createdAt: new Date(),
    },
    include: {
      technicians: true,
    },
  });

  return mapOwner(owner);
}

export async function getOwner(ownerId: string): Promise<Owner | null> {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: {
      technicians: true,
    },
  });

  if (!owner) {
    return null;
  }

  return mapOwner(owner);
}

export async function getOwnerByEmail(email: string): Promise<Owner | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const owner = await prisma.owner.findFirst({
    where: { email: normalizedEmail },
    include: {
      technicians: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!owner) {
    return null;
  }

  return mapOwner(owner);
}

export async function updateOwner(
  ownerId: string,
  input: UpdateOwnerInput,
): Promise<Owner | null> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim();
  const businessPhone = formatUsPhone(input.businessPhone.trim());
  const technicians = input.technicians
    ? sanitizeTechnicians(input.technicians)
    : undefined;

  if (!ownerId || !name || !email || !businessName || !businessPhone) {
    throw new Error("All owner fields are required.");
  }
  if (!isValidUsPhone(businessPhone)) {
    throw new Error("Business phone must be a valid 10-digit phone number.");
  }

  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  if (!owner) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.owner.update({
      where: { id: ownerId },
      data: {
        name,
        email,
        businessName,
        businessPhone,
      },
    });

    if (technicians) {
      if (technicians.length === 0) {
        await tx.ownerTechnician.deleteMany({ where: { ownerId } });
      } else {
        const keepIds = technicians.map((technician) => technician.id);
        await tx.ownerTechnician.deleteMany({
          where: {
            ownerId,
            id: { notIn: keepIds },
          },
        });

        for (const technician of technicians) {
          await tx.ownerTechnician.upsert({
            where: { id: technician.id },
            update: {
              name: technician.name,
              ownerId,
            },
            create: {
              id: technician.id,
              ownerId,
              name: technician.name,
            },
          });
        }
      }
    }

    await tx.job.updateMany({
      where: { ownerId },
      data: {
        businessName,
        businessPhone,
      },
    });
  });

  const updated = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { technicians: true },
  });

  return updated ? mapOwner(updated) : null;
}

export async function deleteOwner(ownerId: string): Promise<Owner | null> {
  if (!ownerId) {
    throw new Error("Owner ID is required.");
  }

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { technicians: true },
  });

  if (!owner) {
    return null;
  }

  await prisma.owner.delete({ where: { id: ownerId } });
  return mapOwner(owner);
}

export async function listTemplates(ownerId: string): Promise<Template[]> {
  const templates = await prisma.template.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });

  return templates.map(mapTemplate);
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

  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      ownerId,
    },
  });

  if (!template) {
    return null;
  }

  const updated = await prisma.template.update({
    where: { id: templateId },
    data: {
      name: nextName,
      tasks: nextTasks,
    },
  });

  return mapTemplate(updated);
}

export async function deleteTemplateByOwner(
  ownerId: string,
  templateId: string,
): Promise<Template | null> {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      ownerId,
    },
  });

  if (!template) {
    return null;
  }

  await prisma.template.delete({
    where: { id: templateId },
  });

  return mapTemplate(template);
}

export async function createTemplate(
  input: CreateTemplateInput,
): Promise<Template> {
  const name = input.name.trim();
  const tasks = sanitizeList(input.tasks);

  if (!input.ownerId || !name || tasks.length === 0) {
    throw new Error("Template name and at least one task are required.");
  }

  const owner = await prisma.owner.findUnique({
    where: { id: input.ownerId },
  });

  if (!owner) {
    throw new Error("Owner account not found.");
  }

  const template = await prisma.template.create({
    data: {
      id: randomUUID(),
      ownerId: input.ownerId,
      name,
      tasks,
      createdAt: new Date(),
    },
  });

  return mapTemplate(template);
}

export async function listJobs(ownerId: string): Promise<Job[]> {
  const jobs = await prisma.job.findMany({
    where: { ownerId },
    include: {
      assignedTechnician: true,
      tasks: true,
      notes: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return sortByUpdatedAtDesc(jobs.map(mapJob));
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const title = input.title.trim();
  const customerName = input.customerName.trim();
  const customerPhoneRaw = input.customerPhone?.trim();
  const customerPhoneDigits = customerPhoneRaw ? getUsPhoneDigits(customerPhoneRaw) : "";
  const customerPhone = customerPhoneDigits.length === 10 ? formatUsPhone(customerPhoneDigits) : undefined;
  const location = input.location.trim();
  const assignedTechnicianId = input.assignedTechnicianId?.trim();
  const taskNames = sanitizeList(input.tasks);

  if (!input.ownerId || !title || !customerName || !location || taskNames.length === 0) {
    throw new Error(
      "Job title, customer, location, and at least one task are required.",
    );
  }
  if (customerPhoneRaw && customerPhoneDigits.length !== 10) {
    throw new Error("Customer phone must be a valid 10-digit phone number.");
  }

  const owner = await prisma.owner.findUnique({
    where: { id: input.ownerId },
    include: { technicians: true },
  });

  if (!owner) {
    throw new Error("Owner account not found.");
  }

  let nextAssignedTechnicianId: string | null = null;
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
    nextAssignedTechnicianId = selected.id;
  } else if (assignedTechnicianId) {
    throw new Error("Assigned technician was not found.");
  }

  const timestamp = new Date();
  const jobId = randomUUID();
  const job = await prisma.job.create({
    data: {
      id: jobId,
      ownerId: input.ownerId,
      assignedTechnicianId: nextAssignedTechnicianId,
      title,
      businessName: owner.businessName,
      customerName,
      customerPhone,
      location,
      businessPhone: owner.businessPhone,
      technicianToken: token(),
      customerToken: token(),
      createdAt: timestamp,
      updatedAt: timestamp,
      tasks: {
        create: taskNames.map((taskName, index) => ({
          // Prefix with stable sequence so task order remains deterministic.
          id: `${String(index).padStart(4, "0")}-${randomUUID()}`,
          name: taskName,
          completed: false,
          updatedAt: timestamp,
        })),
      },
    },
    include: {
      assignedTechnician: true,
      tasks: true,
      notes: true,
    },
  });

  return mapJob(job);
}

export async function deleteJobByOwner(
  ownerId: string,
  jobId: string,
): Promise<Job | null> {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      ownerId,
    },
    include: {
      assignedTechnician: true,
      tasks: true,
      notes: true,
    },
  });

  if (!job) {
    return null;
  }

  await prisma.job.delete({ where: { id: jobId } });
  return mapJob(job);
}

export async function getJobById(jobId: string): Promise<Job | null> {
  return getJobWithRelationsById(jobId);
}

export async function getJobByToken(
  role: "customer" | "technician",
  value: string,
): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: role === "customer" ? { customerToken: value } : { technicianToken: value },
    include: {
      assignedTechnician: true,
      tasks: true,
      notes: true,
    },
  });

  return job ? mapJob(job) : null;
}

export async function updateTaskByTechnicianToken(
  technicianToken: string,
  taskId: string,
  completed?: boolean,
): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: { technicianToken },
    include: { tasks: true },
  });

  if (!job) {
    return null;
  }

  const task = job.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const timestamp = new Date();
  await prisma.$transaction([
    prisma.jobTask.update({
      where: { id: taskId },
      data: {
        completed: typeof completed === "boolean" ? completed : !task.completed,
        updatedAt: timestamp,
      },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: { updatedAt: timestamp },
    }),
  ]);

  return getJobWithRelationsById(job.id);
}

export async function setAllTasksByTechnicianToken(
  technicianToken: string,
  completed: boolean,
): Promise<Job | null> {
  const job = await prisma.job.findUnique({
    where: { technicianToken },
  });

  if (!job) {
    return null;
  }

  const timestamp = new Date();
  await prisma.$transaction([
    prisma.jobTask.updateMany({
      where: { jobId: job.id },
      data: {
        completed,
        updatedAt: timestamp,
      },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: { updatedAt: timestamp },
    }),
  ]);

  return getJobWithRelationsById(job.id);
}

export async function updateNotesByTechnicianToken(
  technicianToken: string,
  notes: string,
): Promise<Job | null> {
  const message = notes.trim();
  if (!message) {
    throw new Error("Note cannot be empty.");
  }

  const job = await prisma.job.findUnique({
    where: { technicianToken },
    include: { assignedTechnician: true },
  });

  if (!job) {
    return null;
  }

  const timestamp = new Date();
  await prisma.$transaction([
    prisma.jobNoteEntry.create({
      data: {
        id: randomUUID(),
        jobId: job.id,
        authorName: job.assignedTechnician?.name ?? "Technician",
        authorTechnicianId: job.assignedTechnician?.id ?? null,
        message,
        createdAt: timestamp,
      },
    }),
    prisma.job.update({
      where: { id: job.id },
      data: { updatedAt: timestamp },
    }),
  ]);

  return getJobWithRelationsById(job.id);
}
