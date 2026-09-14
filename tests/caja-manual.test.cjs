/* eslint-disable @typescript-eslint/no-require-imports */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const root = path.resolve(__dirname, '..');
let db, server, pool, prisma, cierre, controlRoute, ventasRoute, cronRoute;
let session = { negocioId: 1, nombre: 'Prueba', rol: 'DUENIO' };
let telegramCalls = 0;
let telegramOk = true;
const cache = new Map();

// Run the actual TypeScript services and Prisma queries. Only session and external
// notifications are replaced; this harness never loads .env or connects to Supabase.
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file);
  cache.set(file, m);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  const native = Module.createRequire(file);
  m.require = (name) => {
    if (name === '@/lib/prisma') return { prisma };
    if (name === '@/lib/sesionServidor') return { sesionActual: async () => session };
    if (name === '@/lib/notificarImpresion') return { notificarNuevaImpresion: async () => {} };
    if (name === '@/lib/telegram') return {
      enviarAlertaTelegram: async () => ({ ok: true }),
      enviarDocumentoTelegram: async (pdf) => {
        assert.ok(pdf.byteLength > 1000);
        telegramCalls++;
        return telegramOk ? { ok: true } : { ok: false, error: 'Sin conexión' };
      },
    };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      if (fs.existsSync(target + '.ts')) return load(target + '.ts');
    }
    return native(name);
  };
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href));
  m._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, file);
  return m.exports;
}

before(async () => {
  const schema = fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8');
  assert.ok(schema.includes('CREATE TABLE "Negocio"'));
  db = await PGlite.create();
  await db.exec(schema);
  server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  let port;
  server.addEventListener('listening', (event) => { port = event.detail.port; });
  await Promise.race([
    server.start(),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('No se pudo iniciar el servidor local de pruebas')), 10000); timer.unref(); }),
  ]);
  assert.ok(Number.isInteger(port) && port > 0, 'El puerto debe ser el de la base temporal');
  pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', max: 1 });
  assert.equal((await pool.query('SELECT count(*) AS n FROM "Negocio"')).rows[0].n, '0');
  const { PrismaClient } = load('src/generated/prisma/client.ts');
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  cierre = load('src/lib/cierreCaja.ts').cerrarJornadaCaja;
  controlRoute = load('src/app/api/control-caja/route.ts');
  ventasRoute = load('src/app/api/ventas/route.ts');
  cronRoute = load('src/app/api/cron/cierre-caja/route.ts');
});

after(async () => {
  await prisma?.$disconnect();
  await pool?.end();
  await server?.stop();
  await db?.close();
});

beforeEach(async () => {
  await pool.query('TRUNCATE "Negocio" RESTART IDENTITY CASCADE');
  await prisma.negocio.create({ data: { id: 1, nombre: 'Prueba' } });
  await prisma.negocio.create({ data: { id: 2, nombre: 'Otro negocio' } });
  session = { negocioId: 1, nombre: 'Prueba', rol: 'DUENIO' };
  telegramCalls = 0;
  telegramOk = true;
});

