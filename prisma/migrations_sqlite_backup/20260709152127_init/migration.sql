-- CreateTable
CREATE TABLE "Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "contacto" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'OTRO',
    "precioVenta" REAL NOT NULL,
    "precioCosto" REAL NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "proveedorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proveedorId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'ENTRADA',
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockEntry_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockEntryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockEntryId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "costoUnitario" REAL NOT NULL,
    CONSTRAINT "StockEntryItem_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "StockEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockEntryItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'LIBRE'
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "mesaId" INTEGER,
    "clienteId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Venta_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "comandaImpresa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "notas" TEXT,
    CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PedidoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pago_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "saldo" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MovimientoCuentaCorriente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "ventaId" INTEGER,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoCuentaCorriente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCuentaCorriente_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");

-- CreateIndex
CREATE INDEX "StockEntry_proveedorId_idx" ON "StockEntry"("proveedorId");

-- CreateIndex
CREATE INDEX "StockEntryItem_stockEntryId_idx" ON "StockEntryItem"("stockEntryId");

-- CreateIndex
CREATE INDEX "StockEntryItem_productoId_idx" ON "StockEntryItem"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_nombre_key" ON "Mesa"("nombre");

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
