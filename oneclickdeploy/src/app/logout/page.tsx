"use client";

import { signOut } from "next-auth/react";

export default function LogoutPage() {
  return (
    <main className="min-h-screen bg-black text-white font-mono selection:bg-[#ff4500] selection:text-black">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="border border-[#333333] p-8 brutalist-shadow">
          <p className="mb-4 text-sm uppercase tracking-[0.4em] text-[#ff4500] font-bold">Протокол Деплоя</p>
          <h1 className="text-4xl font-black uppercase leading-tight font-sans">Выход из системы</h1>
          <p className="mt-4 max-w-xl text-gray-400">Завершить сессию GitHub и вернуться на главную страницу.</p>
          <div className="mt-8">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex h-12 uppercase tracking-widest items-center justify-center gap-2 rounded-none px-6 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#ffffff] bg-[#ff4500] text-black border border-[#ff4500] hover:bg-black hover:text-[#ff4500] shadow-[4px_4px_0px_0px_#ffffff]"
            >
              Выйти [EXIT]
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
