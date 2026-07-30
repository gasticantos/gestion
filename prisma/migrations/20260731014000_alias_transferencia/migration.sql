ALTER TABLE "Configuracion" ADD COLUMN "aliasTransferencia" TEXT;

-- Configuración inicial del negocio actual.
UPDATE "Configuracion"
SET "aliasTransferencia" = 'elmagosrl'
WHERE "negocioId" = 1;
