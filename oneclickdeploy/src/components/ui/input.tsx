import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "h-11 w-full rounded-lg border border-border bg-background/50 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-primary focus:ring-1 focus:ring-primary/20",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
