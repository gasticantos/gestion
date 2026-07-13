"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { input, label } from "@/components/ui/styles";
import { HOME_POR_ROL } from "@/lib/permisos";
import { Rol } from "@/generated/prisma/enums";

export default function LoginPage() {
  const router = useRouter();
  const [requiereBootstrap, setRequiereBootstrap] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function chequear() {
      const res = await fetch("/api/auth/bootstrap");
      const data = await res.json();
      setRequiereBootstrap(data.requiereBootstrap);
    }
    chequear();
  }, []);

  async function iniciarSesion(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    const data = await res.json();
    router.push(HOME_POR_ROL[data.rol as Rol]);
    router.refresh();
  }

  async function crearCuentaInicial(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const res = await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ocurrió un error");
      return;
    }
    setRequiereBootstrap(false);
    setPassword("");
  }

  if (requiereBootstrap === null) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center">
          <span className="grid place-items-center w-8 h-8 rounded-md bg-blue-600 text-neutral-950 font-bold text-sm">
            G
          </span>
          <span className="font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-lg">Gestión</span>
        </div>

        {requiereBootstrap ? (
          <>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
              Todavía no hay usuarios. Creá la cuenta del dueño para empezar.
            </p>
            <form onSubmit={crearCuentaInicial} className="flex flex-col gap-3">
              <div>
                <label className={label}>Nombre</label>
                <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div>
                <label className={label}>Email</label>
                <input
                  type="email"
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>Contraseña</label>
                <input
                  type="password"
                  className={input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              {error && <span className="text-sm text-red-400">{error}</span>}
              <Button type="submit" variant="primary" disabled={enviando} className="w-full py-2.5">
                Crear cuenta
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={iniciarSesion} className="flex flex-col gap-3">
            <div>
              <label className={label}>Email</label>
              <input
                type="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className={label}>Contraseña</label>
              <input
                type="password"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <span className="text-sm text-red-400">{error}</span>}
            <Button type="submit" variant="primary" disabled={enviando} className="w-full py-2.5">
              {enviando ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
