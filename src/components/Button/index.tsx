import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand-primary text-white hover:bg-brand-deep shadow-[0_4px_16px_rgb(107_0_157/0.2)] hover:shadow-[0_6px_20px_rgb(107_0_157/0.3)]",
  secondary: "bg-surface-high text-brand-primary hover:bg-ink-200/60",
  outline: "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50 hover:text-brand-primary",
  ghost: "text-ink-700 hover:bg-ink-50",
  accent: "bg-amber-100 text-amber-800 hover:bg-amber-300 shadow-sm",
  danger: "bg-red-700 text-white hover:bg-red-800 shadow-sm",
  "danger-ghost": "text-red-700 hover:bg-red-50",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };
type LinkProps = CommonProps & { to: string; "aria-label"?: string };

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

/** Renders a router Link when `to` is given, otherwise a native button. */
export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = buttonClasses(variant, size, className);
  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={classes} aria-label={props["aria-label"]}>
        {children}
      </Link>
    );
  }
  const { variant: _v, size: _s, className: _c, children: _ch, to: _t, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
