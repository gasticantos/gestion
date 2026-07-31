// Inicialización del sistema de caché
// Se ejecuta cuando abre la app

import { initCache } from "./cache";
import { startSync, preloadCache } from "./syncManager";

export async function initCacheSystem(): Promise<void> {
  try {
    console.log("[App] Inicializando sistema de caché...");

    // 1. Inicializar IndexedDB
    await initCache();
    console.log("[App] ✓ IndexedDB inicializado");

    // 2. Precargar datos del servidor
    await preloadCache();
    console.log("[App] ✓ Caché precargado");

    // 3. Iniciar sincronización en background
    await startSync();
    console.log("[App] ✓ Sincronización iniciada");

    console.log("[App] Sistema de caché listo");
  } catch (error) {
    console.error("[App] Error inicializando caché:", error);
    // Continuar aunque falle (la app sigue funcionando sin caché)
  }
}
