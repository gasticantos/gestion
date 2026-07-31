"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initCacheSystem } from "@/lib/cacheInit";

let yaInicializado = false;

export default function CacheInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    // En /login todavía no hay sesión: precargar y sincronizar solo generaría
    // pedidos 401 repetidos contra las APIs protegidas. Una vez que el usuario
    // navega a cualquier otra pantalla (ya logueado), inicializar una sola vez.
    if (pathname === "/login" || yaInicializado) return;
    yaInicializado = true;
    initCacheSystem().catch(console.error);
  }, [pathname]);

  return null; // No renderiza nada
}
