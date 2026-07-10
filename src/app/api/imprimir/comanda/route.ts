import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contenido } = body as { contenido: string };

    if (!contenido) {
      return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
    }

    // Intentar usar escpos si está disponible
    try {
      const { USB } = require("escpos");
      const device = new USB();
      const { Printer } = require("escpos");
      const printer = new Printer(device);

      device.open(async () => {
        const lineas = contenido.split("\n");
        printer.font("a").style("normal").size(0, 0);

        for (const linea of lineas) {
          printer.text(linea);
        }

        printer.cut();
        printer.close();
      });

      return NextResponse.json({ success: true, message: "Imprimiendo..." });
    } catch (printErr) {
      return NextResponse.json(
        { error: "No se pudo conectar a la impresora USB. Verifícá que esté encendida y conectada.", details: String(printErr) },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: "Error en la impresión", details: String(err) }, { status: 500 });
  }
}
