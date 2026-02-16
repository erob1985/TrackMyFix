import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getOwner } from "@/lib/store";

interface ManagerIdentity {
  email: string;
}

function getUserPrimaryEmail(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | null {
  if (!user) {
    return null;
  }

  const primary =
    user.emailAddresses.find(
      (candidate) => candidate.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];

  return primary?.emailAddress?.toLowerCase() ?? null;
}

export async function requireManagerIdentity(): Promise<
  ManagerIdentity | NextResponse
> {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("Unauthorized.", 401);
  }

  const user = await currentUser();
  const email = getUserPrimaryEmail(user);
  if (!email) {
    return errorResponse("Unable to resolve authenticated manager email.", 403);
  }

  return {
    email,
  };
}

export async function authorizeOwnerAccess(
  ownerId: string,
): Promise<ManagerIdentity | NextResponse> {
  const manager = await requireManagerIdentity();
  if (manager instanceof NextResponse) {
    return manager;
  }

  const owner = await getOwner(ownerId);
  if (!owner) {
    return errorResponse("Owner not found.", 404);
  }

  if (owner.email.toLowerCase() !== manager.email) {
    return errorResponse("Forbidden.", 403);
  }

  return manager;
}
