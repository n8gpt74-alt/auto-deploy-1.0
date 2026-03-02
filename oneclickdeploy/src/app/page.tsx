"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconGithub, IconRocket } from "@/components/ui/icons";
import { ThreeHero } from "@/components/ui/three-hero";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: session } = useSession();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } },
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white font-mono selection:bg-[#ff4500] selection:text-black">
      {/* 3D Background */}
      <ThreeHero />

      {/* Grid Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Content wrapper */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col justify-end px-6 xl:px-16 pb-20 pt-32">
        <motion.section 
          variants={containerVariants} 
          initial="hidden" 
          animate="show"
          className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-12 justify-between items-end border-t border-[#333333] pt-12"
        >
          {/* Left Block - Title */}
          <motion.div variants={itemVariants} className="flex-1 w-full max-w-2xl">
            <p className="mb-6 text-sm uppercase tracking-[0.4em] text-[#ff4500] border-l-2 border-[#ff4500] pl-4 font-bold">
              Автоматизированные Операции [Система Активна]
            </p>
            <h1 className="text-5xl sm:text-7xl font-sans font-black uppercase leading-[0.9] tracking-tighter">
              Протокол <br /> Деплоя <br /> В Один Клик
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <StatusBadge tone="success" label="O O O" />
              <StatusBadge tone="neutral" label="GitHub Авторизация" />
              <StatusBadge tone="neutral" label="Лимиты Провайдеров" />
              <StatusBadge tone="warning" label="Суровый UI/UX" />
            </div>
          </motion.div>

          {/* Right Block - Content & Actions */}
          <motion.div variants={itemVariants} className="flex-[0.8] w-full flex flex-col gap-8 bg-black/60 backdrop-blur-md border border-[#333333] p-8 brutalist-shadow">
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-xl">
              Выберите репозиторий и ветку. Система автоматически определит конфигурацию и предоставит прямые пути развертывания в Vercel, Netlify и Cloudflare.
            </p>
            
            <div className="flex flex-col gap-4">
              {!session ? (
                <Button className="w-full justify-between" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
                  <span className="flex items-center gap-2"><IconGithub className="size-5" /> Авторизоваться</span>
                  <span className="text-[#ff4500]">→</span>
                </Button>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex h-14 w-full justify-between items-center bg-[#ff4500] px-6 text-sm font-bold text-black border border-[#ff4500] shadow-[4px_4px_0px_0px_#ffffff] transition-all hover:bg-black hover:text-[#ff4500] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#ffffff] uppercase tracking-widest"
                >
                  <span className="flex items-center gap-2"><IconRocket className="size-5" /> Открыть Дашборд</span>
                  <span className="font-mono">ВЫПОЛНИТЬ</span>
                </Link>
              )}
              <Link
                href="/login"
                className="inline-flex h-14 w-full justify-between items-center border border-[#333333] bg-transparent px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#ff4500] transition-all hover:border-[#ff4500] hover:text-[#ff4500] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#ff4500] uppercase tracking-widest"
              >
                <span>Ручной Вход</span>
                <span className="font-mono">{">_"}</span>
              </Link>
            </div>
          </motion.div>
        </motion.section>

        {/* Footer Info */}
        <motion.div variants={itemVariants} initial="hidden" animate="show" className="mt-16 border-t border-[#333333] pt-6 max-w-7xl mx-auto w-full flex justify-between text-xs text-gray-600 font-mono items-center">
          <p className="max-w-2xl">
            ОБРАТИТЕ ВНИМАНИЕ: Требуется GitHub OAuth scope [repo]. Доступ используется исключительно на стороне сервера. Токен надежно изолирован.
          </p>
          <div className="hidden sm:block text-[#ff4500] animate-pulse">
            СТАТУС: ОНЛАЙН
          </div>
        </motion.div>
      </div>
    </main>
  );
}
