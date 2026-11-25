-- Combos: un producto puede estar formado por otros productos. Al vender el combo
-- se descuenta el stock de cada componente.
CREATE TABLE "ComboItem" (
    "id" SERIAL NOT NULL,
    "comboId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ComboItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComboItem_comboId_productoId_key" ON "ComboItem"("comboId", "productoId");
CREATE INDEX "ComboItem_productoId_idx" ON "ComboItem"("productoId");

ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
