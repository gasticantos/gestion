-- Los precios de venta siempre se redondean hacia arriba al siguiente múltiplo de 100.
UPDATE "Producto"
SET
  "precioVenta" = CEIL("precioVenta" / 100) * 100,
  "precioVentaMesa" = CEIL("precioVentaMesa" / 100) * 100;
