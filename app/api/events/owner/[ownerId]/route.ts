import { NextRequest, NextResponse } from "next/server";
import { authorizeOwnerAccess } from "@/lib/auth";
import { getOwnerUpdateSequence } from "@/lib/job-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ownerId: string }> },
): Promise<Response> {
  const { ownerId } = await context.params;

  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  const encoder = new TextEncoder();
  let heartbeat: NodeJS.Timeout | undefined;
  let poller: NodeJS.Timeout | undefined;
  let polling = false;
  let closed = false;
  let lastSequence = await getOwnerUpdateSequence(ownerId);

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", ownerId });

      poller = setInterval(async () => {
        if (closed || polling) {
          return;
        }

        polling = true;
        try {
          const currentSequence = await getOwnerUpdateSequence(ownerId);
          if (currentSequence > lastSequence) {
            lastSequence = currentSequence;
            send({ type: "owner.updated", ownerId });
          }
        } finally {
          polling = false;
        }
      }, 1000);

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

