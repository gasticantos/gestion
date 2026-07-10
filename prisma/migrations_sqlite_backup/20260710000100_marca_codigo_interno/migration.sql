-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "codigoInterno" TEXT;
ALTER TABLE "Producto" ADD COLUMN "marca" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoInterno_key" ON "Producto"("codigoInterno");
