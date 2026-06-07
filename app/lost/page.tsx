import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessLost } from "@/app/lost/access";
import { LostCountdownClient } from "@/app/lost/lost-countdown-client";

export default async function LostPage() {
  const session = await getServerSession(authOptions);

  if (!canAccessLost(session?.user?.email)) {
    return notFound();
  }

  return <LostCountdownClient />;
}
