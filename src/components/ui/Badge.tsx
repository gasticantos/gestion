import { HTMLAttributes } from "react";

type Variant = "success" | "danger" | "warning" | "neutral" | "accent";

const variants: Record<Variant, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-blue-600/15 text-blue-500 border-blue-600/30",
  neutral: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
  accent: "bg-blue-600/15 text-blue-500 border-blue-600/30",
};

export default function Badge({
  variant = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
