import * as React from "react";
import { cn } from "../../lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
        variant === "default"
          ? "bg-[hsl(var(--accent))] text-white hover:opacity-90"
          : "border border-[hsl(var(--border))] bg-white/70 text-[hsl(var(--foreground))]",
        className
      )}
      {...props}
    />
  );
}