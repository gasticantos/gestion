import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Restaurar tema guardado o preferencia del sistema
    const saved = localStorage.getItem("theme") as Theme | null;
    let initial: Theme = saved || "light";

    // Si no hay tema guardado, intentar usar preferencia del sistema
    if (!saved && typeof window !== "undefined") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      initial = prefersDark ? "dark" : "light";
    }

    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  function applyTheme(newTheme: Theme) {
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  if (!mounted) return <>{children}</>;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
