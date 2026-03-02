"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconGithub, IconRocket } from "@/components/ui/icons";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(6,182,212,0.22),transparent_38%),radial-gradient(circle_at_85%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#020617_100%)]" />
      <div className="floating-orb floating-orb--cyan -left-24 top-20 size-64 opacity-70" />
      <div className="floating-orb floating-orb--teal -right-16 top-8 size-52 opacity-70" />

      <section className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-14 sm:px-6 sm:py-16">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons MVP</p>
        <h1 className="max-w-4xl text-3xl font-semibold leading-tight sm:text-5xl md:text-6xl">
          One-click deploy from GitHub to Vercel, Netlify, or Cloudflare
        </h1>
        <p className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
          Выбери репозиторий и ветку, получи авто-рекомендации конфигурации и запускай деплой с прозрачными ограничениями каждого провайдера.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge tone="success" label="3D Motion UI" />
          <StatusBadge tone="success" label="Mobile Optimized" />
          <StatusBadge tone="neutral" label="GitHub Powered" />
          <StatusBadge tone="neutral" label="Provider limits visible" />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
          {!session ? (
            <Button className="w-full sm:w-auto" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
              <IconGithub className="size-4" />
              Login with GitHub
            </Button>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-cyan-400/30 sm:w-auto"
            >
              <IconRocket className="size-4" />
              Open dashboard
            </Link>
          )}
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-600/80 bg-slate-900/60 px-5 text-sm font-semibold text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-800/80 sm:w-auto"
          >
            Login page
          </Link>
        </div>

        <p className="mt-4 max-w-3xl text-xs text-slate-400 sm:text-sm">
          Для приватных репозиториев требуется GitHub OAuth scope <code>repo</code>. Доступ используется только на сервере для чтения репозиториев/веток и не
          прокидывается в client session payload.
        </p>
      </section>
    </main>
  );
}
