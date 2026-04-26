import type { Metadata } from "next";
import { getServerSession } from "next-auth";
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
    return (
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
        </body>
      </html>
    );
  }

  const email = session.user.email;

  const [profiles, currentUser] = await Promise.all([
    prisma.profile.findMany({
      where: {
        user: {
          email,
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        name: true,
        email: true,
        role: true,
      },
    }),
  ]);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell
          profiles={profiles}
          currentUser={{
            name: currentUser?.name ?? session.user.name,
            email: currentUser?.email ?? email,
            role: currentUser?.role,
          }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
