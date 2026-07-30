-- El margen sugerido para productos nuevos pasa a ser configurable por negocio.
ALTER TABLE "Configuracion"
ADD COLUMN "margenVentaBasePct" DOUBLE PRECISION NOT NULL DEFAULT 30;
