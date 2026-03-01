import * as React from "react";
import { cn } from "@/lib/utils";

export function Accordion({ className, ...props }: React.HTMLAttributes<HTMLDetailsElement>) {
  return <details className={cn("rounded-xl border border-slate-800 bg-slate-950/40", className)} {...props} />;
}

export function AccordionTrigger({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <summary
      className={cn(
        "cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-100 marker:content-none",
        className,
      )}
      {...props}
    />
  );
}

export function AccordionContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4 border-t border-slate-800 p-4", className)} {...props} />;
}
