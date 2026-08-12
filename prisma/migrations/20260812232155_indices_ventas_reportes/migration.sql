-- Índices compuestos para los patrones de consulta reales de Reportes y "Ventas del día":
-- ambos filtran siempre por estado + un rango de fecha (closedAt o createdAt). Sin esto,
-- Postgres solo puede apoyarse en el índice de "estado" y escanear el resto en memoria,
-- lo que se vuelve más lento a medida que crece la tabla de ventas.
CREATE INDEX IF NOT EXISTS "Venta_estado_closedAt_idx" ON "Venta" ("estado", "closedAt");
CREATE INDEX IF NOT EXISTS "Venta_estado_createdAt_idx" ON "Venta" ("estado", "createdAt");
