"use client";

import { useEffect } from "react";

// La app corre en la nube (Vercel): el servidor no tiene acceso a ninguna impresora USB física,
// así que la impresión real solo puede pasar por el diálogo de impresión del navegador,
// que sí corre en la máquina de la caja con la impresora conectada.
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      onClick={() => window.print()}
      className="print:hidden bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
    >
      Imprimir
    </button>
  );
}
