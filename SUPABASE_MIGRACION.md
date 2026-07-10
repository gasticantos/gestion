# Migración a Supabase (Postgres)

El sistema hoy corre localmente con SQLite. El schema de Prisma no usa nada específico de
SQLite (sin tipos raros, todo enums/relaciones estándar), así que **no hace falta tocar el
modelo de datos** para migrar. Los pasos, cuando decidan hacerlo:

## 1. Crear el proyecto en Supabase
- Crear cuenta/proyecto en supabase.com.
- Copiar dos connection strings desde Project Settings → Database:
  - **Connection pooling** (puerto 6543, para la app en runtime).
  - **Direct connection** (puerto 5432, para correr migraciones).

## 2. Variables de entorno
En `.env` (y en el hosting donde se despliegue):
```
DATABASE_URL="postgresql://...pooler...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...:5432/postgres"
AUTH_SECRET="<mantener el mismo o generar uno nuevo con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\">"
```

## 3. Cambios en `prisma/schema.prisma`
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

## 4. Cambios en `src/lib/prisma.ts`
Hoy usa el adapter de better-sqlite3. Para Postgres:
```ts
npm install @prisma/adapter-pg pg

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
```
(reemplaza el `PrismaBetterSqlite3` actual — es el único archivo que toca la conexión a la
base, todo el resto del código usa `prisma` desde acá sin saber qué motor hay debajo).

## 5. Migrar
```
npx prisma migrate dev --name init_postgres
```
Esto crea todas las tablas en Supabase desde cero. Si ya hay datos reales en el SQLite local
que se quieran conservar, hay que exportarlos e importarlos (pedir ayuda llegado el momento,
no es automático entre motores distintos).

## 6. Antes de salir a producción remota
- **Ya está preparado**: usuarios con roles (Dueño/Cajero/Moza) y permisos por sección,
  login con contraseña, sesión por cookie firmada.
- **Falta decidir/hacer en ese momento**:
  - Dominio/hosting donde correr el Next.js (Vercel es lo más directo dado que ya es Next).
  - Si las tablets/celulares van a entrar por internet público, usar HTTPS (automático en
    Vercel) — la cookie de sesión ya está marcada `secure` en producción.
  - Revisar si hace falta un modo offline (hoy no, porque confirmaron que el internet del
    local es estable).
