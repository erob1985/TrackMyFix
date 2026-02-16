import { redirect } from "next/navigation";
import { authorizeOwnerAccess } from "@/lib/auth";
import { getOwner } from "@/lib/store";

export default async function ManagerOwnerIndexPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const { ownerId } = await params;

  const manager = await authorizeOwnerAccess(ownerId);
  if (manager instanceof Response) {
    redirect("/");
  }

  const owner = await getOwner(ownerId);
  if (!owner) {
    redirect("/");
  }

  if (owner.technicians.length === 0) {
    redirect(`/manager/${ownerId}/account?onboarding=1`);
  }

  redirect(`/manager/${ownerId}/jobs/create`);
}