const request = (body) => new Request('http://localhost/api/control-caja', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
async function open(data = {}) {
  return prisma.controlCaja.create({ data: {
    negocioId: 1, fechaJornada: '2026-09-07', createdAt: new Date('2026-09-07T12:00:00Z'),
    saldoInicial: 100, efectivoContado: 150, saldoSiguiente: 100, ...data,
  } });
}
async function sale(data = {}) {
  return prisma.venta.create({ data: {
    negocioId: 1, tipo: 'MOSTRADOR', estado: 'CERRADA', total: 50,
    closedAt: new Date('2026-09-07T23:00:00Z'),
    pagos: { create: { metodo: 'EFECTIVO', monto: 50 } }, ...data,
  } });
}
const close = (id) => cierre({ negocioId: 1, controlCajaId: id, operador: { nombre: 'Prueba', rol: 'DUENIO' } });

test('reportes separa turnos del mismo día y muestra cero sin caja abierta', async () => {
  const { consultarReporte } = load('src/lib/consultaReportes.ts');
  const corte = new Date('2026-09-09T10:10:00Z');
  await open({ cerradoAt: corte });
  for (let i = 0; i < 14; i++) await sale({ closedAt: new Date('2026-09-09T09:59:00Z'), cierreCajaAt: corte });
  const actual = await open({ fechaJornada: '2026-09-09', createdAt: corte });
  for (let i = 0; i < 2; i++) await sale({ closedAt: new Date('2026-09-09T10:11:00Z') });
  await sale({ negocioId: 2, closedAt: new Date('2026-09-09T10:11:00Z') });
  const cliente = await prisma.cliente.create({ data: { negocioId: 1, nombre: 'Cuenta corriente' } });
  await prisma.movimientoCuentaCorriente.create({ data: {
    clienteId: cliente.id, tipo: 'PAGO', metodo: 'TRANSFERENCIA', monto: 120,
    createdAt: new Date('2026-09-09T10:12:00Z'),
  } });
  const clienteOtro = await prisma.cliente.create({ data: { negocioId: 2, nombre: 'Otro cliente' } });
  await prisma.movimientoCuentaCorriente.create({ data: {
    clienteId: clienteOtro.id, tipo: 'PAGO', metodo: 'EFECTIVO', monto: 999,
    createdAt: new Date('2026-09-09T10:12:00Z'),
  } });
  const antes = await prisma.venta.findMany({ orderBy: { id: 'asc' } });
  const reporte = await consultarReporte(new URLSearchParams(), 1);
  assert.equal(reporte.caja.id, actual.id);
  assert.equal(reporte.cantidadVentas, 2);
  assert.equal(reporte.combinado.total, 100);
  assert.deepEqual(reporte.cobrosCuentaCorriente, {
    cantidad: 1, total: 120, porMetodo: { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 120 },
  });
  const calendario = await consultarReporte(new URLSearchParams({ desde: '2026-09-09', hasta: '2026-09-09' }), 1);
  assert.equal(calendario.cantidadVentas, 2);
  assert.deepEqual(await prisma.venta.findMany({ orderBy: { id: 'asc' } }), antes);
  assert.equal((await close(actual.id)).estado, 'CERRADO');
  assert.match((await prisma.impresionTrabajo.findFirst({ orderBy: { id: 'desc' } })).contenido, /COBROS CC TRANSFERENCIA.*\$120,00/);
  const cerrada = await consultarReporte(new URLSearchParams({ modo: 'caja' }), 1);
  assert.equal(cerrada.cantidadVentas, 0);
  assert.equal(cerrada.caja, null);
  const route = load('src/app/api/reportes/route.ts');
  const json = await (await route.GET(new Request('http://localhost/api/reportes?modo=caja'))).json();
  assert.equal(json.cantidadVentas, 0);
  const pdfRoute = load('src/app/api/reportes/pdf/route.ts');
  const pdf = await pdfRoute.GET(new Request('http://localhost/api/reportes/pdf?modo=caja'));
  assert.equal(pdf.status, 200);
  assert.match(Buffer.from(await pdf.arrayBuffer()).toString('latin1'), /Sin caja abierta/);
  const nueva = await open();
  const vacia = await consultarReporte(new URLSearchParams(), 1);
  assert.equal(vacia.caja.id, nueva.id);
  assert.equal(vacia.cantidadVentas, 0);
});

test('una caja abierta y sus ventas siguen visibles al pasar medianoche, las 7 y varios días', async () => {
  const box = await open();
  for (const time of ['2026-09-07T23:59:00-03:00', '2026-09-08T06:59:59-03:00', '2026-09-08T07:00:00-03:00', '2026-09-10T18:00:00-03:00']) await sale({ closedAt: new Date(time) });
  await sale({ negocioId: 2 });
  await sale({ cierreCajaAt: new Date() });
  const cliente = await prisma.cliente.create({ data: { negocioId: 1, nombre: 'Cobro efectivo' } });
  await prisma.movimientoCuentaCorriente.create({ data: {
    clienteId: cliente.id, tipo: 'PAGO', metodo: 'EFECTIVO', monto: 30,
    createdAt: new Date('2026-09-08T12:00:00Z'),
  } });
  const estado = await (await controlRoute.GET()).json();
  assert.equal(estado.control.id, box.id);
  assert.equal(estado.fechaJornada, '2026-09-07');
  assert.equal(estado.ventasEfectivo, 200);
  assert.equal(estado.cobrosCuentaCorrienteEfectivo, 30);
  assert.equal(estado.efectivoEsperado, 330);
  assert.equal((await (await ventasRoute.GET()).json()).length, 4);
  assert.equal(await prisma.impresionTrabajo.count(), 0);
});

test('el endpoint antiguo de cron nunca consulta ni cierra la caja', async () => {
  const box = await open(); await sale();
  assert.equal((await cronRoute.GET()).status, 410);
  assert.equal((await prisma.controlCaja.findUnique({ where: { id: box.id } })).cerradoAt, null);
  assert.equal(await prisma.impresionTrabajo.count(), 0);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
  assert.equal(config.crons, undefined);
});

test('cierre manual archiva el turno completo sin alterar importes, fechas de cobro u otro negocio', async () => {
  const box = await open(); const first = await sale();
  const later = await sale({ closedAt: new Date('2026-09-10T12:00:00Z') });
  const other = await sale({ negocioId: 2 });
  const result = await close(box.id);
  assert.equal(result.estado, 'CERRADO'); assert.equal(result.cantidadVentas, 2); assert.equal(result.total, 100);
  assert.equal(result.codigo, 'CJ-20260907-00001');
  const comprobante = await prisma.impresionTrabajo.findFirst({ where: { referencia: { startsWith: 'cierre-caja:' } } });
  assert.match(comprobante.contenido, /\[\[HERO\]\] CJ-20260907-00001/);
  for (const original of [first, later]) {
    const updated = await prisma.venta.findUnique({ where: { id: original.id } });
    assert.ok(updated.cierreCajaAt);
    assert.deepEqual({ ...updated, cierreCajaAt: null }, original);
  }
  assert.deepEqual(await prisma.venta.findUnique({ where: { id: other.id } }), other);
  assert.equal(await prisma.controlCaja.count({ where: { cerradoAt: null, negocioId: 1 } }), 0);
  assert.equal(telegramCalls, 1);
});

test('dos solicitudes del mismo cierre generan un solo comprobante y un solo envío', async () => {
  const box = await open(); await sale();
  const results = await Promise.all([close(box.id), close(box.id)]);
  assert.deepEqual(results.map(r => r.estado).sort(), ['CERRADO', 'YA_CERRADO']);
  assert.equal(await prisma.impresionTrabajo.count(), 1); assert.equal(telegramCalls, 1);
});

test('una venta que coincide con el cierre se archiva o queda visible, nunca se pierde', async () => {
  const box = await open({ efectivoContado: 100 });
  const product = await prisma.producto.create({ data: {
    negocioId: 1, nombre: 'Producto', precioVenta: 50, precioCosto: 10, stock: 10,
  } });
  const [response, result] = await Promise.all([
    ventasRoute.POST(request({ items: [{ productoId: product.id, cantidad: 1 }], pagos: [{ metodo: 'EFECTIVO', monto: 50 }] })),
    close(box.id),
  ]);
  assert.equal(response.status, 201);
  assert.equal(result.estado, 'CERRADO');
  const pending = await (await ventasRoute.GET()).json();
  assert.equal(result.total + pending.reduce((sum, v) => sum + v.total, 0), 50);
  assert.equal(await prisma.venta.count(), 1);
});

test('mesas abiertas bloquean el cierre manual y permanecen intactas', async () => {
  const box = await open();
  const mesa = await prisma.mesa.create({ data: { negocioId: 1, nombre: 'Mesa 1', numero: 1, estado: 'OCUPADA' } });
  const venta = await sale({ estado: 'ABIERTA', closedAt: null, mesaId: mesa.id, tipo: 'MESA', pagos: undefined });
  assert.equal((await close(box.id)).estado, 'MESAS_ABIERTAS');
  assert.deepEqual(await prisma.mesa.findUnique({ where: { id: mesa.id } }), mesa);
  assert.deepEqual(await prisma.venta.findUnique({ where: { id: venta.id } }), venta);
  assert.equal(await prisma.impresionTrabajo.count(), 0);
});

test('sin arqueo no se cierra ni se fabrica efectivo contado', async () => {
  const box = await open({ efectivoContado: null, saldoSiguiente: null }); await sale();
  assert.equal((await close(box.id)).estado, 'ARQUEO_PENDIENTE');
  assert.deepEqual(await prisma.controlCaja.findUnique({ where: { id: box.id } }), box);
});

test('una caja antigua incompleta no reaparece al cerrar el turno actual', async () => {
  const old = await open({ efectivoContado: null, saldoSiguiente: null });
  const current = await open(); await sale();
  assert.equal((await close(old.id)).estado, 'CAJA_NO_ABIERTA');
  assert.equal((await close(current.id)).estado, 'CERRADO');
  assert.equal((await (await controlRoute.GET()).json()).iniciado, false);
  assert.equal((await controlRoute.POST(request({ accion: 'iniciar', saldoInicial: 200 }))).status, 200);
  assert.deepEqual(await prisma.controlCaja.findUnique({ where: { id: old.id } }), old);
});

test('ventas históricas sin marca no se suman otra vez después de un cierre realizado', async () => {
  const historical = await sale();
  await open({ cerradoAt: new Date('2026-09-08T10:00:00Z') });
  const current = await open({ fechaJornada: '2026-09-08' });
  const currentSale = await sale({ closedAt: new Date('2026-09-09T04:00:00Z') });
  assert.equal((await (await controlRoute.GET()).json()).ventasEfectivo, 50);
  assert.deepEqual((await (await ventasRoute.GET()).json()).map(v => v.id), [currentSale.id]);
  assert.equal((await close(current.id)).cantidadVentas, 1);
  assert.deepEqual(await prisma.venta.findUnique({ where: { id: historical.id } }), historical);
});

test('se puede cerrar una caja sin ventas y la próxima requiere apertura manual', async () => {
  const box = await open({ efectivoContado: 100 });
  assert.equal((await close(box.id)).estado, 'CERRADO');
  assert.equal((await (await controlRoute.GET()).json()).iniciado, false);
  assert.equal((await controlRoute.POST(request({ accion: 'iniciar', saldoInicial: 70 }))).status, 200);
  const next = await (await controlRoute.GET()).json();
  assert.notEqual(next.control.id, box.id); assert.equal(next.saldoInicial, 70);
  assert.equal((await close(box.id)).estado, 'YA_CERRADO');
  assert.equal((await prisma.controlCaja.findUnique({ where: { id: next.control.id } })).cerradoAt, null);
});

test('abrir dos veces no reinicia el saldo ni duplica la caja', async () => {
  const results = await Promise.all([
    controlRoute.POST(request({ accion: 'iniciar', saldoInicial: 100 })),
    controlRoute.POST(request({ accion: 'iniciar', saldoInicial: 900 })),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(await prisma.controlCaja.count(), 1);
});

test('un arqueo enviado desde una pantalla vieja no cambia la siguiente caja', async () => {
  const box = await open(); await close(box.id);
  const next = await open({ efectivoContado: null, saldoSiguiente: null });
  const response = await controlRoute.POST(request({ accion: 'arqueo', controlCajaId: box.id, efectivoContado: 999, saldoSiguiente: 999 }));
  assert.equal(response.status, 409);
  assert.deepEqual(await prisma.controlCaja.findUnique({ where: { id: next.id } }), next);
});

test('un fallo de Telegram no revierte ni duplica un cierre guardado', async () => {
  const box = await open(); await sale(); telegramOk = false;
  const result = await close(box.id);
  assert.equal(result.estado, 'CERRADO'); assert.equal(result.telegramEnviado, false);
  assert.equal((await close(box.id)).estado, 'YA_CERRADO');
  assert.equal(await prisma.impresionTrabajo.count(), 1);
});

test('los helpers calendario conservan las fechas civiles para usos ajenos al reporte', () => {
  const { limitesRangoFechasArgentina, fechaArgentinaYMD } = load('src/lib/formato.ts');
  const range = limitesRangoFechasArgentina('2026-09-08', '2026-09-08');
  assert.equal(range.desde.toISOString(), '2026-09-08T03:00:00.000Z');
  assert.equal(range.hasta.toISOString(), '2026-09-09T02:59:59.999Z');
  assert.equal(fechaArgentinaYMD(new Date('2026-09-08T05:00:00Z')), '2026-09-08');
});

test('la reconciliación histórica sólo archiva ventas respaldadas por un cierre anterior', async () => {
  const historical = await sale();
  const anotherBusiness = await sale({ negocioId: 2 });
  const today = await sale({ closedAt: new Date('2026-09-09T14:00:00Z') });
  const laterSameDay = await sale();
  await prisma.impresionTrabajo.create({ data: {
    negocioId: 1, tipo: 'TICKET', contenido: 'Cierre recuperado',
    referencia: `cierre-caja:2026-09-07:hasta-venta:${historical.id}`,
  } });
  const sql = fs.readFileSync(path.join(root, 'prisma/migrations/20260909000000_reconciliar_cierres_historicos/migration.sql'), 'utf8');
  await pool.query(sql);
  const archived = await prisma.venta.findUnique({ where: { id: historical.id } });
  assert.ok(archived.cierreCajaAt);
  assert.deepEqual({ ...archived, cierreCajaAt: null }, historical);
  for (const original of [anotherBusiness, today, laterSameDay]) {
    assert.deepEqual(await prisma.venta.findUnique({ where: { id: original.id } }), original);
  }
  await pool.query(sql);
  assert.deepEqual(await prisma.venta.findUnique({ where: { id: historical.id } }), archived);
});

 test('reporte de 07 a 07 incluye madrugada siguiente y excluye límites vecinos', async () => {
  const { consultarReporte } = load('src/lib/consultaReportes.ts');
  const { fechaReporteYMD } = load('src/lib/formato.ts');
  assert.equal(fechaReporteYMD(new Date('2026-09-09T09:59:59Z')), '2026-09-08');
  assert.equal(fechaReporteYMD(new Date('2026-09-09T10:00:00Z')), '2026-09-09');
  for (const time of ['2026-09-09T09:59:59.999Z', '2026-09-09T10:00:00Z', '2026-09-10T09:59:59.999Z', '2026-09-10T10:00:00Z']) await sale({ closedAt: new Date(time) });
  const before = await prisma.venta.findMany();
  const r = await consultarReporte(new URLSearchParams({ desde: '2026-09-09', hasta: '2026-09-09' }), 1);
  assert.equal(r.cantidadVentas, 2);
  assert.equal(r.combinado.total, 100);
  assert.deepEqual(r.serieDiaria, [{ fecha: '2026-09-09', total: 100 }]);
  assert.deepEqual(await prisma.venta.findMany(), before);
  assert.equal(await prisma.controlCaja.count(), 0);
});
