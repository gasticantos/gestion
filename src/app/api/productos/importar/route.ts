import { NextRequest, NextResponse } from "next/server";
import { parsearExcelProductos, procesarImportacion } from "@/lib/importarProductos";

// Una importación grande (1000+ filas) contra una base remota puede tardar más que el límite
// por defecto de una función serverless; se pide el máximo margen posible.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const archivo = formData.get("archivo");
  const confirmar = formData.get("confirmar") === "true";

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await archivo.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 });
  }

  let filas, errores;
  try {
    ({ filas, errores } = parsearExcelProductos(buffer));
  } catch {
    return NextResponse.json({ error: "El archivo no parece ser un Excel válido" }, { status: 400 });
  }

  if (filas.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas para importar" }, { status: 400 });
  }

  const resumen = await procesarImportacion(filas, errores, confirmar);
  return NextResponse.json(resumen);
}
