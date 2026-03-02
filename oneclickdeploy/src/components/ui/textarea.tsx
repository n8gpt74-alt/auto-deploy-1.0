import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]",
        className,
      )}
      {...props}
    />
  );
}
