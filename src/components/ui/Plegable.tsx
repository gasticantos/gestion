"use client";

import { useState, ReactNode } from "react";
import Card from "@/components/ui/Card";

export default function Plegable({
  titulo,
  children,
  abierto,
  onCambiarAbierto,
}: {
  titulo: string;
  children: ReactNode;
  abierto?: boolean;
  onCambiarAbierto?: (abierto: boolean) => void;
}) {
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const estaAbierto = abierto ?? abiertoInterno;

  function alternar() {
    const nuevo = !estaAbierto;
    if (onCambiarAbierto) onCambiarAbierto(nuevo);
    else setAbiertoInterno(nuevo);
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={alternar}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors"
      >
        <span>{titulo}</span>
        <span className="text-xs text-neutral-500">{estaAbierto ? "Ocultar ▲" : "Mostrar ▼"}</span>
      </button>
      {estaAbierto && (
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-3">{children}</div>
      )}
    </Card>
  );
}
