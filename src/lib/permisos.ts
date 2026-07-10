import { Rol } from "@/generated/prisma/enums";

export const ROL_LABEL: Record<Rol, string> = {
  DUENIO: "Dueño",
  CAJERO: "Cajero",
  MOZO: "Moza/o",
};

// Prefijos de ruta y qué roles pueden entrar. Se evalúa de arriba hacia abajo,
// el primer prefijo que matchea decide; si ninguno matchea, se permite (rutas públicas/estáticas).
export const REGLAS_RUTA: { prefix: string; roles: Rol[] }[] = [
  { prefix: "/api/auth", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/usuarios", roles: ["DUENIO"] },
  { prefix: "/api/usuarios", roles: ["DUENIO"] },
  { prefix: "/configuracion", roles: ["DUENIO"] },
  { prefix: "/api/configuracion", roles: ["DUENIO"] },
  { prefix: "/api/admin", roles: ["DUENIO"] },
  { prefix: "/reportes", roles: ["DUENIO"] },
  { prefix: "/api/reportes", roles: ["DUENIO"] },
  { prefix: "/mesas", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/api/mesas", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/pedidos", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/api/pedidos", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/reservas", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/api/reservas", roles: ["DUENIO", "CAJERO", "MOZO"] },
  { prefix: "/venta", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/ventas", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/ventas", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/stock", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/stock", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/productos", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/productos", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/categorias", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/proveedores", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/proveedores", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/clientes", roles: ["DUENIO", "CAJERO"] },
  { prefix: "/api/clientes", roles: ["DUENIO", "CAJERO"] },
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
  DUENIO: "/",
  CAJERO: "/venta",
  MOZO: "/mesas",
};
