import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";
import { puedeAcceder } from "@/lib/permisos";

const secciones = [
  { href: "/venta", label: "Venta (mostrador)", desc: "Punto de venta al público" },
  { href: "/mesas", label: "Mesas", desc: "Gestión de mesas y pedidos" },
  { href: "/reservas", label: "Reservas", desc: "Cargar e imprimir reservas" },
  { href: "/stock", label: "Stock", desc: "Carga de stock y niveles actuales" },
  { href: "/productos", label: "Productos", desc: "Catálogo de productos y códigos de barras" },
  { href: "/proveedores", label: "Proveedores", desc: "Alta y gestión de proveedores" },
  { href: "/clientes", label: "Clientes", desc: "Cuenta corriente / fiado" },
  { href: "/reportes", label: "Reportes", desc: "Ventas del día, categorías y resumen por período" },
  { href: "/usuarios", label: "Usuarios", desc: "Cuentas y roles del personal" },
  { href: "/configuracion", label: "Configuración", desc: "Recargo de mesa, categorías" },
];

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarSesion(token) : null;
  const visibles = sesion ? secciones.filter((s) => puedeAcceder(s.href, sesion.rol)) : [];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Gestión del negocio</h1>
        <p className="text-sm text-neutral-500 mt-1">Elegí una sección para empezar</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibles.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 hover:border-blue-600/50 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 transition-colors"
          >
            <div className="font-medium text-neutral-800 dark:text-neutral-100 group-hover:text-blue-500 transition-colors">
              {s.label}
            </div>
            <div className="text-sm text-neutral-500 mt-0.5">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
