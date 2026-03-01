import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { TrackerClient } from "@/app/p/[profileId]/tracker-client";

type Props = {
  params: Promise<{ profileId: string }>;
};

export default async function ReportingPage({ params }: Props) {
  const { profileId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true },
  });

  if (!profile) return notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-6 pt-3 text-[color:var(--tm-text)] md:px-6 md:pb-8 md:pt-4">
      <TrackerClient
        pageMode="reporting"
        profileId={profile.id}
        profileName={profile.name}
      />
    </main>
  );
}
