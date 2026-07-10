import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, verificarSesion } from "@/lib/session";
import { puedeAcceder, HOME_POR_ROL } from "@/lib/permisos";
import { Rol } from "@/generated/prisma/enums";

const PUBLICAS = [
  "/login",
  "/api/auth/login",
  "/api/auth/bootstrap",
  "/api/auth/logout",
  "/manifest.webmanifest",
  "/icons",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api");

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarSesion(token) : null;

  if (!sesion) {
    if (esApi) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!puedeAcceder(pathname, sesion.rol)) {
    if (esApi) {
      return NextResponse.json({ error: "No tenés permiso para esto" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = HOME_POR_ROL[sesion.rol as Rol];
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
