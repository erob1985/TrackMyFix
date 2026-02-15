import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { emitJobUpdated } from "@/lib/job-events";
import { toJobSession, updateNotesByTechnicianToken } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.notes !== "string") {
    return errorResponse("notes is required.");
  }

  try {
    const job = await updateNotesByTechnicianToken(token, body.notes);
    if (!job) {
      return errorResponse("Job not found.", 404);
    }

    emitJobUpdated(job);
    return NextResponse.json({ job: toJobSession(job) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save note.";
    return errorResponse(message);
  }
}
