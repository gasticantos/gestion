type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

function configuracion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !secret) throw new Error("Falta configurar Supabase Auth");
  return { url, publishable, secret };
}

export async function autenticarSupabase(email: string, password: string): Promise<AuthUser | null> {
  const { url, publishable } = configuracion();
  const respuesta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishable, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!respuesta.ok) return null;
  return (await respuesta.json()).user as AuthUser;
}

export async function crearUsuarioSupabase(email: string, password: string, nombre: string) {
  const { url, secret } = configuracion();
  const respuesta = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nombre } }),
  });
  const data = await respuesta.json();
  if (!respuesta.ok) throw new Error(data.msg || data.message || "No se pudo crear el usuario en Supabase");
  return data as AuthUser;
}

export async function buscarUsuarioSupabasePorEmail(email: string): Promise<AuthUser | null> {
  const { url, secret } = configuracion();
  const respuesta = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error("No se pudo consultar Supabase Auth");
  const data = await respuesta.json();
  const usuarios = Array.isArray(data.users) ? data.users : [];
  return usuarios.find((usuario: AuthUser) => usuario.email?.toLowerCase() === email.toLowerCase()) || null;
}

export async function actualizarUsuarioSupabase(
  authId: string,
  cambios: { email?: string; password?: string; nombre?: string; activo?: boolean }
) {
  const { url, secret } = configuracion();
  const respuesta = await fetch(`${url}/auth/v1/admin/users/${authId}`, {
    method: "PUT",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(cambios.email ? { email: cambios.email } : {}),
      ...(cambios.password ? { password: cambios.password } : {}),
      ...(cambios.nombre ? { user_metadata: { nombre: cambios.nombre } } : {}),
      ...(cambios.activo === false ? { ban_duration: "876000h" } : {}),
      ...(cambios.activo === true ? { ban_duration: "none" } : {}),
    }),
  });
  if (!respuesta.ok) {
    const data = await respuesta.json();
    throw new Error(data.msg || data.message || "No se pudo actualizar el usuario en Supabase");
  }
}
