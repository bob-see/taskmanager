"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/";
  const callbackUrl =
    rawCallbackUrl.includes("/login") || rawCallbackUrl.includes("/api/auth/signin")
      ? "/"
      : rawCallbackUrl;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setSubmitting(false);

    if (!result || result.error) {
      setError("The email or password was not recognised.");
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--tm-bg)] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tm-muted)]">
            TaskManager
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--tm-text)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[color:var(--tm-muted)]">
            Use your TaskManager account to continue.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-[color:var(--tm-text)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-2 w-full rounded-2xl border border-[color:var(--tm-border)] bg-white px-4 py-3 text-sm text-[color:var(--tm-text)] outline-none transition focus:border-[color:var(--tm-accent)] focus:ring-2 focus:ring-[color:var(--tm-accent)]/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-[color:var(--tm-text)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-2xl border border-[color:var(--tm-border)] bg-white px-4 py-3 text-sm text-[color:var(--tm-text)] outline-none transition focus:border-[color:var(--tm-accent)] focus:ring-2 focus:ring-[color:var(--tm-accent)]/20"
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[color:var(--tm-text)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}