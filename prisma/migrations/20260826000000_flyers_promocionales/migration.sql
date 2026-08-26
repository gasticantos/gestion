CREATE TABLE "Flyer" (
  "id" SERIAL NOT NULL,
  "imagen" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "negocioId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Flyer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Flyer_negocioId_createdAt_idx" ON "Flyer"("negocioId", "createdAt");

ALTER TABLE "Flyer"
ADD CONSTRAINT "Flyer_negocioId_fkey"
FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
