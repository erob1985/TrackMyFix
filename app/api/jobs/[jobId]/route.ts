import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { authorizeOwnerAccess } from "@/lib/auth";
import { deleteJobByOwner } from "@/lib/store";
import { emitOwnerUpdated } from "@/lib/job-events";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return errorResponse("ownerId is required.");
  }

  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  const { jobId } = await context.params;
  const deletedJob = await deleteJobByOwner(ownerId, jobId);

  if (!deletedJob) {
    return errorResponse("Job not found.", 404);
  }

  emitOwnerUpdated(ownerId);
  return NextResponse.json({ deletedJobId: deletedJob.id });
}
