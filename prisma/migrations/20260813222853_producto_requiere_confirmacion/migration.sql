-- Marca productos (típicamente comida) que deben acumularse como pendientes en una mesa
-- y enviarse/imprimirse juntos en una sola comanda, en vez de imprimir apenas se agregan.
ALTER TABLE "Producto" ADD COLUMN "requiereConfirmacion" BOOLEAN NOT NULL DEFAULT false;
