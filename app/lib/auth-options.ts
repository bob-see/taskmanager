import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import {
  AUTHENTICATED_HOME_PATH,
  getSafeAuthCallbackUrl,
} from "@/app/lib/auth-routes";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findFirst({
          where: { email, archivedAt: null },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      const callbackUrl = getSafeAuthCallbackUrl(url, baseUrl);
      return callbackUrl === AUTHENTICATED_HOME_PATH
        ? `${baseUrl}${AUTHENTICATED_HOME_PATH}`
        : `${baseUrl}${callbackUrl}`;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
