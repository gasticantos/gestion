import { NextResponse } from "next/server";

// La ruta queda inerte incluso ante llamadas programadas antiguas.
export async function GET() {
  return NextResponse.json({ error: "El cierre de caja es exclusivamente manual" }, { status: 410 });
}
