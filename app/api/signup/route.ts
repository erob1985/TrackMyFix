import { NextRequest, NextResponse } from "next/server";
import { createOwner } from "@/lib/store";
import { errorResponse } from "@/lib/api";
import { requireManagerIdentity } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const manager = await requireManagerIdentity();
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

    const owner = await createOwner({
      name: String(body.name ?? ""),
      email: manager.email,
      businessName: String(body.businessName ?? ""),
      businessPhone: String(body.businessPhone ?? ""),
    });

    return NextResponse.json({ owner }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return errorResponse(message);
  }
}
