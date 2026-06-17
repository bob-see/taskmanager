import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  AUTHENTICATED_HOME_PATH,
  getSafeAuthCallbackUrl,
} from "@/app/lib/auth-routes";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const rawCallbackUrl = Array.isArray(params?.callbackUrl)
    ? params?.callbackUrl[0]
    : params?.callbackUrl;
  const callbackUrl = getSafeAuthCallbackUrl(
    rawCallbackUrl,
    process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  );

  if (session?.user?.email) {
    redirect(callbackUrl || AUTHENTICATED_HOME_PATH);
  }

  return <LoginForm callbackUrl={callbackUrl} />;
}
