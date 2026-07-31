// Hook para leer datos del caché local
// Devuelve datos al instante del caché, actualiza en background si es necesario

import { useEffect, useState } from "react";
import { getFromCache, setInCache, searchInCache } from "@/lib/cache";

export function useData<T>(
  table: "productos" | "clientes" | "mesas" | "configuracion" | "categorias",
  options?: {
    search?: string;
    searchFields?: string[];
    forceRefresh?: boolean;
  }
): { data: T[] | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // 1. Intentar leer del caché primero (RÁPIDO)
        if (!options?.forceRefresh) {
          const cached = (await getFromCache<T>(table)) as T[] | null;
          if (mounted && cached && cached.length > 0) {
            // Si hay búsqueda, filtrar caché
            if (options?.search && options?.searchFields) {
              const filtered = (await searchInCache(table, options.search, options.searchFields)) as T[];
              setData(filtered);
            } else {
              setData(cached);
            }
            setLoading(false);
            setError(null);
            // Continuar precargando en background
          }
        }

        // 2. Sincronizar con servidor en background (NO BLOQUEA)
        if (!options?.search) {
          // Solo actualizar si no hay búsqueda
          const endpoint = table === "productos" ? `/api/productos?venta=1` : `/api/${table}`;
          const response = await fetch(endpoint);

          if (!response.ok) throw new Error("No se pudieron cargar los datos");

          const serverData = await response.json();
          const arrayData = Array.isArray(serverData) ? serverData : [serverData];

          // Guardar en caché
          await setInCache(table, arrayData, 3600000);

          if (mounted) {
            setData(arrayData as T[]);
            setError(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error desconocido");
          // Si hay error de servidor pero tenemos caché, mantener caché
          if (!data) setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [table, options?.forceRefresh, options?.search, options?.searchFields]);

  return { data, loading, error };
}

// Hook para búsqueda en caché en tiempo real
export function useSearchCache(
  table: "productos" | "clientes" | "mesas" | "configuracion" | "categorias",
  query: string,
  fields: string[]
): T[] {
  const [results, setResults] = useState<T[]>([]);

  useEffect(() => {
    let mounted = true;

    async function search() {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      const found = (await searchInCache(table, query, fields)) as T[];
      if (mounted) setResults(found);
    }

    search();
    return () => {
      mounted = false;
    };
  }, [table, query, fields]);

  return results;
}
