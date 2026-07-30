-- Conserva quién generó cada pedido para mostrarlo en las comandas.
ALTER TABLE "Pedido" ADD COLUMN "creadoPorId" INTEGER;

CREATE INDEX "Pedido_creadoPorId_idx" ON "Pedido"("creadoPorId");

ALTER TABLE "Pedido"
ADD CONSTRAINT "Pedido_creadoPorId_fkey"
FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
