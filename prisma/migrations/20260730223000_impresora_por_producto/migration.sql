-- Cada producto puede dirigir sus comandas a una impresora específica.
-- Los valores NULL continúan usando la impresora predeterminada del dispositivo.
ALTER TABLE "Producto" ADD COLUMN "impresora" TEXT;
ALTER TABLE "ImpresionTrabajo" ADD COLUMN "impresora" TEXT;

CREATE INDEX "Producto_negocioId_impresora_idx" ON "Producto"("negocioId", "impresora");
CREATE INDEX "ImpresionTrabajo_negocioId_estado_impresora_createdAt_idx"
ON "ImpresionTrabajo"("negocioId", "estado", "impresora", "createdAt");
