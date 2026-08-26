import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";

const AZUL: [number, number, number] = [37, 99, 235];
const AZUL_OSCURO: [number, number, number] = [30, 64, 175];
const GRIS: [number, number, number] = [82, 82, 91];

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
  const margen = 14;
  const moneda = (valor: number) => `$${formatearMoneda(valor)}`;
  const fechaCorta = (fecha: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Cordoba",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(fecha);

  doc.setFillColor(...AZUL_OSCURO);
  doc.rect(0, 0, ancho, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(nombreNegocio.toUpperCase(), margen, 15);
  doc.setFontSize(14);
  doc.text(`PRESUPUESTO #${presupuesto.id}`, margen, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Emitido: ${formatearFechaHora(presupuesto.createdAt)}`, margen, 34);
  doc.text(`Válido hasta: ${fechaCorta(presupuesto.validoHasta)}`, margen, 40);

  doc.setFillColor(244, 247, 255);
  doc.roundedRect(margen, 51, ancho - margen * 2, 29, 2, 2, "F");
  doc.setTextColor(...GRIS);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CLIENTE", margen + 4, 59);
  doc.setTextColor(...AZUL_OSCURO);
  doc.setFontSize(12);
  doc.text(presupuesto.clienteNombre, margen + 4, 67);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(`Teléfono: ${presupuesto.clienteTelefono || "No informado"}`, margen + 4, 74);

  autoTable(doc, {
    startY: 87,
    head: [["DESCRIPCIÓN", "CANTIDAD", "PRECIO UNITARIO", "SUBTOTAL"]],
    body: presupuesto.items.map((item) => [
      item.nombre,
      String(item.cantidad),
      moneda(item.precioUnitario),
      moneda(item.subtotal),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3, lineColor: [226, 232, 240] },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "right", cellWidth: 24 },
      2: { halign: "right", cellWidth: 36 },
      3: { halign: "right", cellWidth: 36 },
    },
    margin: { left: margen, right: margen },
  });

  let y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90) + 8;
  if (y > 245) {
    doc.addPage();
    y = 20;
  }

  const cajaX = 112;
  doc.setFillColor(244, 247, 255);
  doc.roundedRect(cajaX, y, ancho - margen - cajaX, presupuesto.descuentoPct > 0 ? 35 : 27, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text("Subtotal", cajaX + 4, y + 8);
  doc.text(moneda(presupuesto.subtotal), ancho - margen - 4, y + 8, { align: "right" });
  let totalY = y + 17;
  if (presupuesto.descuentoPct > 0) {
    const descuento = presupuesto.subtotal - presupuesto.total;
    doc.setTextColor(190, 24, 93);
    doc.text(`Descuento ${presupuesto.descuentoPct}%`, cajaX + 4, totalY);
    doc.text(`-${moneda(descuento)}`, ancho - margen - 4, totalY, { align: "right" });
    totalY += 10;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...AZUL_OSCURO);
  doc.text("TOTAL", cajaX + 4, totalY);
  doc.text(moneda(presupuesto.total), ancho - margen - 4, totalY, { align: "right" });

  if (presupuesto.notas) {
    let notasY = y + (presupuesto.descuentoPct > 0 ? 43 : 35);
    const lineas = doc.splitTextToSize(presupuesto.notas, ancho - margen * 2 - 8) as string[];
    const altoNotas = 14 + lineas.length * 4;
    if (notasY + altoNotas > 280) {
      doc.addPage();
      notasY = 20;
    }
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margen, notasY, ancho - margen * 2, altoNotas, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("NOTAS Y CONDICIONES", margen + 4, notasY + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lineas, margen + 4, notasY + 13);
  }

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(margen, alto - 12, ancho - margen, alto - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`Preparado por ${responsable}`, margen, alto - 7);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 7, { align: "right" });
  }

  return doc.output("arraybuffer");
}
