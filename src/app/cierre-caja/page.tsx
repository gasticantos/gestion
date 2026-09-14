import Link from "next/link";
import Card from "@/components/ui/Card";

export default function CierreCajaPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-semibold">Cierre de caja</h1>
      <Card className="flex flex-col gap-4 p-5">
        <p>La caja permanece abierta hasta que la cierres manualmente, aunque cambie el día.</p>
        <p>Completá el arqueo en Control de caja para guardar el cierre, imprimirlo y enviar su PDF a Telegram.</p>
        <Link href="/control-caja" className="rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white">Ir a Control de caja</Link>
      </Card>
    </div>
  );
}
