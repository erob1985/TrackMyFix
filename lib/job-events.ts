import { Job } from "./types";
import { upstashRedis } from "./upstash";

const inMemorySequenceStore = new Map<string, number>();

function sequenceKey(jobId: string): string {
  return `trackmyfix:job:seq:${jobId}`;
}

function ownerSequenceKey(ownerId: string): string {
  return `trackmyfix:owner:seq:${ownerId}`;
}

async function incrementJobSequence(jobId: string): Promise<void> {
  const key = sequenceKey(jobId);

  if (upstashRedis) {
    await upstashRedis.incr(key);
    return;
  }

  inMemorySequenceStore.set(key, (inMemorySequenceStore.get(key) ?? 0) + 1);
}

async function incrementOwnerSequence(ownerId: string): Promise<void> {
  const key = ownerSequenceKey(ownerId);

  if (upstashRedis) {
    await upstashRedis.incr(key);
    return;
  }

  inMemorySequenceStore.set(key, (inMemorySequenceStore.get(key) ?? 0) + 1);
}

export async function getJobUpdateSequence(jobId: string): Promise<number> {
  const key = sequenceKey(jobId);

  if (!upstashRedis) {
    return inMemorySequenceStore.get(key) ?? 0;
  }

  const value = await upstashRedis.get(key);
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
  const key = ownerSequenceKey(ownerId);

  if (!upstashRedis) {
    return inMemorySequenceStore.get(key) ?? 0;
  }

  const value = await upstashRedis.get(key);
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
