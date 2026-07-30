-- Permite que cada negocio trabaje con un único precio de venta.
-- Se mantiene activado para conservar el comportamiento de los negocios existentes.
ALTER TABLE "Configuracion"
ADD COLUMN "precioMesaActivo" BOOLEAN NOT NULL DEFAULT true;
