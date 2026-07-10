-- CreateTable
CREATE TABLE "Reserva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "personas" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "mesaId" INTEGER,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reserva_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reserva_fecha_idx" ON "Reserva"("fecha");

-- CreateIndex
CREATE INDEX "Reserva_mesaId_idx" ON "Reserva"("mesaId");
