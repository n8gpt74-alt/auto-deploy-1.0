import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconCheckCircle, IconLoader } from "@/components/ui/icons";

export type StatusTone = "success" | "warning" | "error" | "loading" | "neutral";

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  className?: string;
};

const containerByTone: Record<StatusTone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  loading: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  neutral: "border-slate-600/70 bg-slate-900/60 text-slate-200",
};

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  const Icon = tone === "success" ? IconCheckCircle : tone === "loading" ? IconLoader : tone === "warning" || tone === "error" ? IconAlertTriangle : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
        containerByTone[tone],
        className,
      )}
    >
      {Icon ? <Icon className={cn("size-3.5", tone === "loading" && "animate-spin")} /> : null}
      {label}
    </span>
  );
}
