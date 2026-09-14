Ejecutar `npm run test:caja` con Node 20 o posterior.

Las pruebas usan PostgreSQL en memoria (PGlite) en un puerto temporal de localhost,
Prisma y los servicios reales. No leen `.env`, no conectan a Supabase y reemplazan
las notificaciones externas por respuestas de prueba. El pool de pruebas tiene
una conexión: se verifica la repetición de solicitudes, pero no se simula toda la
concurrencia de varias instancias de Vercel.

`fixtures/schema.sql` se generó con:

```sh
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > tests/fixtures/schema.sql
```

Si cambia `prisma/schema.prisma`, regenerar ese archivo antes de ejecutar las pruebas.
