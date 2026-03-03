"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconGithub } from "@/components/ui/icons";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white font-mono selection:bg-[#ff4500] selection:text-black">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      <section className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="border border-[#333333] bg-black/80 backdrop-blur-md p-6 sm:p-10 brutalist-shadow">
          <p className="mb-4 text-sm uppercase tracking-[0.4em] text-[#ff4500] font-bold border-l-2 border-[#ff4500] pl-4">Протокол Деплоя</p>
          <h1 className="text-4xl sm:text-5xl font-black uppercase leading-[1.1] tracking-tight font-sans">Вход через GitHub</h1>
          <p className="mt-6 max-w-xl text-sm sm:text-base text-gray-400">
            Авторизуйся, чтобы загрузить репозитории и ветки, получить авто-рекомендации конфигурации и открыть deploy flow в Vercel, Netlify или Cloudflare.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <StatusBadge tone="success" label="Безопасный OAuth" />
            <StatusBadge tone="neutral" label="Деплой в один клик" />
            <StatusBadge tone="warning" label="Изолированный Токен" />
          </div>

          <p className="mt-8 text-xs text-gray-600">
            Для доступа к приватным репозиториям нужен scope [repo]. Токен хранится на серверной стороне и используется только для GitHub API
            запросов.
          </p>

          <div className="mt-10 border-t border-[#333333] pt-8">
            <Button className="w-full sm:w-auto text-base" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
              <IconGithub className="size-5 mr-2" />
              Войти через GitHub
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
