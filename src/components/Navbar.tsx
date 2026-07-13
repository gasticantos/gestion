"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { puedeAcceder, ROL_LABEL } from "@/lib/permisos";
import { Rol } from "@/generated/prisma/enums";
import { useTheme } from "@/lib/themeContext";

const links = [
  { href: "/venta", label: "Vender" },
  { href: "/ventas", label: "Ventas" },
  { href: "/mesas", label: "Mesas" },
  { href: "/reservas", label: "Reservas" },
  { href: "/stock", label: "Stock" },
  { href: "/productos", label: "Productos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/clientes", label: "Clientes" },
  { href: "/reportes", label: "Reportes" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nombre: string; rol: Rol } | null>(null);
  const [mounted, setMounted] = useState(false);

  let theme: "light" | "dark" = "light";
  let setTheme: (t: "light" | "dark") => void = () => {};
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    setTheme = themeContext.setTheme;
  } catch {
    // Fallback si no está dentro de ThemeProvider
  }

  // Esperar a que se monte para evitar problemas de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsuario(data));
  }, [pathname]);

  if (pathname === "/login") return null;

  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Limpiar todo localStorage
    localStorage.clear();
    router.push("/login");
    router.refresh();
  }

  const linksVisibles = usuario ? links.filter((l) => puedeAcceder(l.href, usuario.rol)) : [];

  return (
    <nav className="print:hidden sticky top-0 z-20 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 flex-wrap transition-colors text-sm sm:text-base">
      <Link href="/" className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 shrink-0">
        <span className="grid place-items-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white font-bold text-xs sm:text-sm">
          G
        </span>
        <span className="hidden sm:inline font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Gestión</span>
      </Link>

      <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
        {linksVisibles.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border whitespace-nowrap ${
                active
                  ? "bg-blue-600 dark:bg-blue-600 text-white border-blue-600"
                  : "text-neutral-600 dark:text-neutral-400 border-transparent hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {usuario && (
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            {usuario.nombre} · {ROL_LABEL[usuario.rol]}
          </span>

          {mounted && (
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
              title={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          )}

          <button
            onClick={cerrarSesion}
            className="text-sm text-neutral-600 dark:text-neutral-400 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}
