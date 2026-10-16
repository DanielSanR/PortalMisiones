QA manual — backlog backoffice (BO-1 a BO-12)

▎ Estado del front: `d964a04` o posterior (más el fix de la sección "Fichas por localidad" de la adopción, sección 15).
▎ Hay dos formas de correr el front; cada sección dice cuál usar:
▎ - **Local (backend actualizado)**: backend `dev` en Docker en :8080 + `cd backoffice && npm run start:local` en :4200
▎   (`environment.local.ts` + `proxy.local.cjs`, `/api` → `localhost:8080`). Etiquetas, plantillas, adopciones, fichas y
▎   puntos de atención van contra la API real. Preparación en la sección P.
▎ - **Staging (backend viejo)**: `cd backoffice && npm run start:staging`. Staging no tiene la API nueva: etiquetas,
▎   plantillas, adopciones, fichas y puntos van en mock. Pasada completa en `QA e2e en vivo — staging.md`.
▎ DevTools abierto en la pestaña Network. Usuarios: SA = sergio@misiones.gov.ar · AB = mariquena@vicegobernacion.gov.ar ·
▎ AO = silvestre@silicon.gov.ar (contraseña en `backoffice/login.data.md`, local y no versionado).
▎ Detalle de cada ítem en `BACKLOG_BACKOFFICE.md`.

Cómo forzar un error del backend: en Network, clic derecho sobre el request → "Block request URL", repetir la
acción, y después desbloquearlo (Network → "Network request blocking" → destildar). Un bloqueo da error de conexión
(status 0), suficiente para ver dónde se muestra el error.

---

P. Preparación del backend local (una vez por base)

Desde `PortalMisiones-backend/backend`, rama `dev`. La primera vez: `cp docker/.env.docker.example docker/.env.docker` y
completar los secretos (no van en este guion).

- [ ] **Solo Windows**: `./mvnw` falla dentro del contenedor por los fines de línea (CRLF). Creá un override local, sin
      versionar, `docker/docker-compose.windows.yml`:
      ```yaml
      services:
        backend:
          command: mvn spring-boot:run
      ```
      y sumalo como último `-f` en todos los comandos de abajo (`-f docker/docker-compose.windows.yml`).
- [ ] **Base nueva → crear el tipo `publication_status` antes del primer arranque (bug G-14).** Si no, la migración
      `V2.21` corta con `type "publication_status" does not exist` y el backend no arranca. Levantá solo Postgres y creá
      el tipo (la columna sigue siendo `VARCHAR`; el tipo solo hace que `V2.21` no falle):
      ```bash
      docker compose --env-file docker/.env.docker -f docker/docker-compose.yml -f docker/docker-compose.backend-dev.yml up -d postgres
      docker compose --env-file docker/.env.docker -f docker/docker-compose.yml -f docker/docker-compose.backend-dev.yml \
        exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
      CREATE TYPE publication_status AS ENUM ('BORRADOR','PUBLICADO');
      SQL
      ```
- [ ] Levantar todo:
      `docker compose --env-file docker/.env.docker -f docker/docker-compose.yml -f docker/docker-compose.backend-dev.yml up --build -d`.
      Esperá a que el log del backend (`docker logs -f portal-tramite-backend-dev`) diga que arrancó y aplicó las migraciones.
- [ ] **Aplicar los grants de R-3** (después de las migraciones; sin esto nadie tiene `*_TAG`, `*_ADOPTION` ni
      `*_ATTENTION_POINT`, ni siquiera SA). Mismo `exec -T postgres …` de arriba, con:
      ```sql
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r
      JOIN permissions p ON p.code IN ('CREATE_ADOPTION','READ_ADOPTION','UPDATE_ADOPTION','DELETE_ADOPTION')
      WHERE UPPER(r.code) IN ('SUPERADMIN','ADMIN_BACKOFFICE','ADMIN_ORGANIZATION')
      ON CONFLICT DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r
      JOIN permissions p ON p.code IN ('CREATE_ATTENTION_POINT','READ_ATTENTION_POINT','UPDATE_ATTENTION_POINT','DELETE_ATTENTION_POINT',
                                       'CREATE_TAG','READ_TAG','UPDATE_TAG','DELETE_TAG')
      WHERE UPPER(r.code) IN ('SUPERADMIN','ADMIN_BACKOFFICE','ADMIN_ORGANIZATION','AGENT')
      ON CONFLICT DO NOTHING;
      ```
      Verificación: la query de R-3 en `PEDIDOS_BACKEND.md` devuelve 44 filas. Iniciá sesión de nuevo después.
