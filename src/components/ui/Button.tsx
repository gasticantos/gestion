import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";

const sizes = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
};

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 font-semibold",
  secondary: "bg-neutral-800 text-neutral-100 border border-neutral-700 hover:bg-neutral-700",
  danger: "bg-red-600/90 text-white hover:bg-red-600",
  ghost: "text-neutral-400 hover:text-neutral-100",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}
