import { NextResponse } from "next/server";
import { requireManagerIdentity } from "@/lib/auth";
import { getOwnerByEmail } from "@/lib/store";

export async function GET(): Promise<NextResponse> {
  const manager = await requireManagerIdentity();
  if (manager instanceof NextResponse) {
    return manager;
  }

  const owner = await getOwnerByEmail(manager.email);
  return NextResponse.json({ owner });
}
