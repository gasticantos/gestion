-- Nombre y logo personalizables para cada negocio.
ALTER TABLE "Configuracion"
ADD COLUMN "nombrePrograma" TEXT NOT NULL DEFAULT 'Gestión',
ADD COLUMN "logoPrograma" TEXT;
