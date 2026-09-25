-- Renombra el rol existente sin recrear el enum ni perder las asignaciones de usuarios.
ALTER TYPE "Rol" RENAME VALUE 'DUENIO' TO 'ADMIN';

-- Los cierres guardan una copia imprimible del rol. Actualizarla hace que las
-- reimpresiones y los PDF históricos también muestren ADMIN.
UPDATE "ImpresionTrabajo"
SET "contenido" = replace("contenido", ' - DUENIO', ' - ADMIN')
WHERE "contenido" LIKE '% - DUENIO%';

-- Los movimientos de caja también conservan el rol como texto descriptivo.
UPDATE "MovimientoCaja"
SET "operador" = replace("operador", '(DUENIO)', '(ADMIN)')
WHERE "operador" LIKE '%(DUENIO)%';
