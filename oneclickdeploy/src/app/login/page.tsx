"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons</p>
        <h1 className="text-4xl font-semibold leading-tight">Sign in with GitHub</h1>
        <p className="mt-4 max-w-xl text-slate-300">
          Sign in to load your repositories and branches, then open deploy flow in Vercel or Netlify.
        </p>
        <div className="mt-8">
          <button
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Login with GitHub
          </button>
        </div>
      </section>
    </main>
  );
}
