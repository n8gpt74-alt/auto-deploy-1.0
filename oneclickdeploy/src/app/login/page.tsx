"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconGithub } from "@/components/ui/icons";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(6,182,212,0.18),transparent_38%),radial-gradient(circle_at_90%_5%,rgba(20,184,166,0.16),transparent_35%)]" />
      <div className="floating-orb floating-orb--cyan -left-16 top-20 size-56 opacity-65" />
      <div className="floating-orb floating-orb--teal -right-14 top-14 size-44 opacity-65" />

      <section className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Card className="border-cyan-500/20">
          <CardContent className="p-6 sm:p-8">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons</p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Sign in with GitHub</h1>
            <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
              Авторизуйся, чтобы загрузить репозитории, выбрать ветку и открыть deploy flow в Vercel, Netlify или Cloudflare.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge tone="success" label="Secure OAuth" />
              <StatusBadge tone="neutral" label="One-click deploy" />
            </div>

            <div className="mt-8">
              <Button className="w-full sm:w-auto" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
                <IconGithub className="size-4" />
                Login with GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
