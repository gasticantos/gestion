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
CREATE TYPE "TipoMovimientoCC" AS ENUM ('CARGO', 'PAGO', 'INTERES');

-- CreateEnum
CREATE TYPE "TarifaPrecio" AS ENUM ('PARTICULAR', 'MESA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'CUMPLIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MOZO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "recargoMesaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "puertaX" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "puertaY" DOUBLE PRECISION NOT NULL DEFAULT 20,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
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
    "precioCosto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "proveedorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER,
    "tipo" "TipoStockEntry" NOT NULL DEFAULT 'ENTRADA',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "estado" "EstadoMesa" NOT NULL DEFAULT 'LIBRE',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
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
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoInterno_key" ON "Producto"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- CreateIndex
CREATE INDEX "StockEntry_proveedorId_idx" ON "StockEntry"("proveedorId");

-- CreateIndex
CREATE INDEX "StockEntryItem_stockEntryId_idx" ON "StockEntryItem"("stockEntryId");

-- CreateIndex
CREATE INDEX "StockEntryItem_productoId_idx" ON "StockEntryItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_nombre_key" ON "Mesa"("nombre");

-- CreateIndex
CREATE INDEX "Reserva_fecha_idx" ON "Reserva"("fecha");

-- CreateIndex
CREATE INDEX "Reserva_mesaId_idx" ON "Reserva"("mesaId");

-- CreateIndex
CREATE INDEX "Venta_mesaId_idx" ON "Venta"("mesaId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

-- CreateIndex
CREATE INDEX "Venta_estado_idx" ON "Venta"("estado");

-- CreateIndex
CREATE INDEX "Pedido_ventaId_idx" ON "Pedido"("ventaId");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_productoId_idx" ON "PedidoItem"("productoId");

-- CreateIndex
CREATE INDEX "Pago_ventaId_idx" ON "Pago"("ventaId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaCorriente_clienteId_idx" ON "MovimientoCuentaCorriente"("clienteId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaCorriente_ventaId_idx" ON "MovimientoCuentaCorriente"("ventaId");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntryItem" ADD CONSTRAINT "StockEntryItem_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "StockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntryItem" ADD CONSTRAINT "StockEntryItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorriente" ADD CONSTRAINT "MovimientoCuentaCorriente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorriente" ADD CONSTRAINT "MovimientoCuentaCorriente_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
