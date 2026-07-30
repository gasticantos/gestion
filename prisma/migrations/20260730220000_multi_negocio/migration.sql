CREATE TABLE "Negocio" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Negocio" ("nombre") VALUES ('Negocio principal');

ALTER TABLE "Categoria" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Usuario" ADD COLUMN "authId" UUID;
ALTER TABLE "Usuario" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Configuracion" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ImpresionTrabajo" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AuditoriaLog" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Proveedor" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Producto" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StockEntry" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Mesa" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reserva" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Venta" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Cliente" ADD COLUMN "negocioId" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Categoria" DROP CONSTRAINT IF EXISTS "Categoria_nombre_key";
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_codigoInterno_key";
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_codigoBarras_key";
ALTER TABLE "Mesa" DROP CONSTRAINT IF EXISTS "Mesa_nombre_key";
ALTER TABLE "Mesa" DROP CONSTRAINT IF EXISTS "Mesa_numero_key";
ALTER TABLE "ImpresionTrabajo" DROP CONSTRAINT IF EXISTS "ImpresionTrabajo_referencia_key";

CREATE UNIQUE INDEX "Categoria_negocioId_nombre_key" ON "Categoria"("negocioId", "nombre");
CREATE UNIQUE INDEX "Usuario_authId_key" ON "Usuario"("authId");
CREATE UNIQUE INDEX "Configuracion_negocioId_key" ON "Configuracion"("negocioId");
CREATE UNIQUE INDEX "Producto_negocioId_codigoInterno_key" ON "Producto"("negocioId", "codigoInterno");
CREATE UNIQUE INDEX "Producto_negocioId_codigoBarras_key" ON "Producto"("negocioId", "codigoBarras");
CREATE UNIQUE INDEX "Mesa_negocioId_nombre_key" ON "Mesa"("negocioId", "nombre");
CREATE UNIQUE INDEX "Mesa_negocioId_numero_key" ON "Mesa"("negocioId", "numero");
CREATE UNIQUE INDEX "ImpresionTrabajo_negocioId_referencia_key" ON "ImpresionTrabajo"("negocioId", "referencia");

CREATE INDEX "Categoria_negocioId_idx" ON "Categoria"("negocioId");
CREATE INDEX "Usuario_negocioId_idx" ON "Usuario"("negocioId");
CREATE INDEX "AuditoriaLog_negocioId_idx" ON "AuditoriaLog"("negocioId");
CREATE INDEX "Proveedor_negocioId_idx" ON "Proveedor"("negocioId");
CREATE INDEX "Producto_negocioId_idx" ON "Producto"("negocioId");
CREATE INDEX "StockEntry_negocioId_idx" ON "StockEntry"("negocioId");
CREATE INDEX "Mesa_negocioId_idx" ON "Mesa"("negocioId");
CREATE INDEX "Reserva_negocioId_idx" ON "Reserva"("negocioId");
CREATE INDEX "Venta_negocioId_idx" ON "Venta"("negocioId");
CREATE INDEX "Cliente_negocioId_idx" ON "Cliente"("negocioId");
DROP INDEX IF EXISTS "ImpresionTrabajo_estado_createdAt_idx";
CREATE INDEX "ImpresionTrabajo_negocioId_estado_createdAt_idx" ON "ImpresionTrabajo"("negocioId", "estado", "createdAt");

ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImpresionTrabajo" ADD CONSTRAINT "ImpresionTrabajo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaLog" ADD CONSTRAINT "AuditoriaLog_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
