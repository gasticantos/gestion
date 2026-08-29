CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

CREATE TABLE "ControlCaja" (
  "id" SERIAL NOT NULL,
  "fechaJornada" TEXT NOT NULL,
  "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "efectivoContado" DOUBLE PRECISION,
  "saldoSiguiente" DOUBLE PRECISION,
  "cerradoAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "negocioId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ControlCaja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovimientoCaja" (
  "id" SERIAL NOT NULL,
  "controlCajaId" INTEGER NOT NULL,
  "tipo" "TipoMovimientoCaja" NOT NULL,
  "monto" DOUBLE PRECISION NOT NULL,
  "concepto" TEXT NOT NULL,
  "operador" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ControlCaja_negocioId_fechaJornada_key" ON "ControlCaja"("negocioId", "fechaJornada");
CREATE INDEX "ControlCaja_negocioId_createdAt_idx" ON "ControlCaja"("negocioId", "createdAt");
CREATE INDEX "MovimientoCaja_controlCajaId_createdAt_idx" ON "MovimientoCaja"("controlCajaId", "createdAt");

ALTER TABLE "ControlCaja" ADD CONSTRAINT "ControlCaja_negocioId_fkey"
FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_controlCajaId_fkey"
FOREIGN KEY ("controlCajaId") REFERENCES "ControlCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
