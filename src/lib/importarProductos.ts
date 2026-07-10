import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const REGLAS_CATEGORIA: [string, RegExp][] = [
  ["Whisky", /WHISK|SCOTCH|BOURBON|JOHNNIE|JHONIE|CHIVAS|JACK DANIEL|BALLANTINE|PIPERS|BUCHANAN|GLENFIDDICH|JAMESON|CLYNELISH|OLD PARR|GRANT'?S/i],
  ["Vodka/Gin", /VODKA|\bGIN\b|GINEBRA|BULLDOG|SMIRNOF|ABSOLUT|SKYY|BEEFEATER|BOMBAY/i],
  ["Fernet/Amargos", /FERNET|AMARGO|APERITIVO|CAMPARI|CYNAR/i],
  ["Licores", /LICOR|LIQUEUR|BAILEYS|COINTREAU|FRANGELICO|SOUTHERN COMFORT|TIA MARIA/i],
  ["Ron", /\bRON\b|RUM\b|BACARDI|CAPTAIN MORGAN/i],
  ["Tequila", /TEQUILA/i],
  ["Espumante/Champagne", /ESPUMANTE|CHAMPAGNE|BRUT\b|CHANDON/i],
  ["Cerveza", /CERVEZA|STELLA ARTOIS|CORONA|QUILMES|BUDWEISER|HEINEKEN|\bIPA\b|PATAGONIA.*(RUBIA|IPA|ROJA)|SCHNEIDER|ANDES\b|LAGER|KAISERDOM|ESTRELLA GALICIA/i],
  ["Gaseosa", /GASEOSA|COCA COLA|\bFANTA\b|SPRITE|AQUARIUS|PEPSI|SEVEN UP|TONICA|\bSODA\b|PARAMOUNT|MANAOS|MIRINDA|GATORADE|PASO DE LOS TOROS/i],
  ["Agua", /AGUA MINERAL|AGUA SIN GAS|AGUA CON GAS|VILLAVICENCIO|VILLA DEL SUR/i],
  ["Jugos", /\bJUGO\b|CEPITA|BAGGIO|PULPA DE|LEVITE/i],
  ["Snacks/Comida", /PAPAS|ALFAJOR|GALLETITA|MAN[IÍ]\b|SNACK|CHOCOLATE|TRUFA|CARAMELO|SANDWICH|ACEITUNA|ACEITE DE OLIVA|CHEETOS|PICADA|FIAMBRE/i],
  ["Vino", /MALBEC|CABERNET|CHARDONNAY|CAHRDONNAY|TORRONTES|BONARDA|SYRAH|MERLOT|SAUVIGNON|PINOT|\bVINO\b|BLEND\b|ROBLE|ESTATE|RISELING|RIESLING|PETIT VERDOT|ROSADO|ROSE\b|DULCE X\s?750|X\s?750\s?ML?$/i],
];

export function clasificarCategoria(nombre: string): string {
  const upper = nombre.toUpperCase();
  for (const [categoria, regex] of REGLAS_CATEGORIA) {
    if (regex.test(upper)) return categoria;
  }
  return "Otro";
}

export type FilaImportada = {
  codigoInterno: string | null;
  nombre: string;
  stock: number;
  marca: string | null;
  codigoBarras: string | null;
  precioCosto: number;
  categoria: string;
};

const ENCABEZADOS: Record<string, string> = {
  código: "codigo",
  articulo: "nombre",
  artículo: "nombre",
  cantidad: "stock",
  marca: "marca",
  "cód. barra": "codigoBarras",
  "cod. barra": "codigoBarras",
  "precio lista": "precioCosto",
};

function normalizarEncabezado(s: string) {
  return s.toLowerCase().trim();
}

export function parsearExcelProductos(buffer: Buffer): { filas: FilaImportada[]; errores: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });

  const errores: string[] = [];
  const filas: FilaImportada[] = [];

  for (let i = 0; i < filasCrudas.length; i++) {
    const cruda = filasCrudas[i];
    const fila: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(cruda)) {
      const campo = ENCABEZADOS[normalizarEncabezado(clave)];
      if (campo) fila[campo] = valor;
    }

    const nombre = fila.nombre ? String(fila.nombre).trim() : "";
    if (!nombre) {
      errores.push(`Fila ${i + 2}: sin nombre de producto, se omite`);
      continue;
    }

    const codigoInterno = fila.codigo ? String(fila.codigo).trim() : null;
    const codigoBarras = fila.codigoBarras ? String(fila.codigoBarras).trim() : null;
    const marca = fila.marca ? String(fila.marca).trim() : null;
    const stock = typeof fila.stock === "number" ? fila.stock : Number(fila.stock) || 0;
    const precioCosto = typeof fila.precioCosto === "number" ? fila.precioCosto : Number(fila.precioCosto) || 0;

    filas.push({
      codigoInterno,
      nombre,
      stock,
      marca,
      codigoBarras,
      precioCosto,
      categoria: clasificarCategoria(nombre),
    });
  }

  return { filas, errores };
}

