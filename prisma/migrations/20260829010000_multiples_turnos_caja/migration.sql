DROP INDEX "ControlCaja_negocioId_fechaJornada_key";
CREATE INDEX "ControlCaja_negocioId_fechaJornada_cerradoAt_idx"
ON "ControlCaja"("negocioId", "fechaJornada", "cerradoAt");
