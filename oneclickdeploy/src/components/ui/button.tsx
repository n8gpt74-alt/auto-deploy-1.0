import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-cyan-400/30",
  secondary:
    "bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20 hover:-translate-y-0.5 hover:bg-teal-300 hover:shadow-teal-400/30",
  outline:
    "border border-slate-600/80 bg-slate-900/60 text-slate-100 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-800/80",
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 will-change-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
