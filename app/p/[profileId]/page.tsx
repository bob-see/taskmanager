import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";

type Props = {
  params: Promise<{ profileId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { profileId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });

  if (!profile) return notFound();

  return (
    <main className="mx-auto max-w-xl p-6">
      <Link className="text-sm opacity-70 hover:opacity-100" href="/">
        ← Back to profiles
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{profile.name}</h1>
      <p className="mt-2 text-sm opacity-70">
        Profile page placeholder (tasks UI comes in PR2).
      </p>
    </main>
  );
}
