import { redirect } from "next/navigation";

export default async function ManagerOwnerIndexPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const { ownerId } = await params;
  redirect(`/manager/${ownerId}/jobs/create`);
}
