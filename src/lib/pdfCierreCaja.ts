import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import type { ReporteVentas } from "@/lib/reportes";

const AZUL: [number, number, number] = [37, 99, 235];
const AZUL_OSCURO: [number, number, number] = [30, 64, 175];
const GRIS: [number, number, number] = [82, 82, 91];
const FONDO: [number, number, number] = [244, 247, 255];

const METODOS = [
  ["EFECTIVO", "Efectivo"],
  ["TARJETA", "Tarjeta"],
  ["TRANSFERENCIA", "Transferencia"],
  ["FIADO", "Cuenta corriente"],
] as const;

type DatosCierrePdf = {
  nombreNegocio: string;
  fechaJornada: string;
  operador: { nombre: string; rol: string };
  reporte: ReporteVentas;
  generadoEn?: Date;
};

export function generarPdfCierreCaja({
  nombreNegocio,
  fechaJornada,
  operador,
  reporte,
  generadoEn = new Date(),
}: DatosCierrePdf): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const moneda = (valor: number) => `$${formatearMoneda(valor)}`;
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 14;

  doc.setFillColor(...AZUL_OSCURO);
  doc.rect(0, 0, ancho, 43, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(nombreNegocio.toUpperCase(), margen, 14);
  doc.setFontSize(13);
  doc.text("CIERRE DE CAJA", margen, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Jornada: ${fechaJornada} · Generado: ${formatearFechaHora(generadoEn)}`, margen, 31);
  doc.text(`Responsable: ${operador.nombre} (${operador.rol})`, margen, 37);

  const tarjetas = [
    ["TOTAL VENDIDO", moneda(reporte.combinado.total)],
    ["VENTAS", String(reporte.cantidadVentas)],
    ["MOSTRADOR", moneda(reporte.porCanal.MOSTRADOR.total)],
    ["MESAS", moneda(reporte.porCanal.MESA.total)],
  ];
  const separacion = 3;
  const anchoTarjeta = (ancho - margen * 2 - separacion * 3) / 4;
  tarjetas.forEach(([titulo, valor], indice) => {
    const x = margen + indice * (anchoTarjeta + separacion);
    doc.setFillColor(...FONDO);
    doc.roundedRect(x, 49, anchoTarjeta, 25, 2, 2, "F");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(titulo, x + 3, 57);
    doc.setTextColor(...AZUL_OSCURO);
    doc.setFontSize(indice === 0 ? 12 : 10.5);
    doc.text(valor, x + 3, 68, { maxWidth: anchoTarjeta - 6 });
  });

  const estiloTabla = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.5, lineColor: [226, 232, 240] as [number, number, number] },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: margen, right: margen },
  };
  const ultimoY = () =>
    ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 77) + 7;

  autoTable(doc, {
    ...estiloTabla,
    startY: 81,
    head: [["MEDIO DE PAGO", "IMPORTE", "% DEL TOTAL"]],
    body: METODOS.map(([clave, etiqueta]) => {
      const importe = reporte.combinado.pagos[clave];
      const porcentaje = reporte.combinado.total > 0 ? (importe / reporte.combinado.total) * 100 : 0;
      return [etiqueta, moneda(importe), `${porcentaje.toFixed(1)}%`];
    }).concat([["TOTAL", moneda(reporte.combinado.total), "100%"]]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  autoTable(doc, {
    ...estiloTabla,
    startY: ultimoY(),
    head: [["CANAL DE VENTA", "VENTAS", "TOTAL"]],
    body: [
      ["Mostrador", String(reporte.porCanal.MOSTRADOR.cantidad), moneda(reporte.porCanal.MOSTRADOR.total)],
      ["Mesas", String(reporte.porCanal.MESA.cantidad), moneda(reporte.porCanal.MESA.total)],
      ["Combinado", String(reporte.cantidadVentas), moneda(reporte.combinado.total)],
    ],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  autoTable(doc, {
    ...estiloTabla,
    startY: ultimoY(),
    head: [["CATEGORÍAS", "CANTIDAD", "IMPORTE"]],
    body: reporte.categorias.length
      ? reporte.categorias.map((item) => [item.categoria, String(item.cantidad), moneda(item.importe)])
      : [["Sin categorías vendidas", "", ""]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  autoTable(doc, {
    ...estiloTabla,
    startY: ultimoY(),
    head: [["PRODUCTOS VENDIDOS", "CANTIDAD", "IMPORTE"]],
    body: reporte.productos.length
      ? reporte.productos.map((item) => [item.nombre, String(item.cantidad), moneda(item.importe)])
      : [["Sin productos vendidos", "", ""]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(margen, alto - 12, ancho - margen, alto - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("Generado automáticamente por Gestión", margen, alto - 7);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 7, { align: "right" });
  }

  return doc.output("arraybuffer");
}
