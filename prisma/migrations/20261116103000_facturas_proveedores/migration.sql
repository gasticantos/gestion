CREATE TYPE "EstadoFacturaProveedor" AS ENUM ('PAGADA', 'CUENTA_CORRIENTE');

CREATE TABLE "FacturaProveedor" (
  "id" SERIAL NOT NULL,
  "proveedorId" INTEGER NOT NULL,
  "numero" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "saldo" DOUBLE PRECISION NOT NULL,
  "estado" "EstadoFacturaProveedor" NOT NULL DEFAULT 'CUENTA_CORRIENTE',
  "comprobante" TEXT,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "negocioId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "FacturaProveedor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FacturaProveedorItem" (
  "id" SERIAL NOT NULL,
  "facturaId" INTEGER NOT NULL,
  "productoId" INTEGER NOT NULL,
  "productoNombre" TEXT NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "costoAnterior" DOUBLE PRECISION NOT NULL,
  "costoUnitario" DOUBLE PRECISION NOT NULL,
  "precioVentaAnterior" DOUBLE PRECISION NOT NULL,
  "precioVentaSugerido" DOUBLE PRECISION,
  "requiereAumento" BOOLEAN NOT NULL DEFAULT false,
  "precioActualizado" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "FacturaProveedorItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PagoProveedor" (
  "id" SERIAL NOT NULL,
  "proveedorId" INTEGER NOT NULL,
  "facturaId" INTEGER,
  "monto" DOUBLE PRECISION NOT NULL,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "negocioId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FacturaProveedor_negocioId_fecha_idx" ON "FacturaProveedor"("negocioId", "fecha");
CREATE INDEX "FacturaProveedor_proveedorId_saldo_idx" ON "FacturaProveedor"("proveedorId", "saldo");
CREATE INDEX "FacturaProveedorItem_facturaId_idx" ON "FacturaProveedorItem"("facturaId");
CREATE INDEX "FacturaProveedorItem_productoId_idx" ON "FacturaProveedorItem"("productoId");
CREATE INDEX "PagoProveedor_negocioId_createdAt_idx" ON "PagoProveedor"("negocioId", "createdAt");
CREATE INDEX "PagoProveedor_proveedorId_idx" ON "PagoProveedor"("proveedorId");
CREATE INDEX "PagoProveedor_facturaId_idx" ON "PagoProveedor"("facturaId");

ALTER TABLE "FacturaProveedor" ADD CONSTRAINT "FacturaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaProveedor" ADD CONSTRAINT "FacturaProveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaProveedorItem" ADD CONSTRAINT "FacturaProveedorItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacturaProveedorItem" ADD CONSTRAINT "FacturaProveedorItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
