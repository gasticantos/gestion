-- Add ticketImpreso field to Venta
ALTER TABLE "Venta" ADD COLUMN IF NOT EXISTS "ticketImpreso" BOOLEAN NOT NULL DEFAULT false;
