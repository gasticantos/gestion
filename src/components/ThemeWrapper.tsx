"use client";

import { ThemeProvider } from "@/lib/themeContext";
import { ReactNode } from "react";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
