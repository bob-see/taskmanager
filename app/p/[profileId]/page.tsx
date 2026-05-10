import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { TrackerClient } from "@/app/p/[profileId]/tracker-client";
import { getTrackerPageData } from "@/app/p/[profileId]/tracker-data";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Props = {
  params: Promise<{ profileId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { profileId } = await params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) return notFound();

  const { profile, initialData } = await getTrackerPageData(
    profileId,
    session.user.email
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-[color:var(--tm-text)] md:px-6 md:pb-8 md:pt-4">
      <TrackerClient
        pageMode="tracker"
        profileId={profile.id}
        profileName={profile.name}
        initialData={initialData}
      />
    </main>
  );
}
