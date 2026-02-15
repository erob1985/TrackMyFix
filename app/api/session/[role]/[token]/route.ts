import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getJobByToken, toJobSession } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ role: string; token: string }> },
): Promise<NextResponse> {
  const { role, token } = await context.params;

  if (role !== "customer" && role !== "technician") {
    return errorResponse("Unsupported role.", 404);
  }

  const job = await getJobByToken(role, token);
  if (!job) {
    return errorResponse("Job not found.", 404);
  }

  return NextResponse.json({ job: toJobSession(job) });
}
