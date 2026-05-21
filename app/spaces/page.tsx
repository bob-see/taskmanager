import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { SpacesClient } from "@/app/spaces/spaces-client";

export default async function SpacesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  return <SpacesClient />;
}
