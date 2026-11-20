import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "glow" | "subtle" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  asChild?: boolean;
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
} = {}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]";

  const variantStyles: Record<string, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-xs hover:shadow-md border border-slate-900",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-950 border border-slate-200/80 shadow-xs",
    outline:
      "border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 shadow-xs",
    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900",
    glow:
      "relative bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 hover:from-sky-500 hover:via-sky-600 hover:to-blue-700 text-white font-semibold shadow-md shadow-sky-500/20 hover:shadow-sky-500/35 border border-sky-300/40",
    subtle:
      "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200",
    destructive:
      "bg-rose-600 hover:bg-rose-700 text-white shadow-xs hover:shadow-md hover:shadow-rose-500/20 border border-rose-500/30 focus-visible:ring-rose-500",
  };

  const sizeStyles: Record<string, string> = {
    sm: "h-8 px-3 text-xs rounded-full gap-1.5",
    md: "h-10 px-4 text-sm rounded-full gap-2",
    lg: "h-12 px-6 text-base rounded-full gap-2.5",
    icon: "h-9 w-9 p-0 rounded-full",
  };

  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = buttonVariants({ variant, size, className });

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={classes}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
