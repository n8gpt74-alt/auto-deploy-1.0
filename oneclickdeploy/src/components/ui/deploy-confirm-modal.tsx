"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type DeployConfirmProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  provider: string;
  repoName: string;
  branch: string;
  rootDirectory: string;
  buildCommand: string;
  envCount: number;
};

export function DeployConfirmModal({
  open,
  onConfirm,
  onCancel,
  provider,
  repoName,
  branch,
  rootDirectory,
  buildCommand,
  envCount,
}: DeployConfirmProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg border-2 border-[#ff4500] bg-black p-0 shadow-[8px_8px_0px_0px_#ff4500] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="border-b-2 border-[#ff4500] bg-[#111] px-6 py-4">
          <p className="font-mono text-sm font-black uppercase tracking-widest text-[#ff4500]">
            ⚠ Подтверждение деплоя
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2 font-mono text-xs">
            <Row label="ПРОВАЙДЕР" value={provider.toUpperCase()} highlight />
            <Row label="РЕПОЗИТОРИЙ" value={repoName} />
            <Row label="ВЕТКА" value={branch} />
            <Row label="ROOT DIR" value={rootDirectory || "."} />
            <Row label="BUILD CMD" value={buildCommand || "npm run build"} />
            <Row
              label="ENV ПЕРЕМЕННЫХ"
              value={envCount > 0 ? `${envCount} ключей` : "не задано"}
              warn={envCount === 0}
            />
          </div>

          {branch === "main" || branch === "master" ? (
            <div className="border border-yellow-600 bg-yellow-950/30 px-4 py-2 text-xs font-mono text-yellow-400">
              ⚠ Деплой в <span className="font-bold">{branch}</span> — это production ветка
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-[#333] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 font-mono text-xs uppercase tracking-widest"
            onClick={onCancel}
          >
            Отмена [Esc]
          </Button>
          <button
            type="button"
            className="flex-1 bg-[#ff4500] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-white active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#fff] active:shadow-[2px_2px_0px_0px_#fff]"
            onClick={onConfirm}
          >
            Запустить [Enter]
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-500 shrink-0 w-32">{label}:</span>
      <span
        className={`font-bold break-all ${
          highlight ? "text-[#ff4500]" : warn ? "text-yellow-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
