"use client";

import { useCallback, useEffect, useState } from "react";

type ToastTone = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  duration: number;
};

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-green-500 text-green-400",
  error: "border-red-500 text-red-400",
  info: "border-[#ff4500] text-[#ff4500]",
  warning: "border-yellow-500 text-yellow-400",
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: "✓",
  error: "✗",
  info: "■",
  warning: "⚠",
};

let globalAddToast: ((tone: ToastTone, message: string, duration?: number) => void) | null = null;

export function toast(tone: ToastTone, message: string, duration = 4000) {
  if (globalAddToast) {
    globalAddToast(tone, message, duration);
  }
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const addToast = useCallback((tone: ToastTone, message: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { id, tone, message, duration }]);
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  const removeToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {items.map((item) => (
        <ToastItemView key={item.id} item={item} onDismiss={removeToast} />
      ))}
    </div>
  );
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(item.id), 300);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={`pointer-events-auto border bg-black px-5 py-3 font-mono text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(255,69,0,0.3)] transition-all duration-300 max-w-sm cursor-pointer ${
        TONE_STYLES[item.tone]
      } ${visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
      onClick={() => {
        setExiting(true);
        setTimeout(() => onDismiss(item.id), 300);
      }}
    >
      <span className="mr-2 font-bold">{TONE_ICONS[item.tone]}</span>
      {item.message}
    </div>
  );
}
