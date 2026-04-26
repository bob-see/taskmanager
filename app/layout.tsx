import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { prisma } from "@/app/lib/prisma";
import { AppShell } from "@/app/components/app-shell";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "TaskManager",
  title: "TaskManager",
  description: "TaskManager",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "TaskManager",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/api/auth/signin");
  }

  const profiles = await prisma.profile.findMany({
    where: {
      user: {
        email: session.user.email,
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell
          profiles={profiles}
          currentUser={{
          name: session.user.name,
          email: session.user.email,
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
