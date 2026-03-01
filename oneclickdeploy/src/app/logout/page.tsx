"use client";

import { signOut } from "next-auth/react";

export default function LogoutPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons</p>
        <h1 className="text-4xl font-semibold leading-tight">Sign out</h1>
        <p className="mt-4 max-w-xl text-slate-300">End your GitHub session and return to the landing page.</p>
        <div className="mt-8">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold transition hover:border-slate-500"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}
