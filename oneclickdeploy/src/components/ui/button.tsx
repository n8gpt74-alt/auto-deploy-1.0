import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#ff4500] text-black border border-[#ff4500] hover:bg-black hover:text-[#ff4500] shadow-[4px_4px_0px_0px_#ffffff]",
  secondary:
    "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#ff4500]",
  outline:
    "bg-transparent border border-[#333333] text-white hover:border-[#ff4500] hover:text-[#ff4500] shadow-[4px_4px_0px_0px_#ff4500]",
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 uppercase tracking-widest items-center justify-center gap-2 rounded-none px-6 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_var(--tw-shadow-color)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff4500] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
