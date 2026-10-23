# FOOTLAB

Plataforma de análisis de fútbol y gestión de clubes. Un monorepo Git con **NestJS + PostgreSQL + Prisma 7.10.1**, aplicación **Vue 3 + Capacitor 8** y despliegue declarado para **Vercel**.

La aplicación utiliza Vercel para API y web, y PostgreSQL persistente separado. Los datos deportivos operativos se guardan en PostgreSQL. Los datos privados se autorizan en la API por organización, también al navegar directamente a un recurso.

## Ejecutar en local

Requisitos: Node.js 22.12 o posterior, pnpm 10.12.4. Para Android: JDK 21, Android SDK 36 y sus licencias aceptadas. Usa `npm.cmd` y `pnpm.cmd` en PowerShell si la política de ejecución bloquea los archivos `.ps1`.

```bash
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:generate
pnpm --filter @footlab/shared build
```

`setup:local` crea `.env` con secretos JWT distintos y una contraseña demo aleatoria. Conserva los archivos existentes. No imprime secretos.

Elige **una** forma de iniciar PostgreSQL:

```bash
# Opción A: Docker Desktop activo. Incluye Mailpit para correos locales.
pnpm db:up

# Opción B: PostgreSQL nativo dentro de .local/postgres; deja abierta esta terminal.
pnpm db:local
```

En otra terminal:

