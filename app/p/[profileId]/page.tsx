import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { TrackerClient } from "@/app/p/[profileId]/tracker-client";

type Props = {
  params: Promise<{ profileId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { profileId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true },
  });

  if (!profile) return notFound();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-sm opacity-70 hover:opacity-100" href="/">
            ← Back to profiles
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">{profile.name}</h1>
          <p className="mt-1 text-sm opacity-70">
            Tasks are scoped to this profile.
          </p>
        </div>
      </div>

      <TrackerClient profileId={profile.id} profileName={profile.name} />
    </main>
  );
}
