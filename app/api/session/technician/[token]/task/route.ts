import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { emitJobUpdated } from "@/lib/job-events";
import { toJobSession, updateTaskByTechnicianToken } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.taskId !== "string") {
    return errorResponse("taskId is required.");
  }

  try {
    const job = await updateTaskByTechnicianToken(
      token,
      body.taskId,
      typeof body.completed === "boolean" ? body.completed : undefined,
    );

    if (!job) {
      return errorResponse("Job not found.", 404);
    }

    emitJobUpdated(job);
    return NextResponse.json({ job: toJobSession(job) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task.";
    return errorResponse(message);
  }
}