```bash
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

- Interfaz: <http://localhost:5173>
- API: <http://localhost:3000/api/v1>
- Estado: <http://localhost:3000/api/v1/health>
- Swagger: <http://localhost:3000/api/docs> y `/api/docs-json`, disponibles fuera de producción.
- Correos de desarrollo con Docker: <http://localhost:8025>

Cuentas del seed: `demo@footlab.local` (OWNER del club demo) y `viewer@footlab.local` (VIEWER). La contraseña es el valor `SEED_PASSWORD` de tu `.env`. El seed no cambia contraseñas ni sobrescribe datos existentes al repetirse. Está bloqueado con `NODE_ENV=production` y no se ejecuta al desplegar.

El club, sus equipos, cuatro jugadores y dos partidos son **ficticios y se identifican como DEMO**. El catálogo PRO comienza vacío hasta importar una fuente real.

## Funcionalidad del MVP

| Área | Funciones disponibles |
| --- | --- |
| Cuenta | Registro, login, perfil, recuperación por SMTP, logout, sesiones y revocación |
| Organizaciones | Equipos privados, registro con club propio, invitaciones por correo, roles, retirada de miembros y equipo activo por sesión |
| CLUB | Categorías en equipos, temporadas y competiciones, crear/editar/archivar jugadores y equipos, historial de plantillas, técnicos, partidos y resultados |
| Partidos | Convocatorias, formación, titulares, minutos, goles, autogoles, tarjetas y sustituciones |
| Estadísticas | Dashboard, clasificaciones calculadas, totales por jugador, goles por 90 y evolución |
| LAB | Comparación de dos jugadores, filtros de temporada y posición, barras y evolución |
| PRO | Catálogo importado de competiciones, temporadas, equipos, jugadores, resultados, clasificación, perfiles y favoritos |
| Evaluación | Puntuación y observaciones privadas por jugador/temporada |

Las funciones futuras aparecen como **no disponibles**: scouting avanzado, mapas de calor/disparos, redes de pases, xG/xA, PDF, vídeo, IA y pizarra táctica. Los modelos de scouting y métricas permiten evolucionar la API sin incluir controles que aparenten ejecutar esas funciones.

Los equipos y jugadores se archivan para conservar su historial. Las afiliaciones registran temporada, equipo, fechas y dorsal. Una convocatoria exige que el jugador pertenezca a esa plantilla en la fecha del partido. El marcador oficial se registra por separado de los eventos: importa o registra todos los eventos y minutos necesarios antes de usar las estadísticas individuales para tomar decisiones.

## Autenticación y autorización

Cada persona usa su propio correo y contraseña. Al registrarte puedes escribir el nombre de tu equipo: se crean su espacio privado, el primer equipo y tu rol OWNER juntos. Si recibiste una invitación, deja ese nombre vacío; entrarás a **Crear o unirme a un equipo**. Las cuentas sin equipo pasan por ese mismo flujo al iniciar sesión.

En **Mi Club → Organización → Invitar persona**, el propietario o director introduce correo y rol. La aplicación muestra un código que debe compartir con esa persona: no envía un correo automáticamente. El invitado inicia sesión con el correo indicado y pega el código en **Crear o unirme a un equipo**. El código caduca en 7 días, es de un solo uso y puede revocarse. Solo su hash queda en PostgreSQL. Una invitación no cambia el rol de un miembro existente ni asigna OWNER.

El selector superior permite cambiar entre los equipos a los que perteneces. El servidor guarda esa elección en la sesión de ese dispositivo; otro dispositivo conserva su propia elección. Al cambiar de cuenta se vacía el estado anterior y se descartan respuestas pendientes de esa cuenta. En **Perfil** puedes ver el equipo activo de cada sesión, revocar una o cerrar todas las demás. Retirar a un miembro bloquea su acceso al club y limpia ese equipo de sus sesiones; su cuenta conserva el acceso a los otros clubes a los que pertenezca.

- Contraseñas con Argon2id. JWT de acceso de 15 minutos y refresh de 30 días.
- El refresh rota mediante actualización condicional en PostgreSQL. Reutilizar un refresh anterior revoca la sesión.
- La API consulta la sesión en cada petición: logout, revocación y cambio de contraseña invalidan también los JWT de acceso.
- En Android, el refresh se cifra con AES-256-GCM y una clave no exportable de Android Keystore. El plugin nativo `FootlabVault` guarda solo el ciphertext e IV en preferencias privadas. El APK desactiva backups; el access token vive en memoria.
- La vista web de desarrollo conserva el refresh en `sessionStorage`, limitado a esa pestaña. No guarda credenciales PostgreSQL.
- El cliente Axios centraliza timeout, bearer token y una única renovación concurrente. Las escrituras requieren conexión: no existe una cola de cambios offline ni resolución automática de conflictos.
- Las peticiones usan validación global NestJS y esquemas Zod estrictos compartidos. Hay un límite JSON de 4 MB y de frecuencia por instancia, Helmet, CORS explícito y errores sin detalles de infraestructura.
- `ADMIN` es un permiso **global** para importar datos públicos. Ser OWNER de un club no concede ADMIN.

| Rol de club | Lectura | Gestión deportiva | Evaluaciones | Administrar club | Miembros |
| --- | --- | --- | --- | --- | --- |
| OWNER | Sí | Sí | Sí | Sí | Sí, incluidos propietarios |
| DIRECTOR | Sí | Sí | Sí | Sí | Sí, salvo propietarios |
| COACH | Sí | Sí | Sí | No | No |
| ANALYST / SCOUT | Sí | No | Sí | No | No |
| PLAYER / VIEWER | Sí | No | No | No | No |

El último OWNER no puede perder su rol. Las comprobaciones se hacen en el servidor para cada identificador y relación. Los eventos, convocatorias, evaluaciones y favoritos no permiten saltar entre organizaciones. Omitir `organizationId` selecciona exclusivamente el catálogo público; las escrituras deportivas requieren una organización autorizada.

La recuperación requiere `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` y `RESET_URL`; para un proveedor autenticado, configura `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_SECURE=true` cuando corresponda al puerto 465. Con PostgreSQL nativo, inicia un servidor SMTP aparte o configura uno real. Sin SMTP, la API indica que la recuperación no está configurada. No devuelve tokens de recuperación en las respuestas. Los enlaces caducan en 30 minutos y son de un solo uso.

## Integraciones y cobertura

Consulta `GET /api/v1/integrations` para conocer las fuentes y su configuración. Las claves de proveedores permanecen exclusivamente en el backend.

Para autorizar explícitamente una cuenta existente como importador global, ejecuta desde una terminal con acceso a la base correspondiente:

```bash
pnpm --filter @footlab/api admin:grant usuario@dominio.com
```

Entra de nuevo en la aplicación y usa **Explorar → Importaciones**.

**football-data.org**: configura `FOOTBALL_DATA_TOKEN` en la API. `POST /integrations/football-data/sync` recibe `{ "competition": "PL", "season": 2026 }`. Importa competición, temporada, equipos, plantillas y resultados mediante identificadores externos estables. Respeta los límites y cobertura de tu plan. Esta importación no inventa eventos, minutos ni estadísticas individuales que el endpoint no devuelva. Las clasificaciones se calculan con resultados disponibles, sin deducciones disciplinarias.

**StatsBomb Open Data**: `POST /integrations/statsbomb/import` recibe un paquete JSON:

```json
{ "match": {}, "lineups": [], "events": [] }
```

Sustituye los contenidos por un objeto de `data/matches/<competition>/<season>.json`, el array completo de `data/lineups/<match_id>.json` y el de `data/events/<match_id>.json` del repositorio oficial. La UI permite cargar ese paquete como archivo. El importador obtiene posiciones y minutos solo de intervalos existentes; importa goles, autogoles, tarjetas y sustituciones compatibles. Reimportar el partido reemplaza sus eventos y participaciones sin duplicarlos. Las fuentes permanecen separadas: no se fusionan automáticamente personas de distintos proveedores por nombre.

StatsBomb no proporciona límites completos de temporada en ese objeto: `datesAreCoverage=true` identifica el rango de partidos importados. Su hora sin zona se conserva con `kickoffTimezoneKnown=false` y la interfaz lo indica. Las posiciones desconocidas se identifican como `UNKNOWN`. Los campos no disponibles, como asistencias en esta versión, se devuelven como `null` y se muestran con `—`.

Consulta las condiciones de uso y atribuye siempre la fuente. Documentación primaria: [football-data v4](https://docs.football-data.org/general/v4/index.html), [StatsBomb Open Data](https://github.com/statsbomb/open-data).

## Base de datos y migraciones

El esquema está en `apps/api/prisma/schema.prisma`. Prisma 7 utiliza `prisma.config.ts`, cliente generado en `src/generated/prisma` y adaptador `@prisma/adapter-pg`. Solo la API importa Prisma o dependencias de Node; Vite empaqueta el código compartido apto para navegador.

```bash
pnpm db:generate
pnpm db:migrate:dev --name nombre_del_cambio
pnpm db:migrate:deploy
pnpm db:status
pnpm db:seed
pnpm db:studio
```

Las migraciones versionadas incluyen claves externas, índices, unicidad y restricciones SQL de minutos, resultados, fechas y favoritos. No se usa `db push`. En desarrollo `migrate dev` necesita permiso para crear una base sombra. En producción se utiliza exclusivamente `migrate deploy` durante el build de la API, nunca al iniciar cada función. No modifiques migraciones ya aplicadas. Prepara cambios graduales con el patrón expandir → migrar datos → retirar, revisando cualquier operación destructiva y las copias de seguridad antes de aprobarla.

## API

Todos los recursos deportivos requieren bearer token. `auth/register`, `auth/login`, `auth/refresh`, recuperación y `health` son públicos. Swagger muestra los endpoints.

| Recurso | Operaciones principales |
| --- | --- |
| `/auth` | `POST register/login/refresh/logout/forgot-password/reset-password`, `GET session/sessions`, `POST session/workspace`, `POST sessions/revoke-others`, `DELETE sessions/:id` |
| `/users/me` | `GET`, `PATCH` nombre |
| `/organizations` | `GET`, `POST`, `PATCH :id`, `GET/POST :id/members`, `DELETE :id/members/:userId`, `GET/POST :id/invitations`, `DELETE :id/invitations/:invitationId`, `POST invitations/accept` |
| `/competitions` | `GET`, `POST`, `GET :id`, `GET/POST seasons` |
| `/teams` | `GET/POST`, `GET/PATCH/DELETE :id`, `POST squads/staff`, `DELETE staff/:id` |
| `/players` | `GET/POST`, `GET/PATCH/DELETE :id`, `POST evaluations`, `GET :id/evaluations` |
| `/matches` | `GET/POST`, `GET :id`, `PATCH :id/result`, `PUT :id/lineup` |
| `/match-events` | `GET/POST`, `DELETE :id` |
| `/statistics` | Dashboard, `GET standings`, `GET players/:id` |
| `/comparisons` | `GET ?left=<uuid>&right=<uuid>&seasonId=<uuid>` |
| `/favorites` | `GET/POST`, `DELETE :id` |
| `/integrations` | Estado, `POST football-data/sync`, `POST statsbomb/import` |
| `/health` | Estado de conexión PostgreSQL; HTTP 503 si falla |

Añade `?organizationId=<uuid>` para datos privados. Las listas admiten `q`, `limit` (máximo 100), `offset` y filtros pertinentes como `position`, `teamId`, `seasonId`, `competitionId` o `matchId`. Las mutaciones tienen validación estricta; consulta los esquemas compartidos y las pruebas de integración para los cuerpos completos.

## Vercel y GitHub

El destino es [RoyerMerchan/api-metadata-sport](https://github.com/RoyerMerchan/api-metadata-sport), rama `main`. Se importan dos proyectos Vercel: API NestJS con Root Directory `apps/api` y web Vue con Root Directory `apps/mobile`. Cada uno incluye su `vercel.json`. Activa el acceso a archivos fuera de la raíz para usar `packages/shared` y los scripts del monorepo.

La conexión PostgreSQL preparada es Neon desde el Marketplace de Vercel: `DATABASE_URL` con pooling para la API y `DIRECT_URL` para Prisma CLI. Sesiones y datos permanecen en PostgreSQL. Las migraciones se ejecutan durante el build de la API, después de compilar y antes de publicar. El seed no se ejecuta en producción.

Consulta [el procedimiento completo de Vercel](docs/DEPLOYMENT.md) para variables, Production/Preview, CORS, verificación HTTPS y conexión del APK. El repositorio no contiene credenciales de cloud.

```bash
pnpm vercel:build:api
pnpm vercel:build:web
```

Estos comandos validan la compilación local; el de API aplica migraciones a la base configurada. Publicar requiere una sesión Vercel y una base PostgreSQL configurada. Crear recursos o contratar planes requiere la autorización del propietario.

## Android y APK

Identificador: `com.footlab.app`. Nombre: **FOOTLAB**. El proyecto nativo y Gradle Wrapper están versionados en `apps/mobile/android`.

Define `ANDROID_HOME`/`ANDROID_SDK_ROOT` o el archivo ignorado `apps/mobile/android/local.properties` con `sdk.dir=<ruta SDK>`. Configura `JAVA_HOME` con JDK 21. Si existe `.cache/jdk21/jdk-*`, el script lo utiliza sin modificar Java del sistema.

```bash
pnpm mobile:build
pnpm mobile:android:sync
pnpm mobile:android:open
pnpm mobile:android:apk:debug
```

El último comando compila Vue, sincroniza Capacitor, ejecuta `assembleDebug` y comprueba que existe:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

El debug convierte `localhost` a `10.0.2.2` para el emulador. Para un teléfono físico configura `VITE_API_URL=http://<IP-LAN-del-PC>:3000/api/v1` antes de ejecutar el script y permite el acceso al puerto 3000 en tu red local. Mantén PC y teléfono en una red accesible. El permiso de HTTP solo existe en debug.

