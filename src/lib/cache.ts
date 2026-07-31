// Sistema de caché con IndexedDB para lectura rápida local
// Los datos se sirven del caché mientras se sincronizan en background

const DB_NAME = "gestion-cache";
const DB_VERSION = 1;

export type CacheTable = "productos" | "clientes" | "mesas" | "configuracion" | "categorias";

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number; // en ms
}

let db: IDBDatabase | null = null;

export async function initCache(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Crear stores para cada tabla
      const stores: CacheTable[] = ["productos", "clientes", "mesas", "configuracion", "categorias"];
      for (const store of stores) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      }

      // Store para cambios pendientes de sincronizar
      if (!database.objectStoreNames.contains("sync-queue")) {
        database.createObjectStore("sync-queue", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

export async function getFromCache<T>(table: CacheTable, id?: number): Promise<T[] | T | null> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction(table, "readonly");
    const store = tx.objectStore(table);

    if (id === undefined) {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        // Filtrar expired
        const valid = entries.filter((e) => Date.now() - e.timestamp < e.ttl);
        resolve(valid.map((e) => e.data) as T[]);
      };
    } else {
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        const isExpired = Date.now() - entry.timestamp > entry.ttl;
        resolve(isExpired ? null : (entry.data as T));
      };
    }
  });
}

export async function setInCache(table: CacheTable, data: unknown[], ttl: number = 3600000): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction(table, "readwrite");
    const store = tx.objectStore(table);

    // Limpiar todo primero
    store.clear();

    // Agregar con metadata
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const entry: CacheEntry = {
        data: item,
        timestamp: Date.now(),
        ttl,
      };
      store.put({ ...(item as Record<string, unknown>), ...entry });
    }

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function clearCache(table?: CacheTable): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    if (table) {
      const tx = db!.transaction(table, "readwrite");
      const store = tx.objectStore(table);
      store.clear();
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    } else {
      const tx = db!.transaction(
        ["productos", "clientes", "mesas", "configuracion", "categorias"],
        "readwrite"
      );
      tx.objectStoreNames;
      for (let i = 0; i < tx.objectStoreNames.length; i++) {
        tx.objectStore(tx.objectStoreNames[i]).clear();
      }
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    }
  });
}

// Búsqueda en caché (para productos principalmente)
export async function searchInCache(
  table: CacheTable,
  query: string,
  fields: string[]
): Promise<unknown[]> {
  if (!db) await initCache();

  const allData = (await getFromCache(table)) as Record<string, unknown>[];
  const q = query.toLowerCase();

  return allData.filter((item) => fields.some((field) => String(item[field] || "").toLowerCase().includes(q)));
}

// Cola de sincronización
export async function addToSyncQueue(
  operation: "CREATE" | "UPDATE" | "DELETE",
  table: string,
  data: unknown
): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction("sync-queue", "readwrite");
    const store = tx.objectStore("sync-queue");

    store.add({
      operation,
      table,
      data,
      timestamp: Date.now(),
      synced: false,
    });

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function getSyncQueue(): Promise<
  { id: number; operation: string; table: string; data: unknown; timestamp: number; synced: boolean }[]
> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction("sync-queue", "readonly");
    const store = tx.objectStore("sync-queue");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function markSyncQueueAsSynced(ids: number[]): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction("sync-queue", "readwrite");
    const store = tx.objectStore("sync-queue");

    for (const id of ids) {
      store.put({ id, synced: true });
    }

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function clearSyncQueue(): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction("sync-queue", "readwrite");
    const store = tx.objectStore("sync-queue");
    store.clear();

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}
