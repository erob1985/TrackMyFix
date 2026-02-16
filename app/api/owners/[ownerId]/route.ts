import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { authorizeOwnerAccess } from "@/lib/auth";
import { deleteOwner, getOwner, updateOwner } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ownerId: string }> },
): Promise<NextResponse> {
  const { ownerId } = await context.params;
  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  const owner = await getOwner(ownerId);

  if (!owner) {
    return errorResponse("Owner not found.", 404);
  }

  return NextResponse.json({ owner });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ ownerId: string }> },
): Promise<NextResponse> {
  const { ownerId } = await context.params;
  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse("Invalid request body.");
  }

  try {
    const submittedEmail = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (submittedEmail && submittedEmail !== manager.email) {
      return errorResponse(
        "Manager email must match your authenticated account email.",
        403,
      );
    }

    const technicians = Array.isArray(body.technicians)
      ? body.technicians.map((candidate) => ({
          id: String(candidate?.id ?? ""),
          name: String(candidate?.name ?? ""),
          phone:
            typeof candidate?.phone === "string" ? candidate.phone : undefined,
        }))
      : undefined;

    const owner = await updateOwner(ownerId, {
      name: String(body.name ?? ""),
      email: manager.email,
      businessName: String(body.businessName ?? ""),
      businessPhone: String(body.businessPhone ?? ""),
      technicians,
    });

    if (!owner) {
      return errorResponse("Owner not found.", 404);
    }

    return NextResponse.json({ owner });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update owner.";
    return errorResponse(message);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ ownerId: string }> },
): Promise<NextResponse> {
  const { ownerId } = await context.params;
  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof NextResponse) {
    return manager;
  }

  try {
    const deletedOwner = await deleteOwner(ownerId);
    if (!deletedOwner) {
      return errorResponse("Owner not found.", 404);
    }

    return NextResponse.json({ deletedOwnerId: deletedOwner.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete owner.";
    return errorResponse(message);
  }
}
