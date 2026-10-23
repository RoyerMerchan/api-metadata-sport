# Verificación de FOOTLAB

Fecha: 23 de octubre de 2026. Entorno: Windows, zona America/Caracas. Este registro distingue la ejecución local de los pasos externos pendientes.

## Ejecutado

| Comprobación | Resultado |
| --- | --- |
| Instalación `pnpm install --frozen-lockfile --offline` con dependencias ya descargadas | Correcta; lockfile consistente |
| `pnpm lint` | Sin errores |
| `pnpm typecheck` | API, Vue y shared correctos |
| `pnpm test` | 11 pruebas aprobadas |
| `pnpm test:integration` | 30 pruebas aprobadas contra PostgreSQL real separado, también con `VERCEL=1` y su pool activo |
| `pnpm test:e2e` | 4 recorridos aprobados: escritorio y viewport Android, incluidos equipos simultáneos e invitaciones |
| Build NestJS y Vue | Correctos |
| PostgreSQL local nativo | Creado, iniciado y persistido en `.local/postgres`; acceso limitado a loopback |
| Migraciones | 4 aplicadas a desarrollo y a la base de pruebas |
| Prisma diff entre la base local y el esquema | `No difference detected` |
| Seed | Ejecutado dos veces sin duplicar los identificadores iniciales; demostración señalizada |
| API compilada con `NODE_ENV=production` | Health HTTP 200; Swagger HTTP 404 |
| Healthcheck con fallo de consulta inyectado | HTTP 503 sin información sensible |
| Configuración Vercel | Ambos `vercel.json` validados contra el esquema oficial; roots de API y web documentados |
| Corrección del primer build Vercel | Retirado el patrón `functions.src/main.ts` que produjo `[unused_function]`; el preset NestJS detecta el entrypoint y la duración se configura en el proyecto |
| Builds para Vercel | Comandos locales de API con migraciones y web ejecutados; publicación remota a cargo del propietario |
| Dependencia cloud | SDK anterior retirado; `@vercel/functions` y gestión de conexiones PostgreSQL añadidos |
| APK debug | Compilado mediante el script completo: Vue → Capacitor → Gradle → comprobación del archivo |
| Identidad APK | `com.footlab.app`, etiqueta FOOTLAB, SDK mínimo 24, target 36 |
| Firma APK | Verificada con Android SDK `apksigner`; esquema v2 |
| Contenido APK | Cliente con URL de emulador, plugin nativo FootlabVault y ausencia de URI PostgreSQL en el bundle web |
| Protección release | Rechaza compilación sin URL HTTPS real de producción |

Las pruebas de API incluyen registro y login, Argon2id, validación estricta, roles, aislamiento al manipular IDs, escritura y lectura deportivas, convocatorias, eventos, clasificación, cálculo por 90, favoritos, evaluaciones, restricciones SQL, rotación y reutilización de refresh, logout, recuperación y revocación de sesiones. Los adaptadores se prueban con fixtures: StatsBomb se importa dos veces y football-data utiliza HTTP simulado con PostgreSQL real.

La suite de equipos comprueba creación del espacio y equipo al registrarse, equipo activo por dispositivo y persistencia al renovar tokens, invitaciones ligadas al correo, revocación, caducidad, canje concurrente único, permisos del emisor, conservación de roles y retirada inmediata de acceso. Se verifica también HTTP 413 para JSON mayor de 4 MB. Las pruebas del cliente descartan respuestas tardías de una cuenta anterior sin borrar la sesión nueva.

Los recorridos de interfaz usan endpoints reales: login, dashboard del club demo, creación y archivado de un jugador, comparación, recarga con renovación de sesión y logout. Se corrigió una condición de carrera en la carga inicial del club. Las capturas de escritorio y Android están en `docs/screenshots`.

El segundo recorrido registra dos cuentas en contextos de navegador separados, crea equipos privados con ambos flujos de alta, genera una invitación desde la UI, la acepta con rol VIEWER, cambia de equipo, recarga, cierra una cuenta y reutiliza la misma pestaña con la otra. Se comprueba que el jugador privado no aparece fuera de su espacio.

## APK entregado

Ruta: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

La URL de este debug es **`http://10.0.2.2:3000/api/v1`**, para un emulador Android con la API del PC en ejecución. Para un teléfono físico hace falta recompilar con una IP LAN accesible o con el dominio HTTPS que el propietario publique en Vercel.

El tamaño y SHA256 del archivo final se registran en `docs/APK.json`. Se usaron JDK 21 dentro de `.cache/jdk21`, Android SDK 36, Capacitor 8.5.3 y Gradle 8.14.3. La distribución Gradle se verificó con su checksum SHA256 oficial. Google Maven devolvía 404 en este entorno; se usó un init script temporal con un espejo público y la variable `FOOTLAB_GRADLE_INIT`. La configuración Gradle del repositorio conserva los repositorios oficiales.

## Pendiente de acceso o configuración del propietario

- El propietario indicó que desplegará después en Vercel. No se crearon proyectos, bases cloud ni dominios. Vercel CLI 65.2.0 respondió `Logged out`; no se publicó un despliegue temporal ni se contrataron recursos.
- El código está publicado en `main` de `https://github.com/RoyerMerchan/api-metadata-sport.git`. La cuenta autenticada se comprobó mediante GitHub API antes de subir. GitHub identifica autor, committer y actor de la publicación como **RoyerMerchan**. Se verificó que el HEAD remoto coincide con el local. El workflow se activó; su resultado remoto puede consultarse en la pestaña Actions y no se confunde con las pruebas locales documentadas arriba.
- Quedan para el propietario: importar ambos proyectos, conectar PostgreSQL, configurar variables por entorno y comprobar el healthcheck HTTPS público. Los pasos están en `docs/DEPLOYMENT.md`.
- El APK release firmado requiere la URL pública y las credenciales de firma proporcionadas fuera del repositorio. No se generó una firma release de producción.
- No había dispositivos ni emuladores conectados en `adb devices`. No se probó instalación, ejecución del Keystore ni navegación Atrás en Android nativo; se verificaron compilación nativa y comportamiento web con viewport Android.
- No se consultó football-data.org con una clave real ni se importó un dataset completo externo. Las pruebas de los adaptadores usan fixtures identificados como pruebas en la base de test.
- El envío SMTP real necesita un servidor configurado. La lógica de recuperación de un solo uso y revocación de sesiones sí se prueba en la API.
- Docker Desktop no tenía motor activo. Se verificó la alternativa de PostgreSQL nativo; `docker compose` queda preparado para un entorno con Docker activo.

Las instrucciones completas de desarrollo, integración de fuentes, despliegue y firma están en el README raíz.
