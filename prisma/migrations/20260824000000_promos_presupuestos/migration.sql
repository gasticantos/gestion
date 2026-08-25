ALTER TABLE "Producto"
ADD COLUMN "esPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "promoDesde" TIMESTAMP(3),
ADD COLUMN "promoHasta" TIMESTAMP(3);

CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ACEPTADO', 'VENCIDO', 'CANCELADO');

CREATE TABLE "Presupuesto" (
  "id" SERIAL NOT NULL,
  "clienteNombre" TEXT NOT NULL,
  "clienteTelefono" TEXT,
  "validoHasta" TIMESTAMP(3) NOT NULL,
  "descuentoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subtotal" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "notas" TEXT,
  "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "negocioId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresupuestoItem" (
  "id" SERIAL NOT NULL,
  "presupuestoId" INTEGER NOT NULL,
  "productoId" INTEGER,
  "nombre" TEXT NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "subtotal" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "PresupuestoItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Producto_negocioId_esPromo_promoDesde_promoHasta_idx" ON "Producto"("negocioId", "esPromo", "promoDesde", "promoHasta");
CREATE INDEX "Presupuesto_negocioId_createdAt_idx" ON "Presupuesto"("negocioId", "createdAt");
CREATE INDEX "Presupuesto_negocioId_estado_idx" ON "Presupuesto"("negocioId", "estado");
CREATE INDEX "PresupuestoItem_presupuestoId_idx" ON "PresupuestoItem"("presupuestoId");
CREATE INDEX "PresupuestoItem_productoId_idx" ON "PresupuestoItem"("productoId");

ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PresupuestoItem" ADD CONSTRAINT "PresupuestoItem_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresupuestoItem" ADD CONSTRAINT "PresupuestoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
