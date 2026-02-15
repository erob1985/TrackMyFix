import { NextRequest, NextResponse } from "next/server";
import { createOwner } from "@/lib/store";
import { errorResponse } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("Invalid request body.");
  }

  try {
    const owner = await createOwner({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      businessName: String(body.businessName ?? ""),
      businessPhone: String(body.businessPhone ?? ""),
    });

    return NextResponse.json({ owner }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return errorResponse(message);
  }
}
