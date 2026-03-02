import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconCheckCircle, IconLoader } from "@/components/ui/icons";

export type StatusTone = "success" | "warning" | "error" | "loading" | "neutral";

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  className?: string;
};

const containerByTone: Record<StatusTone, string> = {
  success: "border-[#ff4500] bg-black text-[#ff4500]",
  warning: "border-yellow-400 bg-black text-yellow-400",
  error: "border-red-500 bg-black text-red-500",
  loading: "border-white bg-black text-white",
  neutral: "border-[#333333] bg-black text-white",
};

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  const Icon = tone === "success" ? IconCheckCircle : tone === "loading" ? IconLoader : tone === "warning" || tone === "error" ? IconAlertTriangle : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-[1px] px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-widest",
        containerByTone[tone],
        className,
      )}
    >
      {Icon ? <Icon className={cn("size-3.5", tone === "loading" && "animate-spin")} /> : null}
      {label}
    </span>
  );
}
