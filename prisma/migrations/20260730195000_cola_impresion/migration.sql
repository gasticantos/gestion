CREATE TYPE "TipoImpresion" AS ENUM ('TICKET', 'COMANDA', 'PRUEBA');
CREATE TYPE "EstadoImpresion" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'IMPRESO', 'ERROR');

CREATE TABLE "ImpresionTrabajo" (
  "id" SERIAL NOT NULL,
  "tipo" "TipoImpresion" NOT NULL,
  "contenido" TEXT NOT NULL,
  "estado" "EstadoImpresion" NOT NULL DEFAULT 'PENDIENTE',
  "referencia" TEXT,
  "estacionId" TEXT,
  "error" TEXT,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "printedAt" TIMESTAMP(3),
  CONSTRAINT "ImpresionTrabajo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImpresionTrabajo_referencia_key" ON "ImpresionTrabajo"("referencia");
CREATE INDEX "ImpresionTrabajo_estado_createdAt_idx" ON "ImpresionTrabajo"("estado", "createdAt");