- [ ] Front: `cd backoffice && npm run start:local` → `http://localhost:4200`. En Network todas las llamadas salen a
      `localhost:4200/api/...` y el proxy las reenvía a :8080.
- [ ] Con SA, `GET /api/auth/me` trae `READ_TAG`, `READ_ADOPTION` y `READ_ATTENTION_POINT`. Si no, los grants no se
      aplicaron.
- [ ] Para probar fichas hace falta una adopción, y hoy el backend no deja crearlas (G-15, 500). Si no hay ninguna,
      sembrá una en la base local descartable (los ids son los de una plantilla y un organismo existentes):
      `insert into organism_procedures(id,procedure_template_id,organism_id,enabled,effective_from,effective_to) values (gen_random_uuid(),'<plantillaId>','<organismoId>',true,'2026-01-01 00:00:00+00','2027-12-31 23:59:59+00');`
      Nunca contra staging.

**Troubleshooting — "CORS / No 'Access-Control-Allow-Origin'" al iniciar sesión**
- Casi siempre significa que en el 8080 **no está el backend**. Verificá:
  `docker ps` (tiene que figurar `portal-tramite-backend-dev` *Up*) y `netstat -ano | findstr :8080`.
- En esta PC el servicio de Windows **`PEMHTTPD-x64`** (Apache de PostgreSQL Enterprise Manager) también escucha en
  el 8080 por IPv4: el navegador (`127.0.0.1`) le pega a ese Apache y Docker queda solo en IPv6. Detenelo desde una
  terminal **como administrador**: `net stop PEMHTTPD-x64` y, para que no vuelva solo, `sc config PEMHTTPD-x64 start= demand`.
- Los contenedores del setup viejo (`portal-tramite-db`, `-minio`, `-mailhog`) tienen reinicio automático y ocupan el
  5450: detenelos antes de levantar el stack nuevo.
- Desde el fix del login, ese caso se muestra como "No pudimos conectarnos con el servidor…" (no como credenciales).

---

0. Humo general — hacelo primero

- [x] Login con SA entra al Home sin errores en consola.
- [x] Navegar por TODAS las secciones del menú: ninguna rompe ni queda en blanco (Dashboard, Auditoría y Feedback
      cambiaron de arquitectura en BO-4; si no se registraron bien, rompen al entrar con `NullInjectorError`).

1. BO-6 — sesión desde `/api/auth/me`

- [x] Login con SA: en Network aparece `POST /api/auth/login` y enseguida `GET /api/auth/me` → 200, con header
      `Authorization: Bearer …` (mirá Request Headers).
- [x] El menú se arma igual que antes (todos los ítems para SA).
- [x] Fallback: bloqueá `/api/auth/me`, cerrá sesión y volvé a entrar → el login funciona igual (cae al JWT).
      Desbloqueá al terminar.
- [x] Refresh: dejá expirar el access token (o borralo a mano en Application → Local Storage → `access_token`
      con un valor viejo) y navegá → `POST /api/auth/refresh` seguido de `GET /api/auth/me`, sin volver al login.
- [ ] Mensajes del login según la causa:
  - Backend apagado o bloqueado (`docker stop portal-tramite-backend-dev`, o bloqueá `/api/auth/login` en Network):
    "No pudimos conectarnos con el servidor. Revisá tu conexión…". Nunca "credenciales".
  - Contraseña incorrecta: el mensaje del backend ("La contraseña ingresada es incorrecta.").
  - Volvé a levantar el backend al terminar.

2. BO-1 — acrónimo duplicado en Organismos (SA)

- [x] Organismos → Nuevo organismo, con el acrónimo de uno que ya existe (incluso uno dado de baja) → Guardar.
      Esperado: el campo *Acrónimo* queda en rojo con "Ya existe un organismo con ese acrónimo (también cuentan
      los dados de baja)" y el banner dice "No se pudo guardar: revisá el acrónimo."
