import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { emitJobUpdated } from "@/lib/job-events";
import { setAllTasksByTechnicianToken, toJobSession } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.completed !== "boolean") {
    return errorResponse("completed boolean is required.");
  }

  const job = await setAllTasksByTechnicianToken(token, body.completed);
  if (!job) {
    return errorResponse("Job not found.", 404);
  }

  emitJobUpdated(job);
  return NextResponse.json({ job: toJobSession(job) });
}
