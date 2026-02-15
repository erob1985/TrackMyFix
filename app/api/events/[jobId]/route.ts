import { NextRequest } from "next/server";
import { onJobUpdated } from "@/lib/job-events";
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
  let unsubscribe: (() => void) | undefined;
  let heartbeat: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", job: toJobSession(job) });

      unsubscribe = onJobUpdated(jobId, (updatedJob) => {
        send({ type: "job.updated", job: toJobSession(updatedJob) });
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (unsubscribe) {
        unsubscribe();
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
