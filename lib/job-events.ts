import { Job } from "./types";
import { upstashRedis } from "./upstash";

function sequenceKey(jobId: string): string {
  return `trackmyfix:job:seq:${jobId}`;
}

function ownerSequenceKey(ownerId: string): string {
  return `trackmyfix:owner:seq:${ownerId}`;
}

async function incrementJobSequence(jobId: string): Promise<void> {
  if (!upstashRedis) {
    return;
  }

  await upstashRedis.incr(sequenceKey(jobId));
}

async function incrementOwnerSequence(ownerId: string): Promise<void> {
  if (!upstashRedis) {
    return;
  }

  await upstashRedis.incr(ownerSequenceKey(ownerId));
}

export async function getJobUpdateSequence(jobId: string): Promise<number> {
  if (!upstashRedis) {
    return 0;
  }

  const value = await upstashRedis.get(sequenceKey(jobId));
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function getOwnerUpdateSequence(ownerId: string): Promise<number> {
  if (!upstashRedis) {
    return 0;
  }

  const value = await upstashRedis.get(ownerSequenceKey(ownerId));
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function emitJobUpdated(job: Job): void {
  void Promise.all([
    incrementJobSequence(job.id),
    incrementOwnerSequence(job.ownerId),
  ]);
}

export function emitOwnerUpdated(ownerId: string): void {
  void incrementOwnerSequence(ownerId);
}