- [x] Al editar el acrónimo, el error del campo desaparece.
- [x] Lo mismo desde la ficha → Editar de un organismo existente, poniéndole el acrónimo de otro.
- [x] En ningún caso aparece ADEMÁS el diálogo modal de error global (ver BO-11).

3. BO-11 — los errores se muestran una sola vez

- [x] Formularios: bloqueá el `POST`/`PUT` de cualquier ABM real (ej. Modalidades → Nueva) y guardá. Esperado:
      solo el banner rojo dentro del form. NO aparece el diálogo modal "Error de conexión" encima.
- [x] Borrado: en Modalidades (o Categorías, Destinatarios, Eventos, Tipos, Organismos, Roles, Permisos) bloqueá el
      `DELETE` y confirmá "Eliminar". Esperado: el modal de confirmación QUEDA ABIERTO, con el error en rojo adentro
      y los botones habilitados. Desbloqueá y tocá "Sí, eliminar" de nuevo → borra y cierra con snackbar.
- [x] Cancelar en el modal con el error visible lo cierra sin borrar nada.
- [x] Las CARGAS de listas (GET) siguen mostrando el diálogo global si fallan: eso no cambió.

4. BO-3 — acciones de cuenta de usuario  ⚠️ cambio de comportamiento (`d964a04`)

Usuarios corre con la fuente real en todas las configuraciones (local, staging y prod): alta y detalle reales, listado
mock hasta BO-17. Las acciones de cuenta antes respondían "éxito" sin tocar el backend; ahora con la fuente real **no
se ofrecen**.

- [ ] Local o staging, con SA y con AB: Usuarios → el menú de cada fila ofrece "Editar" (SA) y **no** ofrece Cambiar
      email, Cambiar contraseña, Activar/Desactivar cuenta ni Eliminar definitivamente. Si alguna aparece, es bug.
- [ ] Ninguna acción de la lista de usuarios genera `PUT`/`PATCH`/`DELETE` a `/api/user` en Network.
- [ ] Solo en desarrollo con `featureOverrides.usuarios: 'mock'` (no viene así en ningún environment) las acciones
      siguen existiendo sobre el mock: Cambiar email (minúsculas, snackbar "Email actualizado"), Cambiar contraseña
      (8 a 20, mayúscula/minúscula/número, snackbar "Contraseña actualizada"; no se ofrece en la fila SUPERADMIN),
      Desactivar/Activar y Eliminar definitivamente (modal rojo). Opcional.

5. BO-7 — quién puede hacer qué en Usuarios

Cada acción pide el permiso real del backend, y el formulario (crear / editar) pide además `READ_ORGANISM` + rol
admin, porque carga organismos y roles.

| Acción | SA | AB | AO |
|---|---|---|---|
| Ver la lista | ✅ | ✅ | ✅ |
| "Nuevo usuario" (botón, estado vacío, buscador de comandos) | ✅ | ❌ | ❌ |
| "Editar" en la fila | ✅ | ❌ | ❌ |
| Cambiar email / contraseña, Activar / Desactivar, Eliminar definitivamente | ❌ con fuente real (sección 4) | ❌ | ❌ |

- [ ] Verificá la tabla con los tres usuarios.
- [x] Con AB, entrar por URL a `/dashboard/usuarios/nuevo` y a `/dashboard/usuarios/editar/usr-2` → redirige a Home.
- [x] Con SA, las dos URLs abren el formulario normalmente.

6. BO-5 — Etiquetas en mock (`npm run start:staging`)

- [x] La lista muestra columnas Slug (con badge "Global"), Organismo ("—" en las globales) y Acciones.
      Ya no hay color, ícono ni estado Activa/Inactiva.
- [x] Chips "Todas / Globales / Locales" con contadores; al elegir uno aparece el filtro activo "Alcance: …" y se
      puede quitar.
- [ ] Nueva etiqueta con slug "  Niños y Adolescentes!" y organismo "Ninguno — etiqueta global" → se guarda como
      `ninos-y-adolescentes`, badge Global.
