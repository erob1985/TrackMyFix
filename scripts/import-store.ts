import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface LegacyTechnician {
  id: string;
  name: string;
}

interface LegacyOwner {
  id: string;
  name: string;
  email: string;
  businessName: string;
  businessPhone: string;
  createdAt: string;
  technicians?: LegacyTechnician[];
}

interface LegacyTemplate {
  id: string;
  ownerId: string;
  name: string;
  tasks: string[];
  createdAt: string;
}

interface LegacyJobTask {
  id: string;
  name: string;
  completed: boolean;
  updatedAt: string;
}

interface LegacyJobNoteEntry {
  id: string;
  authorName: string;
  authorTechnicianId?: string;
  message: string;
  createdAt: string;
}

interface LegacyJob {
  id: string;
  ownerId: string;
  title: string;
  businessName?: string;
  customerName: string;
  customerPhone?: string;
  location: string;
  businessPhone: string;
  assignedTechnician?: { id: string; name: string } | null;
  noteEntries?: LegacyJobNoteEntry[];
  tasks?: LegacyJobTask[];
  technicianToken: string;
  customerToken: string;
  createdAt: string;
  updatedAt: string;
}

interface LegacyStore {
  owners?: LegacyOwner[];
  templates?: LegacyTemplate[];
  jobs?: LegacyJob[];
}

function toDate(value: string | undefined): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

async function main(): Promise<void> {
  const datasourceUrl = process.env.DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error("DATABASE_URL is not set. Export env vars before running this script.");
  }

  const adapter = new PrismaPg({ connectionString: datasourceUrl });
  const prisma = new PrismaClient({
    adapter,
  });
  const sourcePath = path.join(process.cwd(), "data", "store.json");

  try {
    const raw = await readFile(sourcePath, "utf8");
    const parsed = JSON.parse(raw) as LegacyStore;

    const owners = parsed.owners ?? [];
    const templates = parsed.templates ?? [];
    const jobs = parsed.jobs ?? [];

    const technicians = owners.flatMap((owner) =>
      (owner.technicians ?? []).map((tech) => ({
        id: tech.id,
        ownerId: owner.id,
        name: tech.name,
      })),
    );

    const tasks = jobs.flatMap((job) =>
      (job.tasks ?? []).map((task) => ({
        id: task.id,
        jobId: job.id,
        name: task.name,
        completed: Boolean(task.completed),
        updatedAt: toDate(task.updatedAt),
      })),
    );

    const notes = jobs.flatMap((job) =>
      (job.noteEntries ?? []).map((note) => ({
        id: note.id,
        jobId: job.id,
        authorName: note.authorName,
        authorTechnicianId: note.authorTechnicianId,
        message: note.message,
        createdAt: toDate(note.createdAt),
      })),
    );

    await prisma.$transaction(async (tx) => {
      // Full replace import: clear target tables first to keep IDs/tokens aligned.
      await tx.jobNoteEntry.deleteMany();
      await tx.jobTask.deleteMany();
      await tx.job.deleteMany();
      await tx.template.deleteMany();
      await tx.ownerTechnician.deleteMany();
      await tx.owner.deleteMany();

      if (owners.length > 0) {
        await tx.owner.createMany({
          data: owners.map((owner) => ({
            id: owner.id,
            name: owner.name,
            email: owner.email,
            businessName: owner.businessName,
            businessPhone: owner.businessPhone,
            createdAt: toDate(owner.createdAt),
          })),
        });
      }

      if (technicians.length > 0) {
        await tx.ownerTechnician.createMany({ data: technicians });
      }

      if (templates.length > 0) {
        await tx.template.createMany({
          data: templates.map((template) => ({
            id: template.id,
            ownerId: template.ownerId,
            name: template.name,
            tasks: template.tasks ?? [],
            createdAt: toDate(template.createdAt),
          })),
        });
      }

      if (jobs.length > 0) {
        await tx.job.createMany({
          data: jobs.map((job) => ({
            id: job.id,
            ownerId: job.ownerId,
            assignedTechnicianId: job.assignedTechnician?.id ?? null,
            title: job.title,
            businessName: job.businessName ?? "",
            customerName: job.customerName,
            customerPhone: job.customerPhone ?? null,
            location: job.location,
            businessPhone: job.businessPhone,
            technicianToken: job.technicianToken,
            customerToken: job.customerToken,
            createdAt: toDate(job.createdAt),
            updatedAt: toDate(job.updatedAt),
          })),
        });
      }

      if (tasks.length > 0) {
        await tx.jobTask.createMany({ data: tasks });
      }

      if (notes.length > 0) {
        await tx.jobNoteEntry.createMany({ data: notes });
      }
    });

    console.log("Import complete.");
    console.log(`Owners: ${owners.length}`);
    console.log(`Technicians: ${technicians.length}`);
    console.log(`Templates: ${templates.length}`);
    console.log(`Jobs: ${jobs.length}`);
    console.log(`Tasks: ${tasks.length}`);
    console.log(`Notes: ${notes.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Import failed.");
  console.error(error);
  process.exit(1);
});
