import { HTMLAttributes } from "react";

export default function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm shadow-neutral-500/20 dark:shadow-black/20 transition-colors ${className}`}
      {...props}
    />
  );
}
