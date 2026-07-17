-- Add precio de venta mesa (per-product, editable, defaults to venta + costo*recargoMesaPct%)
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "precioVentaMesa" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "precioVentaMesaManual" BOOLEAN NOT NULL DEFAULT false;
