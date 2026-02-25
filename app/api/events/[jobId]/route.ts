import { NextRequest } from "next/server";
import { getJobUpdateSequence } from "@/lib/job-events";
import { getJobById, toJobSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  const role = request.nextUrl.searchParams.get("role");
  const token = request.nextUrl.searchParams.get("token");

  if ((role !== "customer" && role !== "technician") || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const job = await getJobById(jobId);
  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const isAuthorized =
    (role === "customer" && job.customerToken === token) ||
    (role === "technician" && job.technicianToken === token);

  if (!isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let heartbeat: NodeJS.Timeout | undefined;
  let poller: NodeJS.Timeout | undefined;
  let polling = false;
  let closed = false;
  let lastSequence = await getJobUpdateSequence(jobId);
  const pollIntervalMs = Number(process.env.JOB_EVENTS_POLL_MS ?? "2000");
  const safePollIntervalMs =
    Number.isFinite(pollIntervalMs) && pollIntervalMs >= 500
      ? pollIntervalMs
      : 2000;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", job: toJobSession(job) });

      poller = setInterval(async () => {
        if (closed || polling) {
          return;
        }

        polling = true;
        try {
          const currentSequence = await getJobUpdateSequence(jobId);
          if (currentSequence > lastSequence) {
            lastSequence = currentSequence;
            const updatedJob = await getJobById(jobId);
            if (updatedJob) {
              send({ type: "job.updated", job: toJobSession(updatedJob) });
            }
          }
        } finally {
          polling = false;
        }
      }, safePollIntervalMs);

      heartbeat = setInterval(() => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);
    },
    cancel() {
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (poller) {
        clearInterval(poller);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
