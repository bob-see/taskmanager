import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { TrackerClient } from "@/app/p/[profileId]/tracker-client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Props = {
  params: Promise<{ profileId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { profileId } = await params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true, name: true },
  });

  if (!profile) return notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-6 pt-3 text-[color:var(--tm-text)] md:px-6 md:pb-8 md:pt-4">
      <TrackerClient
        pageMode="tracker"
        profileId={profile.id}
        profileName={profile.name}
      />
    </main>
  );
}
