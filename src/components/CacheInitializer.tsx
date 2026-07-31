"use client";

import { useEffect } from "react";
import { initCacheSystem } from "@/lib/cacheInit";

export default function CacheInitializer() {
  useEffect(() => {
    // Inicializar sistema de caché cuando carga la app
    initCacheSystem().catch(console.error);
  }, []);

  return null; // No renderiza nada
}
