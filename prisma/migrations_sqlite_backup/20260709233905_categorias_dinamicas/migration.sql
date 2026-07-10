/*
  Warnings:

  - You are about to drop the column `categoria` on the `Producto` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "categoriaId" INTEGER,
    "precioVenta" REAL NOT NULL,
    "precioCosto" REAL NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "proveedorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Producto" ("activo", "codigoBarras", "createdAt", "id", "nombre", "precioCosto", "precioVenta", "proveedorId", "stock", "unidad", "updatedAt") SELECT "activo", "codigoBarras", "createdAt", "id", "nombre", "precioCosto", "precioVenta", "proveedorId", "stock", "unidad", "updatedAt" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");
