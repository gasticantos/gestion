La caja permanece activa hasta el cierre manual, independientemente de la fecha.
La última caja creada es la actual; cajas antiguas incompletas no vuelven a activarse.
Ventas y efectivo suman los cobros pendientes posteriores al último cierre
realizado, sin cortes diarios. Los registros históricos incompletos se conservan
y no se suman a un turno nuevo.
El cierre conserva los importes y fechas de cobro, genera un comprobante incluso
sin ventas y no abre otra caja. La apertura siguiente requiere confirmar el saldo.
Las mesas con saldo y el arqueo incompleto siguen bloqueando el cierre manual.

Antes de publicar esta versión:

- Verificar las migraciones pendientes en la base de producción. Esta versión
  requiere `Venta.cierreCajaAt`, introducida por
  `20260904123000_separar_cierre_caja_venta`; la revisión de producción del
  9 de septiembre encontró que esa columna todavía no existía.
- La migración `20260909000000_reconciliar_cierres_historicos` reconoce ventas
  que ya tienen comprobante de cierre histórico, incluidos cierres recuperados,
  para que no reaparezcan en el turno activo. Sólo actualiza la marca de archivo;
  no modifica precios, pagos, mesas ni `closedAt`.
- Revisar el estado de migraciones y los candidatos de archivo antes de aplicar
  cambios. No ejecutar `db push`, un reset, ni reconstruir los datos de producción.
- Publicar la versión y comprobar que Vercel ya no programe el cron. La ruta
  antigua responde 410 sin acceder a la base, incluso ante llamadas residuales.
- Actualizar las pantallas abiertas: ahora cada arqueo/cierre incluye el ID de
  caja, evitando que una pantalla vieja modifique un turno posterior.

La revisión y las pruebas locales no desactivan por sí mismas el cron de la versión
publicada. El comportamiento nuevo entra en vigor al completar el despliegue.

Despliegue completado el 9 de septiembre de 2026:

- Migraciones aplicadas en una transacción, verificando que no cambiaran importes,
  fechas de cobro, pagos, pedidos, mesas ni controles de caja.
- Versión `dpl_9J6sNh3wvERzUxK67tNLLf4jW7sX` promovida a
  `gestion-nu-ten.vercel.app`.
- Vercel confirmó `cronDefinitions: []`; el endpoint anterior devuelve 410.
- La caja #19 continuó abierta con su saldo inicial de $282.600.
- Pasaron 15 pruebas con PostgreSQL temporal, TypeScript, ESLint y el build.

Corrección posterior de Reportes (9 de septiembre de 2026):

- Pantalla, PDF y ticket usan por defecto la caja actual o la última cerrada.
  Los filtros de fechas siguen disponibles como histórico calendario.
- Se verificó con 16 pruebas, incluido el caso de 14 ventas de un turno anterior
  y 2 del siguiente en el mismo día, cierre y nueva apertura sin ventas.
- Versión `dpl_So9y2V7wHtQ8SgrJsjYqJE6cF6MD` promovida correctamente.
  Esta corrección no requiere migraciones ni modifica datos operativos.

Comportamiento revisado por pedido del usuario:

- Caja actual muestra sólo una caja abierta; sin caja abierta devuelve cero.
  Los cierres anteriores se consultan en el historial.
- Los filtros de fechas de Reportes abarcan de 07:00 a 07:00 del día siguiente,
  hora Argentina. Antes de las 07:00, Hoy corresponde al período anterior.
- Ese límite sólo selecciona ventas para el reporte y su serie diaria; no abre,
  cierra ni reinicia cajas. PDF y ticket usan el mismo filtro.
- Pasaron 17 pruebas y la compilación, incluidos ambos extremos del período.
