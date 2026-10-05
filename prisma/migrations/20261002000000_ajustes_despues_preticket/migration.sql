CREATE TABLE "AjustePreticket" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "usuarioId" INTEGER,
    "usuarioNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjustePreticket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AjustePreticket_ventaId_createdAt_idx" ON "AjustePreticket"("ventaId", "createdAt");
CREATE INDEX "AjustePreticket_usuarioId_idx" ON "AjustePreticket"("usuarioId");

ALTER TABLE "AjustePreticket"
ADD CONSTRAINT "AjustePreticket_ventaId_fkey"
FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AjustePreticket"
ADD CONSTRAINT "AjustePreticket_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
