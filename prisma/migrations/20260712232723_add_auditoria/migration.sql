-- Create AuditoriaLog table
CREATE TABLE "AuditoriaLog" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES "Usuario"("id"),
  "accion" TEXT NOT NULL,
  "descripcion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditoriaLog_usuarioId_idx" ON "AuditoriaLog"("usuarioId");
CREATE INDEX "AuditoriaLog_createdAt_idx" ON "AuditoriaLog"("createdAt");