Para release:

1. Crea un keystore fuera del repositorio con `keytool -genkeypair`, elige alias y contraseñas privadas.
2. Configura `apps/mobile/.env.production` con la URL HTTPS real de Vercel.
3. Proporciona las variables `FOOTLAB_STORE_FILE` (ruta absoluta), `FOOTLAB_STORE_PASSWORD`, `FOOTLAB_KEY_ALIAS` y `FOOTLAB_KEY_PASSWORD` en tu terminal o almacén seguro de CI. El script nunca imprime esas variables.
4. Ejecuta `pnpm mobile:android:apk:release`. El script rechaza HTTP, URLs de ejemplo, localhost y firmas ausentes.
5. El archivo firmado se verifica en `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

La aplicación release impide tráfico HTTP también mediante el manifiesto Android. No contiene credenciales PostgreSQL ni claves de proveedores. Una prueba en viewport Android de navegador no sustituye una prueba nativa en dispositivo del Keystore, botón Atrás o instalación.

En este entorno Google Maven devolvió HTTP 404. Para verificar Android se usó un init script local, ignorado por Git, con un espejo público de Google Maven. Puedes suministrar un init script propio mediante `FOOTLAB_GRADLE_INIT=<ruta absoluta>`. Los archivos Gradle versionados conservan `google()` y `mavenCentral()` como repositorios normales. Gradle 8.14.3 queda fijado por URL y SHA256 oficial.

## Pruebas y comandos

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

`test:integration` crea un PostgreSQL de pruebas separado en `127.0.0.1:55432`, base `footlab_test`, aplica las migraciones y ejecuta pruebas reales de API/DB. Conserva ese directorio en `.local/test-postgres` y detiene el servidor al finalizar. No borra ni reutiliza la base de desarrollo. En CI se usa el PostgreSQL de servicio y se ejecuta `pnpm --filter @footlab/api test:integration` con `NODE_ENV=test` y una base cuyo nombre contenga `footlab_test`.

Si ese puerto está ocupado, configura `FOOTLAB_TEST_PORT=55433` (PowerShell: `$env:FOOTLAB_TEST_PORT='55433'`). Esa ejecución usa su propio directorio `.local/test-postgres-55433`. Los fallos de arranque se muestran y devuelven un código de error.

Para E2E, inicia API y Vue en dos terminales, aplica seed y descarga Chromium con `pnpm --filter @footlab/mobile exec playwright install chromium`. Después ejecuta `pnpm test:e2e`. En este entorno se usó la variable `PLAYWRIGHT_BROWSERS_PATH=<raíz>/.cache/playwright` para aislar las descargas. Las pruebas usan la contraseña de `.env`, crean y archivan sus propios jugadores y guardan capturas en `docs/screenshots`.

`pnpm dev:api` y `pnpm dev:mobile` permiten iniciar cada aplicación por separado. `pnpm db:studio` abre Prisma Studio; no forma parte del servicio público. La versión concreta de cada dependencia está fijada en el lockfile.

Consulta [el registro de verificación](docs/VERIFICATION.md) para distinguir las comprobaciones ejecutadas de los pasos pendientes por acceso externo.
