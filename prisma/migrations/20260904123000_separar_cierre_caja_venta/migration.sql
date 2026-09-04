ALTER TABLE "Venta" ADD COLUMN "cierreCajaAt" TIMESTAMP(3);

-- Hasta esta migración, el cierre reemplazaba closedAt por el último milisegundo
-- de la jornada (el horario cambió históricamente). Conservamos esas ventas como
-- ya archivadas identificando la marca exacta mm:59.999 que usaba ese proceso.
UPDATE "Venta"
SET "cierreCajaAt" = "closedAt"
WHERE "closedAt" IS NOT NULL
  AND EXTRACT(MINUTE FROM ("closedAt" AT TIME ZONE 'America/Argentina/Cordoba')) = 59
  AND EXTRACT(SECOND FROM ("closedAt" AT TIME ZONE 'America/Argentina/Cordoba')) = 59.999;

CREATE INDEX "Venta_negocioId_cierreCajaAt_idx" ON "Venta"("negocioId", "cierreCajaAt");
