-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "recargoMesaPct" REAL NOT NULL DEFAULT 0,
    "puertaX" REAL NOT NULL DEFAULT 20,
    "puertaY" REAL NOT NULL DEFAULT 20
);
INSERT INTO "new_Configuracion" ("id", "recargoMesaPct") SELECT "id", "recargoMesaPct" FROM "Configuracion";
DROP TABLE "Configuracion";
ALTER TABLE "new_Configuracion" RENAME TO "Configuracion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
