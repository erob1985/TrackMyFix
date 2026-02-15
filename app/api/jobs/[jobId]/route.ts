import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { deleteJobByOwner } from "@/lib/store";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return errorResponse("ownerId is required.");
  }

  const { jobId } = await context.params;
  const deletedJob = await deleteJobByOwner(ownerId, jobId);

  if (!deletedJob) {
    return errorResponse("Job not found.", 404);
  }

  return NextResponse.json({ deletedJobId: deletedJob.id });
}
