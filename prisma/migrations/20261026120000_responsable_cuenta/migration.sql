ALTER TABLE "Venta" ADD COLUMN "responsableCuentaId" INTEGER;
ALTER TABLE "Venta" ADD COLUMN "responsableCuentaNombre" TEXT;

CREATE INDEX "Venta_responsableCuentaId_idx" ON "Venta"("responsableCuentaId");

ALTER TABLE "Venta"
ADD CONSTRAINT "Venta_responsableCuentaId_fkey"
FOREIGN KEY ("responsableCuentaId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
