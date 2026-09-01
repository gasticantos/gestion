import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";

const TINTA: [number, number, number] = [23, 37, 61];
const AZUL: [number, number, number] = [42, 91, 215];
const CELESTE: [number, number, number] = [224, 235, 255];
const GRIS: [number, number, number] = [93, 104, 120];
const BORDE: [number, number, number] = [220, 226, 235];
const FONDO: [number, number, number] = [247, 249, 252];
const VERDE: [number, number, number] = [16, 135, 93];

type PresupuestoPdf = {
  id: number;
  clienteNombre: string;
  clienteTelefono: string | null;
  validoHasta: Date;
  descuentoPct: number;
  subtotal: number;
  total: number;
  notas: string | null;
  createdAt: Date;
  items: { nombre: string; cantidad: number; precioUnitario: number; subtotal: number }[];
};

export function generarPdfPresupuesto(
  presupuesto: PresupuestoPdf,
  nombreNegocio: string,
  responsable: string
): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 15;
  const anchoUtil = ancho - margen * 2;
  const moneda = (valor: number) => `$${formatearMoneda(valor)}`;
  const fechaCorta = (fecha: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Cordoba",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(fecha);
  const descuento = presupuesto.subtotal - presupuesto.total;

  doc.setFillColor(...TINTA);
  doc.rect(0, 0, ancho, 52, "F");
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, 5, 52, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(nombreNegocio.toUpperCase(), margen, 13);
  doc.setFontSize(24);
  doc.text("Presupuesto", margen, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(206, 216, 231);
  doc.text(`Emitido  ${formatearFechaHora(presupuesto.createdAt)}`, margen, 39);
  doc.text(`Preparado por  ${responsable}`, margen, 45);

  doc.setFillColor(...AZUL);
  doc.roundedRect(ancho - margen - 42, 10, 42, 17, 2.5, 2.5, "F");
  doc.setTextColor(220, 230, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PRESUPUESTO", ancho - margen - 38, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`#${presupuesto.id}`, ancho - margen - 4, 23, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(206, 216, 231);
  doc.text("VÁLIDO HASTA", ancho - margen, 37, { align: "right" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(fechaCorta(presupuesto.validoHasta), ancho - margen, 44, { align: "right" });

  doc.setFillColor(...FONDO);
  doc.setDrawColor(...BORDE);
  doc.roundedRect(margen, 59, anchoUtil, 29, 2.5, 2.5, "FD");
  doc.setFillColor(...CELESTE);
  doc.roundedRect(margen + 4, 63, 10, 2, 1, 1, "F");
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("PREPARADO PARA", margen + 4, 71);
  doc.setTextColor(...TINTA);
  doc.setFontSize(13);
  doc.text(presupuesto.clienteNombre, margen + 4, 79, { maxWidth: 105 });
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Teléfono  ${presupuesto.clienteTelefono || "No informado"}`, margen + 4, 84);
  doc.setDrawColor(...BORDE);
  doc.line(ancho - margen - 47, 64, ancho - margen - 47, 83);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text("VALOR DE LA PROPUESTA", ancho - margen - 4, 70, { align: "right" });
  doc.setTextColor(...AZUL);
  doc.setFontSize(16);
  doc.text(moneda(presupuesto.total), ancho - margen - 4, 80, { align: "right" });

  doc.setFillColor(...AZUL);
  doc.roundedRect(margen, 96, 3, 8, 1, 1, "F");
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalle de la propuesta", margen + 7, 100);
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${presupuesto.items.length} ${presupuesto.items.length === 1 ? "concepto incluido" : "conceptos incluidos"}`, margen + 7, 104);

  autoTable(doc, {
    startY: 110,
    head: [["DESCRIPCIÓN", "CANT.", "PRECIO UNITARIO", "IMPORTE"]],
    body: presupuesto.items.map((item) => [
      item.nombre,
      String(item.cantidad),
      moneda(item.precioUnitario),
      moneda(item.subtotal),
    ]),
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 3.2, right: 2.7, bottom: 3.2, left: 2.7 },
      textColor: TINTA,
      lineColor: BORDE,
      lineWidth: { bottom: 0.15 },
      overflow: "linebreak",
    },
    headStyles: { fillColor: TINTA, textColor: 255, fontStyle: "bold", cellPadding: 3.2 },
    alternateRowStyles: { fillColor: FONDO },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 20 },
      2: { halign: "right", cellWidth: 37 },
      3: { halign: "right", cellWidth: 37, fontStyle: "bold" },
    },
    margin: { left: margen, right: margen, bottom: 22 },
  });

  let y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110) + 9;
  const altoResumen = presupuesto.descuentoPct > 0 ? 44 : 36;
  const lineasNotas = presupuesto.notas
    ? (doc.splitTextToSize(presupuesto.notas, anchoUtil - 8) as string[])
    : [];
  const altoNotas = lineasNotas.length > 0 ? 14 + lineasNotas.length * 4 : 0;
  if (y + altoResumen + (altoNotas ? altoNotas + 7 : 0) > alto - 19) {
    doc.addPage();
    y = 20;
  }

  const resumenX = ancho - margen - 75;
  doc.setFillColor(...FONDO);
  doc.setDrawColor(...BORDE);
  doc.roundedRect(resumenX, y, 75, altoResumen, 2.5, 2.5, "FD");
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Subtotal", resumenX + 5, y + 9);
  doc.text(moneda(presupuesto.subtotal), ancho - margen - 5, y + 9, { align: "right" });
  let totalY = y + 19;
  if (presupuesto.descuentoPct > 0) {
    doc.setTextColor(...VERDE);
    doc.setFont("helvetica", "bold");
    doc.text(`Descuento (${presupuesto.descuentoPct}%)`, resumenX + 5, totalY);
    doc.text(`-${moneda(descuento)}`, ancho - margen - 5, totalY, { align: "right" });
    totalY += 10;
  }
  doc.setDrawColor(...BORDE);
  doc.line(resumenX + 5, totalY - 5, ancho - margen - 5, totalY - 5);
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL", resumenX + 5, totalY + 3);
  doc.setTextColor(...AZUL);
  doc.setFontSize(14);
  doc.text(moneda(presupuesto.total), ancho - margen - 5, totalY + 3, { align: "right" });

  if (presupuesto.descuentoPct > 0) {
    doc.setFillColor(...CELESTE);
    doc.roundedRect(margen, y, 62, 22, 2.5, 2.5, "F");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text("BENEFICIO APLICADO", margen + 4, y + 7);
    doc.setTextColor(...VERDE);
    doc.setFontSize(12);
    doc.text(`Ahorrás ${moneda(descuento)}`, margen + 4, y + 16);
  }

  if (lineasNotas.length > 0) {
    let notasY = y + altoResumen + 7;
    if (notasY + altoNotas > alto - 19) {
      doc.addPage();
      notasY = 20;
    }
    doc.setFillColor(...FONDO);
    doc.setDrawColor(...BORDE);
    doc.roundedRect(margen, notasY, anchoUtil, altoNotas, 2.5, 2.5, "FD");
    doc.setFillColor(...AZUL);
    doc.roundedRect(margen + 4, notasY + 4, 10, 2, 1, 1, "F");
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTAS Y CONDICIONES", margen + 4, notasY + 11);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(lineasNotas, margen + 4, notasY + 17);
  }

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...BORDE);
    doc.line(margen, alto - 12, ancho - margen, alto - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(`${nombreNegocio} · Presupuesto #${presupuesto.id}`, margen, alto - 7);
    doc.text(`Válido hasta ${fechaCorta(presupuesto.validoHasta)}  ·  Página ${pagina} de ${paginas}`, ancho - margen, alto - 7, { align: "right" });
  }

  return doc.output("arraybuffer");
}
