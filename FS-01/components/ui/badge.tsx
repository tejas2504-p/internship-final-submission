import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "brand" | "outline" | "success" | "warning" | "cyan";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-medium rounded-full transition-colors select-none";

  const variantStyles: Record<string, string> = {
    default: "bg-slate-100 text-slate-700 border border-slate-200",
    brand:
      "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs shadow-sky-500/10",
    outline: "border border-slate-300 text-slate-700 bg-transparent",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    cyan: "bg-sky-50 text-sky-700 border border-sky-200",
  };

  const sizeStyles: Record<string, string> = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
