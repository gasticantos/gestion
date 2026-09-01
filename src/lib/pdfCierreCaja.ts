import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import type { ReporteVentas } from "@/lib/reportes";

const TINTA: [number, number, number] = [23, 37, 61];
const AZUL: [number, number, number] = [42, 91, 215];
const CELESTE: [number, number, number] = [224, 235, 255];
const GRIS: [number, number, number] = [93, 104, 120];
const BORDE: [number, number, number] = [220, 226, 235];
const FONDO: [number, number, number] = [247, 249, 252];
const VERDE: [number, number, number] = [16, 135, 93];

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
  controlCaja?: {
    saldoInicial: number;
    ventasEfectivo: number;
    ingresos: number;
    egresos: number;
    efectivoEsperado: number;
    efectivoContado: number | null;
    diferencia: number | null;
    saldoSiguiente: number;
  } | null;
};

export function generarPdfCierreCaja({
  nombreNegocio,
  fechaJornada,
  operador,
  reporte,
  generadoEn = new Date(),
  controlCaja,
}: DatosCierrePdf): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const moneda = (valor: number) => `$${formatearMoneda(valor)}`;
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 15;
  const totalFinal = reporte.combinado.total + reporte.combinado.propina;

  // Encabezado editorial: banda oscura, acento y metadatos claramente separados.
  doc.setFillColor(...TINTA);
  doc.rect(0, 0, ancho, 49, "F");
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, 5, 49, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(nombreNegocio.toUpperCase(), margen, 13);
  doc.setFontSize(23);
  doc.text("Cierre de caja", margen, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(206, 216, 231);
  doc.text(`Jornada comercial  ${fechaJornada}`, margen, 35);
  doc.text(`Generado  ${formatearFechaHora(generadoEn)}`, margen, 41);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`${operador.nombre}  ·  ${operador.rol}`, ancho - margen, 35, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(206, 216, 231);
  doc.text("Responsable del cierre", ancho - margen, 41, { align: "right" });

  const tarjetas = [
    ["TOTAL FINAL", moneda(totalFinal), "Ventas + propinas"],
    ["VENTAS NETAS", moneda(reporte.combinado.total), `${reporte.cantidadVentas} operaciones`],
    ["PROPINA", moneda(reporte.combinado.propina), "Registrada por separado"],
    ["TICKET PROMEDIO", moneda(reporte.cantidadVentas ? reporte.combinado.total / reporte.cantidadVentas : 0), "Sin incluir propina"],
  ];
  const separacion = 3;
  const anchoTarjeta = (ancho - margen * 2 - separacion * 3) / 4;
  tarjetas.forEach(([titulo, valor, detalle], indice) => {
    const x = margen + indice * (anchoTarjeta + separacion);
    doc.setFillColor(...FONDO);
    doc.setDrawColor(...BORDE);
    doc.roundedRect(x, 56, anchoTarjeta, 30, 2.5, 2.5, "FD");
    doc.setFillColor(...(indice === 0 ? AZUL : CELESTE));
    doc.roundedRect(x + 3, 60, 9, 2, 1, 1, "F");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text(titulo, x + 3, 68);
    doc.setTextColor(...(indice === 2 && reporte.combinado.propina > 0 ? VERDE : TINTA));
    doc.setFontSize(12);
    doc.text(valor, x + 3, 77, { maxWidth: anchoTarjeta - 6 });
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(detalle, x + 3, 82, { maxWidth: anchoTarjeta - 6 });
  });

  const estiloTabla = {
    theme: "plain" as const,
    styles: { font: "helvetica", fontSize: 8.3, cellPadding: { top: 2.7, right: 2.5, bottom: 2.7, left: 2.5 }, textColor: TINTA, lineColor: BORDE, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: TINTA, textColor: 255, fontStyle: "bold" as const, cellPadding: 3 },
    alternateRowStyles: { fillColor: FONDO },
    margin: { left: margen, right: margen },
  };
  const ultimoY = () =>
    ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 88);
  const tituloSeccion = (titulo: string, detalle: string, ySolicitado: number) => {
    let y = ySolicitado;
    if (y > 266) {
      doc.addPage();
      y = 22;
    }
    doc.setFillColor(...AZUL);
    doc.roundedRect(margen, y, 3, 8, 1, 1, "F");
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(titulo, margen + 7, y + 4);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(detalle, margen + 7, y + 8);
    return y + 12;
  };

  let inicio = tituloSeccion("Composición de cobros", "Importes registrados por medio de pago", 94);
  autoTable(doc, {
    ...estiloTabla,
    startY: inicio,
    head: [["MEDIO DE PAGO", "IMPORTE", "PARTICIPACIÓN"]],
    body: METODOS.map(([clave, etiqueta]) => {
      const importe = reporte.combinado.pagos[clave];
      const porcentaje = reporte.combinado.total > 0 ? (importe / reporte.combinado.total) * 100 : 0;
      return [etiqueta, moneda(importe), `${porcentaje.toFixed(1)}%`];
    }).concat([
      ["  Tarjeta QR", moneda(reporte.combinado.tarjetas.QR), "-"],
      ["  Tarjeta Débito", moneda(reporte.combinado.tarjetas.DEBITO), "-"],
      ["  Tarjeta Crédito", moneda(reporte.combinado.tarjetas.CREDITO), "-"],
      ["Propina", moneda(reporte.combinado.propina), "-"],
      ["TOTAL FINAL (VENTAS + PROPINA)", moneda(totalFinal), ""],
    ]),
    columnStyles: { 0: { cellWidth: 95 }, 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
  });

  if (controlCaja) {
    inicio = tituloSeccion("Control de efectivo", "Conciliación entre sistema y dinero contado", ultimoY() + 7);
    autoTable(doc, {
      ...estiloTabla,
      startY: inicio,
      head: [["CONCEPTO", "IMPORTE"]],
      body: [
        ["Efectivo inicial", moneda(controlCaja.saldoInicial)],
        ["Ventas en efectivo", moneda(controlCaja.ventasEfectivo)],
        ["Otros ingresos", moneda(controlCaja.ingresos)],
        ["Egresos", `-${moneda(controlCaja.egresos)}`],
        ["Efectivo esperado", moneda(controlCaja.efectivoEsperado)],
        ["Efectivo contado", controlCaja.efectivoContado == null ? "Sin informar" : moneda(controlCaja.efectivoContado)],
        ["Diferencia", controlCaja.diferencia == null ? "Sin informar" : moneda(controlCaja.diferencia)],
        ["Inicio próxima jornada", moneda(controlCaja.saldoSiguiente)],
      ],
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
  }

  inicio = tituloSeccion("Canales de venta", "Rendimiento de mostrador y mesas", ultimoY() + 7);
  autoTable(doc, {
    ...estiloTabla,
    startY: inicio,
    head: [["CANAL DE VENTA", "VENTAS", "TOTAL"]],
    body: [
      ["Mostrador", String(reporte.porCanal.MOSTRADOR.cantidad), moneda(reporte.porCanal.MOSTRADOR.total)],
      ["Mesas", String(reporte.porCanal.MESA.cantidad), moneda(reporte.porCanal.MESA.total)],
      ["Combinado", String(reporte.cantidadVentas), moneda(reporte.combinado.total)],
    ],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  inicio = tituloSeccion("Categorías", "Participación por familia de productos", ultimoY() + 7);
  autoTable(doc, {
    ...estiloTabla,
    startY: inicio,
    head: [["CATEGORÍAS", "CANTIDAD", "IMPORTE"]],
    body: reporte.categorias.length
      ? reporte.categorias.map((item) => [item.categoria, String(item.cantidad), moneda(item.importe)])
      : [["Sin categorías vendidas", "", ""]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  inicio = tituloSeccion("Detalle de productos", "Unidades e importe vendido", ultimoY() + 7);
  autoTable(doc, {
    ...estiloTabla,
    startY: inicio,
    head: [["PRODUCTOS VENDIDOS", "CANTIDAD", "IMPORTE"]],
    body: reporte.productos.length
      ? reporte.productos.map((item) => [item.nombre, String(item.cantidad), moneda(item.importe)])
      : [["Sin productos vendidos", "", ""]],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...BORDE);
    doc.line(margen, alto - 12, ancho - margen, alto - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`${nombreNegocio} · Cierre ${fechaJornada}`, margen, alto - 7);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 7, { align: "right" });
  }

  return doc.output("arraybuffer");
}
