ALTER TABLE "FacturaProveedorItem"
ADD COLUMN "costoBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "impuestos" JSONB;

-- Las facturas existentes no tenían impuestos separados: su costo final era también el costo base.
UPDATE "FacturaProveedorItem"
SET "costoBase" = "costoUnitario";
