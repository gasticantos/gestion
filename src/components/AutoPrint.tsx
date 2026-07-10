"use client";

import { useEffect, useState } from "react";

export default function AutoPrint() {
  const [imprimiendo, setImprimiendo] = useState(false);

  async function imprimirEpson() {
    try {
      const ticket = document.querySelector(".ticket");
      if (!ticket) {
        console.log("No se encontró ticket, usando print dialog");
        window.print();
        return;
      }

      const contenido = ticket.textContent || "";
      setImprimiendo(true);
      const res = await fetch("/api/imprimir/comanda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });

      if (res.ok) {
        console.log("Impreso exitosamente");
        setTimeout(() => window.close(), 1000);
      } else {
        const data = await res.json();
        console.error("Error de impresión:", data.error);
        console.log("Cayendo a print dialog");
        window.print();
      }
      setImprimiendo(false);
    } catch (err) {
      console.error("Error de impresión:", err);
      setImprimiendo(false);
      window.print();
    }
  }

  useEffect(() => {
    const t = setTimeout(() => imprimirEpson(), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      onClick={imprimirEpson}
      disabled={imprimiendo}
      className="print:hidden bg-neutral-900 text-white rounded px-4 py-1.5 text-sm disabled:opacity-50"
    >
      {imprimiendo ? "Imprimiendo..." : "Imprimir"}
    </button>
  );
}
