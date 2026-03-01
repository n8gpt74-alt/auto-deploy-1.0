"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(6,182,212,0.22),transparent_38%),radial-gradient(circle_at_85%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#020617_100%)]" />
      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons MVP</p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
          One-click deploy from GitHub to Vercel or Netlify
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Sign in with GitHub, choose a repository and branch, then open provider setup with prefilled values.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {!session ? (
            <button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Login with GitHub
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Open dashboard
            </Link>
          )}
          <Link href="/login" className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold hover:border-slate-500">
            Login page
          </Link>
        </div>
      </section>
    </main>
  );
}
