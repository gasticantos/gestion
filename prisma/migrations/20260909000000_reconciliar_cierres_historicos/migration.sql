-- Los cierres recuperados con la versión anterior no siempre desplazaban closedAt
-- al corte horario. Reconocer exclusivamente ventas respaldadas por un comprobante
-- histórico evita que reaparezcan como pendientes al quitar el filtro diario.
-- No se cambian importes, pagos, mesas ni fechas de cobro.
WITH referencias AS (
  SELECT "negocioId", "createdAt",
    regexp_match(referencia, '^cierre-caja:([0-9]{4}-[0-9]{2}-[0-9]{2}):hasta-venta:([0-9]+)$') AS partes
  FROM "ImpresionTrabajo"
), cierres AS (
  SELECT "negocioId", "createdAt", partes[2]::integer AS "ultimaVentaId",
    ((partes[1]::date + time '07:00') AT TIME ZONE 'America/Argentina/Cordoba') AT TIME ZONE 'UTC' AS desde
  FROM referencias WHERE partes IS NOT NULL
)
UPDATE "Venta" v
SET "cierreCajaAt" = c."createdAt"
FROM cierres c
WHERE v."negocioId" = c."negocioId"
  AND v.estado = 'CERRADA'
  AND v."cierreCajaAt" IS NULL
  AND v.id <= c."ultimaVentaId"
  AND v."closedAt" >= c.desde
  AND v."closedAt" < c.desde + interval '1 day';
