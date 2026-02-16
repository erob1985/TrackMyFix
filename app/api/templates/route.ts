import { NextRequest, NextResponse } from "next/server";
import { createTemplate, listTemplates } from "@/lib/store";
import { errorResponse } from "@/lib/api";
import { authorizeOwnerAccess } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return errorResponse("ownerId is required.");
  }

  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  const templates = await listTemplates(ownerId);
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("Invalid request body.");
  }

  const ownerId = String(body.ownerId ?? "");
  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  try {
    const template = await createTemplate({
      ownerId,
      name: String(body.name ?? ""),
      tasks: Array.isArray(body.tasks) ? body.tasks.map(String) : [],
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save template.";
    return errorResponse(message);
  }
}
