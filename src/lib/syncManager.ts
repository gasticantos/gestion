// Gestor de sincronización en background
// Sube cambios sin bloquear la UI, reintenta si hay error

import { getSyncQueue, markSyncQueueAsSynced, setInCache } from "./cache";

let syncing = false;
let syncInterval: NodeJS.Timeout | null = null;

export async function startSync(): Promise<void> {
  if (syncInterval) return; // Ya está corriendo

  // Sincronizar cada 5 segundos
  syncInterval = setInterval(syncChanges, 5000);
  // También sincronizar ahora
  await syncChanges();
}

export function stopSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function syncChanges(): Promise<void> {
  if (syncing) return; // Ya hay un sync en progreso
  syncing = true;

  try {
    const queue = await getSyncQueue();
    const unsyncedChanges = queue.filter((item) => !item.synced);

    if (unsyncedChanges.length === 0) {
      syncing = false;
      return;
    }

    console.log(`[Sync] Subiendo ${unsyncedChanges.length} cambios...`);

    // Agrupar por tabla
    const byTable = unsyncedChanges.reduce(
      (acc, item) => {
        if (!acc[item.table]) acc[item.table] = [];
        acc[item.table].push(item);
        return acc;
      },
      {} as Record<string, (typeof unsyncedChanges)[0][]>
    );

    // Procesar tabla por tabla
    for (const [table, items] of Object.entries(byTable)) {
      for (const item of items) {
        try {
          await syncSingleChange(item.operation, table, item.data, item.id);
        } catch (error) {
          console.warn(`[Sync] Error sincronizando ${table}:`, error);
          // No marcar como synced si hay error, reintentar después
        }
      }
    }

    // Actualizar caché de lectura desde el servidor
    await refreshCacheFromServer();

    console.log("[Sync] Sincronización completada");
  } catch (error) {
    console.error("[Sync] Error general de sincronización:", error);
  } finally {
    syncing = false;
  }
}

async function syncSingleChange(
  operation: string,
  table: string,
  data: unknown,
  queueId: number
): Promise<void> {
  const method = operation === "DELETE" ? "DELETE" : operation === "CREATE" ? "POST" : "PATCH";
  const endpoint = `/api/${table}`;

  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Marcar como sincronizado
  await markSyncQueueAsSynced([queueId]);
}

async function refreshCacheFromServer(): Promise<void> {
  try {
    // Actualizar productos
    const productosRes = await fetch("/api/productos?venta=1");
    if (productosRes.ok) {
      const productos = await productosRes.json();
      await setInCache("productos", productos, 3600000);
    }

    // Actualizar clientes
    const clientesRes = await fetch("/api/clientes");
    if (clientesRes.ok) {
      const clientes = await clientesRes.json();
      await setInCache("clientes", clientes, 3600000);
    }

    // Actualizar config
    const configRes = await fetch("/api/configuracion");
    if (configRes.ok) {
      const config = await configRes.json();
      await setInCache("configuracion", config, 3600000);
    }
  } catch (error) {
    console.warn("[Sync] No se pudo refrescar caché del servidor:", error);
    // Continuar con caché viejo si hay error
  }
}

export async function preloadCache(): Promise<void> {
  try {
    console.log("[Cache] Precargando datos...");

    const [productosRes, clientesRes, configRes] = await Promise.all([
      fetch("/api/productos?venta=1"),
      fetch("/api/clientes"),
      fetch("/api/configuracion"),
    ]);

    if (productosRes.ok) {
      const productos = await productosRes.json();
      await setInCache("productos", productos, 3600000);
    }

    if (clientesRes.ok) {
      const clientes = await clientesRes.json();
      await setInCache("clientes", clientes, 3600000);
    }

    if (configRes.ok) {
      const config = await configRes.json();
      await setInCache("configuracion", config, 3600000);
    }

    console.log("[Cache] Precarga completada");
  } catch (error) {
    console.error("[Cache] Error precargando:", error);
  }
}
