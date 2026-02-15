import { EventEmitter } from "node:events";
import { Job } from "./types";

declare global {
  var trackMyFixEmitter: EventEmitter | undefined;
}

const emitter = global.trackMyFixEmitter ?? new EventEmitter();
emitter.setMaxListeners(100);

if (!global.trackMyFixEmitter) {
  global.trackMyFixEmitter = emitter;
}

function eventName(jobId: string): string {
  return `job.updated.${jobId}`;
}

export function emitJobUpdated(job: Job): void {
  emitter.emit(eventName(job.id), job);
}

export function onJobUpdated(jobId: string, callback: (job: Job) => void): () => void {
  emitter.on(eventName(jobId), callback);
  return () => {
    emitter.off(eventName(jobId), callback);
  };
}
