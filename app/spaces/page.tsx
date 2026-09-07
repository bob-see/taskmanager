import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/lib/auth-options";
import { SpacesClient } from "@/app/spaces/spaces-client";

export default async function SpacesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  return <SpacesClient />;
}
