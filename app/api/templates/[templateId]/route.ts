import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { deleteTemplateByOwner, updateTemplateByOwner } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid request body.");
  }

  const { templateId } = await context.params;

  try {
    const template = await updateTemplateByOwner(
      String(body.ownerId ?? ""),
      templateId,
      String(body.name ?? ""),
      Array.isArray(body.tasks) ? body.tasks.map(String) : [],
    );

    if (!template) {
      return errorResponse("Template not found.", 404);
    }

    return NextResponse.json({ template });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update template.";
    return errorResponse(message);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return errorResponse("ownerId is required.");
  }

  const { templateId } = await context.params;
  const deleted = await deleteTemplateByOwner(ownerId, templateId);

  if (!deleted) {
    return errorResponse("Template not found.", 404);
  }

  return NextResponse.json({ deletedTemplateId: deleted.id });
}
