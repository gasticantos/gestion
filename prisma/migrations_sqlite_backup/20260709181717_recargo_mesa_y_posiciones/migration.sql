-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "recargoMesaPct" REAL NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'LIBRE',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Mesa" ("estado", "id", "nombre") SELECT "estado", "id", "nombre" FROM "Mesa";
DROP TABLE "Mesa";
ALTER TABLE "new_Mesa" RENAME TO "Mesa";
CREATE UNIQUE INDEX "Mesa_nombre_key" ON "Mesa"("nombre");
CREATE TABLE "new_Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "mesaId" INTEGER,
    "clienteId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "tarifa" TEXT NOT NULL DEFAULT 'PARTICULAR',
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Venta_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Venta" ("clienteId", "closedAt", "createdAt", "estado", "id", "mesaId", "tipo", "total") SELECT "clienteId", "closedAt", "createdAt", "estado", "id", "mesaId", "tipo", "total" FROM "Venta";
DROP TABLE "Venta";
ALTER TABLE "new_Venta" RENAME TO "Venta";
CREATE INDEX "Venta_mesaId_idx" ON "Venta"("mesaId");
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");
CREATE INDEX "Venta_estado_idx" ON "Venta"("estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
