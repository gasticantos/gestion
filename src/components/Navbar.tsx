"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { puedeAcceder, ROL_LABEL } from "@/lib/permisos";
import { Rol } from "@/generated/prisma/enums";

const links = [
  { href: "/venta", label: "Vender" },
  { href: "/ventas", label: "Ventas" },
  { href: "/cierre-caja", label: "Cierre de caja" },
  { href: "/mesas", label: "Mesas" },
  { href: "/reservas", label: "Reservas" },
  { href: "/stock", label: "Stock" },
  { href: "/productos", label: "Productos" },
  { href: "/promos", label: "Promos" },
  { href: "/flyers", label: "Flyers" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/clientes", label: "Clientes" },
  { href: "/reportes", label: "Reportes" },
  { href: "/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<{ nombre: string; rol: Rol } | null>(null);
  const [identidad, setIdentidad] = useState<{ nombrePrograma: string; logoPrograma: string | null }>({
    nombrePrograma: "Gestión",
    logoPrograma: null,
  });
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Inicializar tema desde localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = saved || "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata una preferencia externa guardada en localStorage
    setTheme(initialTheme);

    // Aplicar tema al HTML
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    // Login y logout hacen navegación completa. Por eso esta sincronización se monta
    // una sola vez y jamás vuelve a ejecutarse por tocar Ventas u otra sección.
    if (window.location.pathname === "/login") return;

    Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetch("/api/configuracion", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ]).then(([usuarioActual, configuracion]) => {
      setUsuario(usuarioActual);
      if (configuracion) {
        setIdentidad({
          nombrePrograma: configuracion.nombrePrograma || "Gestión",
          logoPrograma: configuracion.logoPrograma || null,
        });
        document.title = configuracion.nombrePrograma || "Gestión";
      }
    });
  }, []);

  useEffect(() => {
    function actualizar(evento: Event) {
      const detalle = (evento as CustomEvent<typeof identidad>).detail;
      setIdentidad(detalle);
      document.title = detalle.nombrePrograma;
    }
    window.addEventListener("identidad-actualizada", actualizar);
    return () => window.removeEventListener("identidad-actualizada", actualizar);
  }, []);

  // La caja es un equipo compartido: al cerrar la app de escritorio, invalidar la
  // cookie para que la próxima apertura siempre solicite las credenciales.
  useEffect(() => {
    if (!isTauri()) return;

    let cerrando = false;
    let quitarListener: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(async (evento) => {
        if (cerrando) return;
        evento.preventDefault();
        cerrando = true;

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2_000);
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
          });
          // La sesión se invalida con la cookie. La impresora y la identidad de la
          // estación pertenecen a esta computadora y deben sobrevivir al cierre.
          localStorage.removeItem("carrito-venta");
        } catch {
          // El cierre no debe quedar bloqueado si no hay conexión en ese instante.
        } finally {
          window.clearTimeout(timeout);
          // close() vuelve a emitir onCloseRequested y puede dejar la aplicación en
          // un ciclo. destroy() es la salida forzada documentada por Tauri y garantiza
          // que la X cierre el proceso aun si el logout o la red fallaron.
          await getCurrentWindow().destroy();
        }
      })
      .then((unlisten) => {
        quitarListener = unlisten;
      });

    return () => quitarListener?.();
  }, []);

  if (pathname === "/login") return null;

  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Limpiar datos del usuario, conservando la impresora y la identidad física
    // de esta computadora para que pueda imprimir aun en la pantalla de login.
    localStorage.removeItem("carrito-venta");
    window.location.assign("/login");
  }

  const linksVisibles = usuario ? links.filter((l) => puedeAcceder(l.href, usuario.rol)) : [];

  return (
    <nav className="print:hidden sticky top-0 z-20 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 flex-wrap transition-colors text-sm sm:text-base">
      <Link href="/" className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 shrink-0">
        <span className="grid place-items-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white font-bold text-xs sm:text-sm overflow-hidden">
          {identidad.logoPrograma ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo configurable guardado por el negocio
            <img src={identidad.logoPrograma} alt="" className="w-full h-full object-cover" />
          ) : (
            identidad.nombrePrograma.charAt(0).toUpperCase() || "G"
          )}
        </span>
        <span className="hidden sm:inline font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {identidad.nombrePrograma}
        </span>
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
              onClick={() => {
                const newTheme = theme === "light" ? "dark" : "light";
                localStorage.setItem("theme", newTheme);
                setTheme(newTheme);

                // Actualizar clase dark en el html
                if (newTheme === "dark") {
                  document.documentElement.classList.add("dark");
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.classList.remove("dark");
                  document.documentElement.setAttribute("data-theme", "light");
                }
              }}
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
