# Desplegar FOOTLAB en Vercel

Repositorio: [RoyerMerchan/api-metadata-sport](https://github.com/RoyerMerchan/api-metadata-sport), rama `main`.

Se usan dos proyectos Vercel del mismo monorepo y una base PostgreSQL persistente. La aplicación Android consume el mismo dominio HTTPS de la API. Los nombres siguientes son nombres propuestos; los dominios definitivos se obtienen al desplegar.

| Proyecto | Root Directory | Framework | Configuración versionada |
| --- | --- | --- | --- |
| `footlab-api` | `apps/api` | NestJS | `apps/api/vercel.json` |
| `footlab-web` | `apps/mobile` | Vite | `apps/mobile/vercel.json` |

En ambos proyectos, activa **Include source files outside of the Root Directory** para acceder a `packages/shared`, los scripts de la raíz y el lockfile. Usa Node.js **22.x**, pnpm **10.12.4** y la rama de producción `main`. Los comandos de instalación y compilación ya están en cada `vercel.json`; no configures un directorio de salida estático para la API.

El preset NestJS detecta `src/main.ts` desde `apps/api` y genera la función. No añadas un bloque `functions` apuntando a ese archivo: puede provocar `[unused_function]`. Si necesitas ajustar la duración, usa **Settings → Functions → Function Max Duration** en el proyecto API.

## PostgreSQL y variables

La opción preparada es **Neon Postgres desde el Marketplace de Vercel**. La base es un recurso separado: las funciones no guardan datos en su disco local. Una base PostgreSQL existente accesible por TLS también sirve. Antes de crear proyectos o contratar una base, revisa y autoriza sus recursos y condiciones en tu cuenta.

Conecta la base exclusivamente a `footlab-api`. Usa el endpoint con pooling para `DATABASE_URL` y la conexión directa para `DIRECT_URL`. También se admite el nombre `DATABASE_URL_UNPOOLED` que puede proporcionar la integración. Conserva `sslmode=require` y la configuración TLS del proveedor; no desactives la validación de certificados.

Variables de **la API**:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL con pooling; secreto del proveedor |
| `DIRECT_URL` | Conexión directa para Prisma CLI; opcional si el proveedor admite migrar por `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `JWT_REFRESH_SECRET` | Otro secreto aleatorio, distinto del anterior |
| `CORS_ORIGINS` | `https://localhost,http://localhost,https://<dominio-web-real>` |
| `DB_POOL_MAX` | `3` para comenzar; ajustar según concurrencia y capacidad de la base |
| `RESET_URL` | `https://<dominio-web-real>/auth/reset`, si se habilita recuperación |

`NODE_ENV=production` está declarado en la configuración de la API. `PORT` lo gestiona el runtime. Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` y autenticación SMTP si habilitas recuperación. `FOOTBALL_DATA_TOKEN` solo se añade a la API para activar esa importación.

Variable de **la interfaz web**:

```text
VITE_API_URL=https://<dominio-api-real>/api/v1
```

Las variables con prefijo `VITE_` son públicas y se incluyen en JavaScript. Nunca pongas `DATABASE_URL`, JWT, contraseñas ni claves del proveedor en el proyecto web. El build de Vercel rechaza una URL de API ausente, HTTP o de ejemplo.

Configura **Production** y **Preview** por separado. Los previews necesitan otra base o rama de Neon, sus propios secretos y CORS. No compartas la base de producción con previews: la compilación de la API aplica las migraciones del entorno elegido. Si no preparas Preview, deja sus variables de conexión sin configurar; su build fallará sin tocar producción.

## Orden de publicación

El código está publicado en `main` y los commits están atribuidos a **RoyerMerchan**. Ya puedes importar el repositorio en Vercel. En una copia nueva, configura la identidad de este proyecto antes de crear commits:

```bash
git config --local user.name RoyerMerchan
git config --local user.email 108962467+RoyerMerchan@users.noreply.github.com
git config --local credential.https://github.com.username RoyerMerchan
```

Para publicar cambios posteriores desde una terminal que necesite autenticación, usa la cuenta **RoyerMerchan**:

```bash
gh auth login
gh auth setup-git
git push -u origin main
```

Estos comandos autentican GitHub y publican la rama en `RoyerMerchan/api-metadata-sport`. Comprueba que la sesión pertenece a RoyerMerchan. El APK y los secretos locales quedan excluidos del repositorio.

1. Inicia sesión con `npx vercel login`. En el dashboard autoriza el repositorio GitHub indicado.
2. Importa `footlab-api` con la raíz y framework de la tabla. Añade su base y variables antes del primer despliegue.
3. Revisa el build. Ejecuta **Prisma generate → shared build → API build → prisma migrate deploy**. Una migración fallida falla el build. No se ejecuta el seed ni una migración al arrancar cada función.
4. Obtén el dominio asignado y comprueba `GET https://<dominio-api-real>/api/v1/health`: debe responder `{"status":"ok"}`. En producción `/api/docs` y `/api/docs-json` deben responder 404.
5. Importa `footlab-web`, configura `VITE_API_URL` y despliega. Actualiza `CORS_ORIGINS` y `RESET_URL` en la API con el dominio web definitivo y redespliega la API.
6. Prueba registro de dos equipos, datos privados, invitación, cambio de espacio y logout. Abrir `/club`, `/welcome` o `/auth/reset` directamente debe servir la SPA; su rewrite está versionado.
7. Configura la URL HTTPS de la API en `apps/mobile/.env.production` y compila el APK firmado con las instrucciones del README.

Tras conectar GitHub, Vercel desplegará los proyectos afectados por cambios. El workflow CI valida tipos, lint, pruebas, migraciones y builds; no crea infraestructura ni guarda secretos de despliegue. Para usar la CLI con el monorepo, ejecútala desde la raíz y selecciona el proyecto con `npx vercel link --repo`.

## Funcionamiento en funciones

El preset oficial NestJS detecta `apps/api/src/main.ts`. El runtime reutiliza la aplicación y su pool entre solicitudes de una instancia. Prisma usa `@prisma/adapter-pg`, un pool limitado y `attachDatabasePool` de `@vercel/functions` para gestionar conexiones inactivas. Sesiones, membresías, refresh e invitaciones viven en PostgreSQL y funcionan entre instancias.

La API acepta JSON de hasta **4 MB**, dentro del límite de payload de Vercel Functions. La interfaz comprueba el tamaño de las importaciones. La duración de la función se gestiona desde los ajustes del proyecto Vercel; para las importaciones configura 300 segundos con Fluid compute. Las importaciones se realizan por paquetes y conservan sus timeouts. Las importaciones grandes requieren un proceso de trabajo separado en una siguiente versión. El limitador NestJS actual cuenta solicitudes por instancia; las reglas globales de tráfico se configuran en Vercel Firewall.

Verificación local del mismo comando de compilación, con una base local configurada:

```bash
pnpm vercel:build:api
pnpm vercel:build:web
```

Esto compila y aplica las migraciones a la base configurada; no crea proyectos Vercel. La compilación local no sustituye la verificación de una URL pública y su base remota.

Referencias oficiales: [NestJS en Vercel](https://vercel.com/docs/frameworks/backend/nestjs), [monorepos](https://vercel.com/docs/monorepos), [Vite y rutas SPA](https://vercel.com/docs/frameworks/frontend/vite), [pooling de conexiones](https://vercel.com/kb/guide/connection-pooling-with-functions), [Prisma y despliegues](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel), [Neon y Prisma](https://neon.com/docs/guides/prisma).