- [ ] Nueva etiqueta con slug `salud` y "Ninguno" → error en el campo slug ("Ya existe una etiqueta con ese slug en
      ese alcance"), porque ya hay una global con ese slug.
- [ ] Nueva etiqueta con slug `salud` y un organismo elegido → se guarda, badge Local y nombre del organismo.
- [ ] La misma `salud` local en el MISMO organismo otra vez → error en el campo slug.
- [ ] Editar una etiqueta precarga slug y organismo; buscar por nombre de organismo la encuentra.
- [ ] Eliminar → el modal nombra el slug; confirma y la fila desaparece.
- [ ] Ningún request a `/api/tag` en toda la sección (es mock).

7. BO-4 — Dashboard, Auditoría y Feedback (mock)

- [ ] Home/Dashboard se ve igual que antes: mismos widgets, números y porcentajes.
- [ ] Auditoría: lista, filtros, paginado y diálogo de detalle funcionan como antes.
- [ ] Feedback: lista, filtros, paginado y estadísticas funcionan como antes. El filtro "Hasta" incluye el día elegido.
- [ ] Cambiar rápido de página o de filtro varias veces seguidas → la tabla termina mostrando la ÚLTIMA selección.
- Los estados de error de estas tres pantallas no se pueden forzar desde DevTools: son mocks dentro de la app, no
  hacen requests reales. Quedan para cuando exista el backend.

8. BO-8 — build

- [ ] `cd backoffice && npx ng build` termina sin ningún WARNING (antes había 11 de budget).
- [ ] Nada en la app usaba gráficos; si algún widget muestra un canvas vacío o error de Chart.js, avisame (no
      debería: se verificó que ningún componente usa `baseChart`).

9. ~~Regresión rápida en Trámites~~ — obsoleto: el Trámites viejo (mock) se retiró en la fase 5. Ver la sección 14.

10. Guardarraíles (los corrí yo, repetilos si querés)

- [ ] `npx tsc -p tsconfig.app.json --noEmit` · `npm run lint` · `npm run check:circular` → todo en verde.
- [ ] `npx ng test --watch=false --browsers=ChromeHeadless` → todos los tests en verde.

---

11. Fixes del audit (`INFORME_AUDIT_CICLO_BACKLOG.md` §4)

- [ ] Dashboard: al entrar se ve un skeleton un instante y después el Home. (El error no se puede forzar: es mock.)
- [ ] Feedback: el resumen carga igual que antes.
- [ ] Organismo con acrónimo repetido: el banner ahora dice "Revisá el campo marcado." (ya no repite "No se pudo guardar").
- [ ] Etiqueta: al tipear el slug aparece debajo "Se guardará como: …" con la versión canónica.
- [ ] Evento de vida: al tipear el nombre aparece "Identificador (slug): …".
- [ ] Categoría: al tipear un slug con mayúsculas o espacios aparece "Formato sugerido: …".

12. Roles y Permisos tras PPDT-5.1 (backend `0ea13a0` o posterior → solo local)

- [ ] Con AB: Roles y Permisos aparecen en el menú y las listas cargan, pero NO hay "Nuevo rol"/"Nuevo permiso",
      ni Editar/Eliminar en las filas, ni "Crear rol"/"Crear permiso" en el buscador de comandos.
- [ ] Con AB, por URL a `/dashboard/roles/nuevo`, `/dashboard/roles/editar/<id>`, `/dashboard/permisos/nuevo` → redirige a Home.
- [ ] Con SA: todo lo anterior disponible; editar y eliminar funcionan (2xx), incluido el rol SUPERADMIN.
- [ ] Form de rol (SA): aparece el toggle "Asignable por Administrador de Backoffice". Editá el rol AGENT sin tocarlo y
      guardá → en Network, el `PUT /api/role/<id>` lleva `"assignableByBackoffice": true` (si llegara `false`, es bug).
- [ ] Apagá el toggle en un rol y guardá. Logueado como AB, llamá a `GET /api/role/allowed` (desde Swagger o Postman, con
      su token): ese rol ya no aparece. (El form de usuario no sirve para verificarlo con AB: necesita `READ_ORGANISM`.)
- [ ] El detalle de un rol en la lista dice "asignable por Admin de Backoffice" cuando corresponde.

13. Etiquetas contra el backend real (local, con los grants de R-3)

- [ ] La lista carga desde `GET /api/tag` (Network → 200). Ya no existe la columna "Trámites".
- [ ] (SA) Crear una global con slug "Niños y Adolescentes!" → `POST /api/tag` 201 y queda `ninos-y-adolescentes`.
- [ ] (SA) Repetir el mismo slug global → error en el campo Slug (`4072`, llega como 400: G-6), con banner y sin
      diálogo modal encima.
- [ ] (SA) Crear una local eligiendo un organismo → badge "Local" y el nombre del organismo.
- [ ] (SA) Editar y eliminar → `PUT`/`DELETE` 2xx; el modal de borrado nombra el slug.
- [ ] **Crear requiere `CREATE_TAG` + (`READ_ORGANISM` o rol SA/AB).** AB (sin `READ_ORGANISM`, rol AB): ve
      "Nueva etiqueta"; el form ofrece solo "Ninguno — etiqueta global" y **no** pide `GET /api/organism`.
- [ ] AO (y AGENT): **no** ven "Nueva etiqueta" (ni en el header, ni en el estado vacío, ni "Crear etiqueta" en el
      buscador de comandos); `/dashboard/etiquetas/nuevo` por URL → Home.
- [ ] Sin `READ_ORGANISM` (AB, AO) ninguna pantalla de Etiquetas pide `/api/organism` y **no** aparece el diálogo de
      error global.
- [ ] AO sin organismo asignado ve la lista **vacía** (el backend le devuelve `data: []`): gap G-17, no bug del front.

14. Trámites (plantillas, adopciones, fichas, puntos de atención)

▎ Plan, permisos y decisiones: `PLAN_TRAMITES_API.md` §1.6 y §8. Pedidos al backend: `PEDIDOS_BACKEND.md`.
▎ **Qué corre en real y qué en mock** (`environment*.ts` → `featureOverrides`):
▎
▎ | Feature | `start:local` | `start:staging` | `ng serve` (environment.ts) | prod |
▎ |---|---|---|---|---|
▎ | Plantillas provinciales | real | mock | real | mock hasta OPS-1 |
▎ | Etiquetas | real | mock | real | mock hasta OPS-1 |
▎ | Trámites del organismo (adopciones) | real | mock | mock | mock |
▎ | Fichas por localidad y puntos de atención | real | mock | mock | mock |
▎
▎ En mock no hay requests a esos endpoints y los datos se reinician al recargar la página.
▎ **El menú se arma por permiso.** Sin los grants de R-3 (sección P), ningún rol tiene `*_ADOPTION` ni
▎ `*_ATTENTION_POINT`. Volvé a iniciar sesión después de cambiar permisos.
▎ Usuarios: SA, AB y AO de la precondición. Para AGENT y MANAGER usá un usuario con ese rol (crealo con SA si no hay).

Humo y navegación
- [ ] El grupo **Trámites** del menú es el único acceso: "Plantillas provinciales", "Trámites del organismo" y "Fichas por
      localidad". En Contenidos ya NO está el ítem viejo "Trámites".
- [ ] Rutas viejas guardadas: `/dashboard/tramites`, `/dashboard/tramites/lista`, `/dashboard/tramites/nuevo`,
      `/dashboard/tramites/editar/x` y `/dashboard/tramites/detalle/x` → terminan en Plantillas provinciales (o en Home si
      el usuario no tiene `READ_PROCEDURE`, p. ej. AO).
- [ ] Buscador de comandos: "Crear trámite" ya no existe. Están "Crear plantilla", "Adoptar trámite" y "Revisar fichas por
      localidad", según los permisos de cada rol.
- [ ] Breadcrumb: cada pantalla muestra su sección ("Plantillas provinciales", "Trámites del organismo", "Fichas por
      localidad") y el paso ("Nueva plantilla", "Detalle", "Agregar localidad", "Editar ficha").
- [ ] Breadcrumb **solo linkea secciones visibles** para el usuario. AO en el detalle de una adopción:
      `Inicio > Trámites del organismo > …` con esos dos como link; en el detalle de una ficha: `Inicio > Fichas por
      localidad > …`. Ningún tramo linkea a una sección que el usuario no ve en el menú (p. ej. Plantillas para AO).
- [ ] Estado vacío con filtros: en cualquier lista (Plantillas, Adopciones, Fichas, Etiquetas, taxonomías, Organismos,
      Roles, Permisos) buscá algo que no exista → "Sin resultados" y el único botón es **"Limpiar filtros"**, que limpia la
      búsqueda. Sin filtros, el estado vacío ofrece "Crear …" solo si el usuario puede crear.

SA (todo)
- [ ] Plantillas: crear una con título "Obtener certificado de prueba" → `POST /api/procedure-template` 201. El slug se
      sugiere desde el título y es editable. Repetir el slug → error en el campo Slug, sin diálogo modal encima.
- [ ] Plantillas: editar (aviso "Guardar reemplaza la plantilla completa."), ver detalle y desactivar → `PUT`/`DELETE` 2xx.
      La desactivada desaparece de la lista: el backend no lista inactivas (P-4).
- [ ] Trámites del organismo (mock): "Adoptar trámite" abre el diálogo (también con el comando o `?adoptar=1`). Elegir
      plantilla, organismo y vigencia (datepicker en DD/MM/YYYY). Una vigencia que se superpone con otra adopción
      habilitada del mismo organismo y plantilla → error del mock con la forma del backend. (En real da 500: G-15.)
- [ ] Detalle de la adopción: badge de vigencia (vigente / programada / vencida / deshabilitada); editar fechas y salir sin
      guardar → aviso de cambios sin guardar. "Deshabilitar" desde la lista: con un filtro de organismo puesto, al recargarse la lista el filtro
      se mantiene (no se borra mientras carga).
- [ ] Fichas (mock): desde el detalle de una adopción → "Agregar localidad". Slug sugerido `slugBase-localidad`,
      editable; las localidades que ya tienen ficha aparecen deshabilitadas con "· ya tiene ficha"; elegir una usada →
      "Esa localidad ya tiene una ficha de este trámite".
- [ ] Workflow en el detalle de la ficha: `BORRADOR` → "Enviar a revisión" → `EN_REVISION` → "Publicar" → `PUBLICADO` →
      "Despublicar" → `DESPUBLICADO` → "Republicar". El badge cambia en cada paso. No existe "Enviar y publicar" (P-3).
- [ ] Fichas → tab "En revisión" con contador; el comando "Revisar fichas por localidad" abre esa tab.
- [ ] Editar una ficha `PUBLICADO` (mock) muestra "Esta ficha está publicada." (los cambios se ven en el portal al
      guardar, P-6) y el toggle **"Activa" está bloqueado** con el aviso "Está publicada: para desactivarla usá
      'Desactivar' en el detalle de la ficha…". Desactivarla desde el detalle la deja Desactivada + `DESPUBLICADO`.
- [ ] Puntos de atención (panel del detalle de la ficha): agregar uno con lat/long inválidas (fuera de rango o con más
      de 6 decimales) → error en el campo; con válidas → se guarda y "Ver en mapa" abre OpenStreetMap en ese punto.
      Editar y eliminar.

AB (Administrador de Backoffice)
- [ ] Ve "Plantillas provinciales" y gestiona plantillas (crear, editar), pero **no** tiene "Desactivar" (sin
      `DELETE_PROCEDURE`).
- [ ] **No** ve "Fichas por localidad" (sin `READ_VARIANT`) ni la lista de organismos.
- [ ] "Trámites del organismo" (con los grants de R-3): ve la lista, pero **no** ve "Adoptar trámite", porque no tiene
      `READ_ORGANISM` para elegir organismo (P-2).

AO (Administrador de Organismo)
- [ ] **No** ve "Plantillas provinciales" (sin `READ_PROCEDURE`, G-3). Por la misma razón no ve "Adoptar trámite" (P-2/G-2).
- [ ] Ve "Trámites del organismo" (con `*_ADOPTION`) y "Fichas por localidad". Desde una adopción, "Agregar localidad".
- [ ] Workflow completo con su permiso `PUBLISH_VARIANT`: enviar a revisión, publicar, despublicar, republicar.
- [ ] Gestiona puntos de atención (con `*_ATTENTION_POINT`).

AGENT
- [ ] Ve "Fichas por localidad" pero **no** "Trámites del organismo" ni "Agregar localidad" (sin `READ_ADOPTION` ni
      `CREATE_VARIANT`).
- [ ] Edita una ficha existente (mock) y la envía a revisión. **No** ve "Publicar" ni "Despublicar" (sin `PUBLISH_VARIANT`).
- [ ] Gestiona puntos de atención (con `*_ATTENTION_POINT`).

MANAGER
- [ ] Solo lectura: ve "Plantillas provinciales" y "Fichas por localidad" sin "Nueva plantilla", "Editar", "Desactivar",
      acciones de workflow ni alta de puntos. No ve "Trámites del organismo".

15. Fichas por localidad con el backend real (G-1) — fix de la sección de la adopción

Con `start:local` el backend devuelve la ficha solo con `id, slug, publicationStatus, active, currentVersionNumber` (G-1):
no dice a qué adopción ni a qué localidad pertenece.

- [ ] Detalle de una adopción que tiene fichas → sección "Fichas por localidad": **no** dice "Todavía no se ofrece en
      ninguna localidad". Muestra "No podemos listar las fichas de este trámite todavía" ("El servidor no informa a qué
      trámite del organismo pertenece cada ficha…") y el link **"Ver Fichas por localidad"** abre la lista general.
- [ ] "Agregar localidad" sigue disponible en esa sección (con `CREATE_VARIANT`).
- [ ] Form de alta ("Agregar localidad"): aviso amarillo "No podemos validar si la localidad ya tiene una ficha de este
      trámite…" con link a "Fichas por localidad"; la ayuda del select dice que no se puede validar. Ninguna localidad
      aparece como "ya tiene ficha" ni deshabilitada (no se afirma que estén libres). El slug repetido **sí** se sigue
      validando ("No puede repetirse con otra ficha").
- [ ] "Editar" una ficha real → "Esta ficha todavía no se puede editar" sin formulario (guardar borraría requisitos,
      costos y URL). En el detalle, localidad, URL, requisitos y costos se ven como "no disponible".
- [ ] Con el mock (`start:staging`) todo sigue como antes: la sección lista las fichas de la adopción (o el vacío
      "Todavía no se ofrece en ninguna localidad" si no tiene) y el form marca las localidades ocupadas.

16. Casos contra el backend local real (`npm run start:local`, preparación P)

Alineado con el e2e (`e2e/plan.md`, corrida `run_7`). Todo lo que crees con prefijo `E2E-`. Mirá Network en cada paso.

SA
- [ ] Etiquetas: global con slug "  E2E Global Ñandú Público!" → vista previa "Se guardará como: e2e-global-nandu-publico",
      `POST /api/tag` 201, badge Global; repetirla → 400 `4072` en el campo Slug, sin diálogo; local de un organismo →
      201, badge Local; editar → `PUT` 200; borrar las dos → `DELETE` 200.
- [ ] Plantillas: alta con categoría principal (queda dentro de las categorías elegidas) y una etiqueta → `POST
      /api/procedure-template` 201 → detalle; slug duplicado → 400 `4072` en el campo; editar → `PUT` 200; desactivar →
      `DELETE` 200 y sale de la lista.
- [ ] Adopciones: "Adoptar trámite" → hoy `POST /api/organism-procedure` 500 (G-15): el error se ve **dentro** del
      diálogo, que queda abierto, sin diálogo global. Sobre una adopción sembrada (P): el detalle muestra plantilla,
      organismo y vigencia; la plantilla muestra "Organismos que la adoptaron" con "· Vigente"; "Deshabilitar" → `DELETE`
      200 y sale de la lista. Editar la vigencia → 500 (G-15), error en el form.
- [ ] Fichas: desde la adopción, "Agregar localidad" → Posadas → slug `…-posadas` → `POST
      /api/organism-procedure-location` 201, `BORRADOR` v1. Workflow real: "Enviar a revisión" (`submit-review` 200 →
      `EN_REVISION` v2), "Publicar" (`publish` 200 → `PUBLICADO` v3), "Despublicar" (`unpublish` 200 → `DESPUBLICADO`
      v4); el badge cambia en cada paso y la ficha aparece en la lista general. "Desactivar" → `DELETE` 200, badge
      "Desactivada". Sección 15 para la edición y la sección de la adopción.
- [ ] Puntos de atención (panel de la ficha): lat `95` o long con 7 decimales → "Tiene que estar entre -90 y 90" / "Hasta
      6 decimales" y **ningún** `POST`; alta válida (-27,367104 / -55,896108) → `POST /api/attention-point` 201; editar →
      `PUT` 200; desactivar → `DELETE` 200 y aparece "Mostrar inactivos (1)".

AB
- [ ] Menú: Plantillas provinciales, Trámites del organismo y Etiquetas sí; Organismos, Tipos y Fichas por localidad no.
- [ ] Plantillas: crea y edita; sin "Desactivar". Adopciones: lista sin "Adoptar trámite". Etiquetas: sección 13.

AO
- [ ] Menú: Inicio, Etiquetas, Trámites del organismo, Fichas por localidad, Usuarios, Feedback. Por URL
      `/dashboard/tramites/plantillas`, `/dashboard/etiquetas/nuevo`, `/dashboard/usuarios/nuevo` → Home.
- [ ] Fichas: workflow completo (enviar a revisión, publicar, despublicar) con 2xx. Puntos de atención: alta, edición y
      desactivación con 2xx.
- [ ] Etiquetas: lista vacía y sin "Nueva etiqueta" (sección 13).

AGENT (si hay un usuario AGENT)
- [ ] Ve "Fichas por localidad" sin "Trámites del organismo" ni "Agregar localidad"; en el detalle de una ficha ve
      "Enviar a revisión" pero no "Publicar"/"Despublicar". Sin "Nueva etiqueta".

---

Gaps conocidos — **no reportar como bugs**
- **R-3** (grants de `V2.20`/`V2.23`/`V2.24`): en una base sin el SQL de la sección P nadie tiene `*_TAG`, `*_ADOPTION`
  ni `*_ATTENTION_POINT`: Etiquetas, "Trámites del organismo" y los puntos de atención no aparecen ni para SA.
- **G-1** (response de la ficha incompleto): en real la ficha no trae adopción, localidad, URL, requisitos ni costos →
  edición bloqueada, "no disponible" en el detalle, sección de la adopción "no disponible" y sin validación de
  localidad duplicada (sección 15). En staging y prod fichas y puntos van en mock.
- **G-2 / BO-20** (organismo del usuario en `/api/auth/me`): AO no puede adoptar ("Adoptar trámite" oculto); AO/AGENT no
  crean etiquetas (sin "Nueva etiqueta").
- **G-3**: AO no lista plantillas; AGENT no ve de qué trámite es cada ficha.
- **G-4**: no hay "Rechazar" (`EN_REVISION → BORRADOR`) ni "Volver a borrador" desde `DESPUBLICADO`.
- **G-13**: el borrado definitivo de usuarios falla en el backend (500). El front ya no lo ofrece con fuente real.
- **G-14**: el backend `dev` no arranca sobre una base nueva sin crear antes el tipo `publication_status` (sección P).
- **G-15**: adopciones `POST`/`PUT /api/organism-procedure` → 500 (consulta de solapamiento con parámetros `null` sin
  tipo). No se pueden crear ni editar adopciones reales, ni probar el `4080` de solapamiento.
- **G-16**: borrar una categoría usada por una plantilla → 500 (FK) en vez de 409. El front muestra el error genérico.
- **G-17**: AO sin organismo asignado ve la lista de etiquetas vacía (`GET /api/tag` le devuelve `[]`, ni las globales).
- **BO-17**: sin `GET /api/user` el listado de usuarios es mock y no hay acciones de cuenta con fuente real (sección 4).
- **OPS-1**: staging tiene el backend viejo → con `start:staging` y en `environment.prod` etiquetas y plantillas van en
  mock (y adopciones, fichas y puntos también).
- **G-6**: el `4072` de duplicados llega como 400 (no 409).
- Sin resumen de feedback por ficha (P-7) y sin plantillas/adopciones inactivas en las listas (P-4): decisiones, no bugs.

Lo que NO entra en este QA (pendiente del backend)

- Acciones de cuenta de usuario contra el backend real (BO-17, G-13).
- Alta y edición real de adopciones (G-15) y edición real de fichas (G-1). Dashboard/Auditoría/Feedback reales, upload
  de archivos, reCAPTCHA.

Los puntos con más chance de sorpresa (mirá primero estos):
1. Usuarios ya no ofrece Cambiar email/contraseña, Activar/Desactivar ni Eliminar con fuente real (sección 4) — cambio
   intencional: antes reportaban éxito sin tocar el backend.
2. La sección "Fichas por localidad" de la adopción dice "No podemos listar…" con el backend real (sección 15) —
   intencional mientras siga G-1.
3. El modal de borrado ya no se cierra solo cuando falla (BO-11) — cambio intencional.
4. `/api/auth/me` sin Bearer: si el request sale sin header `Authorization`, es bug (BO-6).
