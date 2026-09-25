import { Rol } from "@/generated/prisma/enums";

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: "ADMIN",
  CAJERO: "Cajero",
  MOZO: "Moza/o",
};

// Prefijos de ruta y qué roles pueden entrar. Se evalúa de arriba hacia abajo,
// el primer prefijo que matchea decide; si ninguno matchea, se permite (rutas públicas/estáticas).
export const REGLAS_RUTA: { prefix: string; roles: Rol[] }[] = [
  { prefix: "/api/auth", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/usuarios", roles: ["ADMIN"] },
  { prefix: "/api/usuarios", roles: ["ADMIN"] },
  { prefix: "/configuracion", roles: ["ADMIN"] },
  { prefix: "/api/configuracion", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/cierre-caja", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/control-caja", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/control-caja", roles: ["ADMIN", "CAJERO"] },
  // El cajero puede cerrar la jornada, pero no acceder al resto de los reportes.
  { prefix: "/api/reportes/cierre", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/flyers", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/api/flyers", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/api/telegram", roles: ["ADMIN"] },
  // Solo ADMIN/cajero pueden tocar qué computadora es la caja principal de impresión.
  // Antes cualquier rol (incluida una moza) podía pisarla sin querer con un solo clic.
  { prefix: "/api/impresion", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/admin", roles: ["ADMIN"] },
  { prefix: "/reportes", roles: ["ADMIN"] },
  { prefix: "/api/reportes", roles: ["ADMIN"] },
  { prefix: "/mesas", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/api/mesas", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/pedidos", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/api/pedidos", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/reservas", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/api/reservas", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/venta", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/ventas", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/ventas", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/stock", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/stock", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/productos", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/productos", roles: ["ADMIN", "CAJERO", "MOZO"] },
  { prefix: "/promos", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/promos", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/presupuestos", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/presupuestos", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/categorias", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/proveedores", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/proveedores", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/clientes", roles: ["ADMIN", "CAJERO"] },
  { prefix: "/api/clientes", roles: ["ADMIN", "CAJERO"] },
];

export function rolesPermitidos(pathname: string): Rol[] | null {
  const regla = REGLAS_RUTA.find((r) => pathname.startsWith(r.prefix));
  return regla ? regla.roles : null;
}

export function puedeAcceder(pathname: string, rol: Rol): boolean {
  const roles = rolesPermitidos(pathname);
  if (!roles) return true;
  return roles.includes(rol);
}

// Primera sección a la que redirigir a cada rol después de loguearse.
export const HOME_POR_ROL: Record<Rol, string> = {
  ADMIN: "/",
  CAJERO: "/venta",
  MOZO: "/mesas",
};
