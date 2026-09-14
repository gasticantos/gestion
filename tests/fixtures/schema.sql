-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENIO', 'CAJERO', 'MOZO');

-- CreateEnum
CREATE TYPE "TipoStockEntry" AS ENUM ('ENTRADA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('LIBRE', 'OCUPADA');

-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('MOSTRADOR', 'MESA');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'FIADO');

-- CreateEnum
CREATE TYPE "TipoTarjeta" AS ENUM ('QR', 'DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "TipoMovimientoCC" AS ENUM ('CARGO', 'PAGO', 'INTERES');

-- CreateEnum
CREATE TYPE "TarifaPrecio" AS ENUM ('PARTICULAR', 'MESA');

-- CreateEnum
CREATE TYPE "TipoImpresion" AS ENUM ('TICKET', 'COMANDA', 'PRUEBA');

-- CreateEnum
CREATE TYPE "EstadoImpresion" AS ENUM ('PENDIENTE', 'IMPRIMIENDO', 'IMPRESO', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('BORRADOR', 'ACEPTADO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'CUMPLIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateTable
CREATE TABLE "Negocio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flyer" (
    "id" SERIAL NOT NULL,
    "imagen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Flyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "negocioId" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authId" UUID,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MOZO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" SERIAL NOT NULL,
    "negocioId" INTEGER NOT NULL DEFAULT 1,
    "margenVentaBasePct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "nombrePrograma" TEXT NOT NULL DEFAULT 'Gestión',
    "logoPrograma" TEXT,
    "aliasTransferencia" TEXT,
    "estacionImpresionId" TEXT,
    "precioMesaActivo" BOOLEAN NOT NULL DEFAULT true,
    "recargoMesaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpresionTrabajo" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoImpresion" NOT NULL,
    "contenido" TEXT NOT NULL,
    "impresora" TEXT,
    "estado" "EstadoImpresion" NOT NULL DEFAULT 'PENDIENTE',
    "referencia" TEXT,
    "estacionId" TEXT,
    "error" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ImpresionTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaLog" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AuditoriaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "contacto" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "codigoBarras" TEXT,
    "marca" TEXT,
    "categoriaId" INTEGER,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "precioVentaMesa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioVentaMesaManual" BOOLEAN NOT NULL DEFAULT false,
    "precioCosto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "impresora" TEXT,
    "requiereConfirmacion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esPromo" BOOLEAN NOT NULL DEFAULT false,
    "promoDesde" TIMESTAMP(3),
    "promoHasta" TIMESTAMP(3),
    "proveedorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" SERIAL NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT,
    "validoHasta" TIMESTAMP(3) NOT NULL,
    "descuentoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoItem" (
    "id" SERIAL NOT NULL,
    "presupuestoId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "nombre" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PresupuestoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER,
    "tipo" "TipoStockEntry" NOT NULL DEFAULT 'ENTRADA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntryItem" (
    "id" SERIAL NOT NULL,
    "stockEntryId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockEntryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "apodo" TEXT,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'LIBRE',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ancho" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "alto" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "personas" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "mesaId" INTEGER,
    "notas" TEXT,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoVenta" NOT NULL,
    "mesaId" INTEGER,
    "clienteId" INTEGER,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'ABIERTA',
    "tarifa" "TarifaPrecio" NOT NULL DEFAULT 'PARTICULAR',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoResponsable" TEXT,
    "propina" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "borradorRonda" JSONB,
    "ticketImpreso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "cierreCajaAt" TIMESTAMP(3),
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "creadoPorId" INTEGER,
    "comandaImpresa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "tipoTarjeta" "TipoTarjeta",
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlCaja" (
    "id" SERIAL NOT NULL,
    "fechaJornada" TEXT NOT NULL,
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectivoContado" DOUBLE PRECISION,
    "saldoSiguiente" DOUBLE PRECISION,
    "cerradoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ControlCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "controlCajaId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "operador" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "negocioId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCuentaCorriente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCC" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodo" "MetodoPago",
    "ventaId" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuentaCorriente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flyer_negocioId_createdAt_idx" ON "Flyer"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "Categoria_negocioId_idx" ON "Categoria"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_negocioId_nombre_key" ON "Categoria"("negocioId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_authId_key" ON "Usuario"("authId");

-- CreateIndex
CREATE INDEX "Usuario_negocioId_idx" ON "Usuario"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_negocioId_key" ON "Configuracion"("negocioId");

-- CreateIndex
CREATE INDEX "ImpresionTrabajo_negocioId_estado_createdAt_idx" ON "ImpresionTrabajo"("negocioId", "estado", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImpresionTrabajo_negocioId_referencia_key" ON "ImpresionTrabajo"("negocioId", "referencia");

-- CreateIndex
CREATE INDEX "AuditoriaLog_usuarioId_idx" ON "AuditoriaLog"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditoriaLog_createdAt_idx" ON "AuditoriaLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditoriaLog_negocioId_idx" ON "AuditoriaLog"("negocioId");

-- CreateIndex
CREATE INDEX "Proveedor_negocioId_idx" ON "Proveedor"("negocioId");

-- CreateIndex
CREATE INDEX "Producto_negocioId_idx" ON "Producto"("negocioId");

-- CreateIndex
CREATE INDEX "Producto_negocioId_esPromo_promoDesde_promoHasta_idx" ON "Producto"("negocioId", "esPromo", "promoDesde", "promoHasta");

-- CreateIndex
CREATE INDEX "Producto_negocioId_impresora_idx" ON "Producto"("negocioId", "impresora");

-- CreateIndex
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_negocioId_codigoInterno_key" ON "Producto"("negocioId", "codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_negocioId_codigoBarras_key" ON "Producto"("negocioId", "codigoBarras");

-- CreateIndex
CREATE INDEX "Presupuesto_negocioId_createdAt_idx" ON "Presupuesto"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "Presupuesto_negocioId_estado_idx" ON "Presupuesto"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "PresupuestoItem_presupuestoId_idx" ON "PresupuestoItem"("presupuestoId");

-- CreateIndex
CREATE INDEX "PresupuestoItem_productoId_idx" ON "PresupuestoItem"("productoId");

-- CreateIndex
CREATE INDEX "StockEntry_negocioId_idx" ON "StockEntry"("negocioId");

-- CreateIndex
CREATE INDEX "StockEntry_proveedorId_idx" ON "StockEntry"("proveedorId");

-- CreateIndex
CREATE INDEX "StockEntryItem_stockEntryId_idx" ON "StockEntryItem"("stockEntryId");

-- CreateIndex
CREATE INDEX "StockEntryItem_productoId_idx" ON "StockEntryItem"("productoId");

-- CreateIndex
CREATE INDEX "Mesa_negocioId_idx" ON "Mesa"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_negocioId_nombre_key" ON "Mesa"("negocioId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_negocioId_numero_key" ON "Mesa"("negocioId", "numero");

-- CreateIndex
CREATE INDEX "Reserva_negocioId_idx" ON "Reserva"("negocioId");

-- CreateIndex
CREATE INDEX "Reserva_fecha_idx" ON "Reserva"("fecha");

-- CreateIndex
CREATE INDEX "Reserva_mesaId_idx" ON "Reserva"("mesaId");

-- CreateIndex
CREATE INDEX "Venta_negocioId_idx" ON "Venta"("negocioId");

-- CreateIndex
CREATE INDEX "Venta_mesaId_idx" ON "Venta"("mesaId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

-- CreateIndex
CREATE INDEX "Venta_estado_idx" ON "Venta"("estado");

-- CreateIndex
CREATE INDEX "Venta_estado_closedAt_idx" ON "Venta"("estado", "closedAt");

-- CreateIndex
CREATE INDEX "Venta_negocioId_cierreCajaAt_idx" ON "Venta"("negocioId", "cierreCajaAt");

-- CreateIndex
CREATE INDEX "Venta_estado_createdAt_idx" ON "Venta"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "Pedido_ventaId_idx" ON "Pedido"("ventaId");

-- CreateIndex
CREATE INDEX "Pedido_creadoPorId_idx" ON "Pedido"("creadoPorId");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_productoId_idx" ON "PedidoItem"("productoId");

-- CreateIndex
CREATE INDEX "Pago_ventaId_idx" ON "Pago"("ventaId");

-- CreateIndex
CREATE INDEX "ControlCaja_negocioId_fechaJornada_cerradoAt_idx" ON "ControlCaja"("negocioId", "fechaJornada", "cerradoAt");

-- CreateIndex
CREATE INDEX "ControlCaja_negocioId_createdAt_idx" ON "ControlCaja"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoCaja_controlCajaId_createdAt_idx" ON "MovimientoCaja"("controlCajaId", "createdAt");

-- CreateIndex
CREATE INDEX "Cliente_negocioId_idx" ON "Cliente"("negocioId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaCorriente_clienteId_idx" ON "MovimientoCuentaCorriente"("clienteId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaCorriente_ventaId_idx" ON "MovimientoCuentaCorriente"("ventaId");

-- AddForeignKey
ALTER TABLE "Flyer" ADD CONSTRAINT "Flyer_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpresionTrabajo" ADD CONSTRAINT "ImpresionTrabajo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaLog" ADD CONSTRAINT "AuditoriaLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaLog" ADD CONSTRAINT "AuditoriaLog_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoItem" ADD CONSTRAINT "PresupuestoItem_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoItem" ADD CONSTRAINT "PresupuestoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntryItem" ADD CONSTRAINT "StockEntryItem_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "StockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntryItem" ADD CONSTRAINT "StockEntryItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlCaja" ADD CONSTRAINT "ControlCaja_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_controlCajaId_fkey" FOREIGN KEY ("controlCajaId") REFERENCES "ControlCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorriente" ADD CONSTRAINT "MovimientoCuentaCorriente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorriente" ADD CONSTRAINT "MovimientoCuentaCorriente_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