export type ResumenImportacion = {
  totalFilas: number;
  nuevos: number;
  actualizados: number;
  omitidos: number;
  categoriasNuevas: string[];
  sinCodigoBarras: number;
  stockNegativo: number;
  porCategoria: { categoria: string; cantidad: number }[];
  muestra: FilaImportada[];
  errores: string[];
};

export async function procesarImportacion(
  filas: FilaImportada[],
  errores: string[],
  confirmar: boolean
): Promise<ResumenImportacion> {
  const categoriasExistentes = await prisma.categoria.findMany();
  const categoriaPorNombre = new Map(categoriasExistentes.map((c) => [c.nombre.toLowerCase(), c]));

  const codigosInternos = filas.map((f) => f.codigoInterno).filter((c): c is string => !!c);
  const productosExistentes = await prisma.producto.findMany({
    where: { codigoInterno: { in: codigosInternos } },
  });
  const productoPorCodigo = new Map(productosExistentes.map((p) => [p.codigoInterno, p]));

  const categoriasNuevas = [...new Set(filas.map((f) => f.categoria))].filter(
    (c) => !categoriaPorNombre.has(c.toLowerCase())
  );

  const porCategoriaMap = new Map<string, number>();
  for (const f of filas) {
    porCategoriaMap.set(f.categoria, (porCategoriaMap.get(f.categoria) ?? 0) + 1);
  }

  let nuevos = 0;
  let actualizados = 0;

  if (confirmar) {
    // Nota: se evita envolver las ~1000+ filas en una única transacción interactiva de Prisma:
    // esta tiene un timeout por defecto de 5 segundos, que alcanza sobrado en SQLite local pero
    // no contra una base remota (Supabase), donde cada fila implica un viaje de red. Por eso se
    // hacen creaciones en bloque (createMany) y las actualizaciones en tandas concurrentes, sin
    // una transacción global que las envuelva.
    for (const nombreCategoria of categoriasNuevas) {
      const creada = await prisma.categoria.create({ data: { nombre: nombreCategoria } });
      categoriaPorNombre.set(nombreCategoria.toLowerCase(), creada);
    }

    const aCrear = [];
    const aActualizar: { id: number; f: FilaImportada; categoriaId: number | null }[] = [];

    for (const f of filas) {
      const categoria = categoriaPorNombre.get(f.categoria.toLowerCase())!;
      const existente = f.codigoInterno ? productoPorCodigo.get(f.codigoInterno) : undefined;

      if (existente) {
        aActualizar.push({ id: existente.id, f, categoriaId: existente.categoriaId ?? categoria.id });
      } else {
        aCrear.push({
          nombre: f.nombre,
          codigoInterno: f.codigoInterno,
          codigoBarras: f.codigoBarras,
          marca: f.marca,
          categoriaId: categoria.id,
          precioCosto: f.precioCosto,
          precioVenta: f.precioCosto,
          stock: f.stock,
        });
      }
    }

    if (aCrear.length > 0) {
      await prisma.producto.createMany({ data: aCrear });
      nuevos = aCrear.length;
    }

    const TAMANO_TANDA = 25;
    for (let i = 0; i < aActualizar.length; i += TAMANO_TANDA) {
      const tanda = aActualizar.slice(i, i + TAMANO_TANDA);
      await Promise.all(
        tanda.map(({ id, f, categoriaId }) =>
          prisma.producto.update({
            where: { id },
            data: {
              stock: f.stock,
              precioCosto: f.precioCosto,
              marca: f.marca,
              codigoBarras: f.codigoBarras || undefined,
              // No tocamos precioVenta ni categoriaId si ya estaban seteados, para no pisar ajustes manuales.
              categoriaId,
            },
          })
        )
      );
    }
    actualizados = aActualizar.length;
  } else {
    nuevos = filas.filter((f) => !f.codigoInterno || !productoPorCodigo.has(f.codigoInterno)).length;
    actualizados = filas.length - nuevos;
  }

  return {
    totalFilas: filas.length,
    nuevos,
    actualizados,
    omitidos: errores.length,
    categoriasNuevas,
    sinCodigoBarras: filas.filter((f) => !f.codigoBarras).length,
    stockNegativo: filas.filter((f) => f.stock < 0).length,
    porCategoria: [...porCategoriaMap.entries()]
      .map(([categoria, cantidad]) => ({ categoria, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    muestra: filas.slice(0, 15),
    errores,
  };
}
