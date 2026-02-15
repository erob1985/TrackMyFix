import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs, toJobSession } from "@/lib/store";
import { errorResponse } from "@/lib/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return errorResponse("ownerId is required.");
  }

  const jobs = await listJobs(ownerId);
  const summaries = jobs.map((job) => ({
    ...toJobSession(job),
    technicianToken: job.technicianToken,
    customerToken: job.customerToken,
    createdAt: job.createdAt,
  }));

  return NextResponse.json({ jobs: summaries });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("Invalid request body.");
  }

  try {
    const job = await createJob({
      ownerId: String(body.ownerId ?? ""),
      title: String(body.title ?? ""),
      customerName: String(body.customerName ?? ""),
      customerPhone:
        typeof body.customerPhone === "string" ? body.customerPhone : undefined,
      location: String(body.location ?? ""),
      assignedTechnicianId:
        typeof body.assignedTechnicianId === "string"
          ? body.assignedTechnicianId
          : undefined,
      tasks: Array.isArray(body.tasks) ? body.tasks.map(String) : [],
    });

    return NextResponse.json(
      {
        job: {
          ...toJobSession(job),
          technicianToken: job.technicianToken,
          customerToken: job.customerToken,
          createdAt: job.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create job.";
    return errorResponse(message);
  }
}
