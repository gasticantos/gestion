import { NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { obtenerReporteVentas } from "@/lib/reportes";
import { fechaArgentinaYMD, formatearMoneda, limitesRangoJornadasArgentina } from "@/lib/formato";

const METODO_LABEL = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  FIADO: "Cuenta corriente",
} as const;

export async function GET(req: NextRequest) {
  const hoy = fechaArgentinaYMD();
  const desdeStr = req.nextUrl.searchParams.get("desde") || hoy;
  const hastaStr = req.nextUrl.searchParams.get("hasta") || hoy;
  const { desde, hasta } = limitesRangoJornadasArgentina(desdeStr, hastaStr);
  const reporte = await obtenerReporteVentas(desde, hasta, {
    etiquetaDesde: desdeStr,
    etiquetaHasta: hastaStr,
  });

  const doc = new jsPDF();
  const moneda = (valor: number) => `$${formatearMoneda(valor)}`;
  const periodo =
    reporte.desde === reporte.hasta ? reporte.desde : `${reporte.desde} al ${reporte.hasta}`;
  const obtenerY = () =>
    ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20) + 9;

  doc.setFontSize(18);
  doc.text("Reporte completo de ventas", 14, 16);
  doc.setFontSize(10);
  doc.text(`Periodo: ${periodo}`, 14, 23);

  autoTable(doc, {
    startY: 29,
    head: [["Resumen", "Valor"]],
    body: [
      ["Total combinado", moneda(reporte.combinado.total)],
      ["Mostrador", moneda(reporte.porCanal.MOSTRADOR.total)],
      ["Mesas", moneda(reporte.porCanal.MESA.total)],
      ["Cantidad de ventas", String(reporte.cantidadVentas)],
      ["Propinas", moneda(reporte.combinado.propina)],
    ],
    theme: "grid",
  });

  const canales = [
    ["Mostrador", reporte.porCanal.MOSTRADOR],
    ["Mesas", reporte.porCanal.MESA],
    ["Combinado", reporte.combinado],
  ] as const;
  for (const [titulo, datos] of canales) {
    autoTable(doc, {
      startY: obtenerY(),
      head: [[titulo, "Importe"]],
      body: (Object.keys(METODO_LABEL) as (keyof typeof METODO_LABEL)[])
        .map((metodo) => [METODO_LABEL[metodo], moneda(datos.pagos[metodo])])
        .concat([
          ["  Tarjeta QR", moneda(datos.tarjetas.QR)],
          ["  Tarjeta Debito", moneda(datos.tarjetas.DEBITO)],
          ["  Tarjeta Credito", moneda(datos.tarjetas.CREDITO)],
          ["Propina", moneda(datos.propina)],
          ["Total ventas", moneda(datos.total)],
        ]),
      theme: "grid",
    });
  }

  if (reporte.serieDiaria.length > 0) {
    autoTable(doc, {
      startY: obtenerY(),
      head: [["Evolucion diaria", "Total"]],
      body: reporte.serieDiaria.map((dia) => [dia.fecha, moneda(dia.total)]),
      theme: "grid",
    });
  }

  if (reporte.categorias.length > 0) {
    autoTable(doc, {
      startY: obtenerY(),
      head: [["Categoria", "Cantidad", "Importe"]],
      body: reporte.categorias.map((categoria) => [
        categoria.categoria,
        String(categoria.cantidad),
        moneda(categoria.importe),
      ]),
      theme: "grid",
    });
  }

  autoTable(doc, {
    startY: obtenerY(),
    head: [["Producto", "Cantidad", "Importe"]],
    body:
      reporte.productos.length > 0
        ? reporte.productos.map((producto) => [
            producto.nombre,
            String(producto.cantidad),
            moneda(producto.importe),
          ])
        : [["Sin productos vendidos en el periodo", "", ""]],
    theme: "grid",
  });

  const pdf = doc.output("arraybuffer");
  const nombre = `reporte-ventas-${reporte.desde}-${reporte.hasta}.pdf`;
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
