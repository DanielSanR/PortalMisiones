QA manual — backlog backoffice (BO-1 a BO-12)

▎ Precondición: backend `dev` (`2e41090` o posterior) corriendo en :8080. Desde `PortalMisiones-backend/backend`, la primera vez
▎ `cp docker/.env.docker.example docker/.env.docker` (y completar secretos), después
▎ `docker compose --env-file docker/.env.docker -f docker/docker-compose.yml -f docker/docker-compose.backend-dev.yml up --build`
▎ (el viejo `docker-compose.dev.yml` de la raíz ya no existe: se movió a `docker/docker-compose.backend-dev.yml`). Front con
▎ `cd backoffice && npx ng serve` en :4200, DevTools abierto en la pestaña Network. Usuarios en `login.data.md`:
▎ SA = sergio@misiones.gov.ar · AB = mariquena@vicegobernacion.gov.ar · AO = silvestre@silicon.gov.ar (pass `<ver backoffice/login.data.md>`).
▎ Detalle de cada ítem en `BACKLOG_BACKOFFICE.md`.

Cómo forzar un error del backend: en Network, clic derecho sobre el request → "Block request URL", repetir la
acción, y después desbloquearlo (Network → "Network request blocking" → destildar). Un bloqueo da error de conexión
(status 0), suficiente para ver dónde se muestra el error.

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

4. BO-3 — acciones nuevas de usuario (SA)

⚠️ El listado de usuarios es mock (el backend no tiene `GET /api/user`): estas acciones operan sobre el mock y se
pierden al recargar la página. Es esperado. No vas a ver requests a :8080 por estas acciones.

- [x] Usuarios → menú "⋮" de una fila de rol AGENT u ADMIN_ORGANIZATION: muestra Cambiar email, Cambiar contraseña,
      y separados abajo en rojo Desactivar cuenta y Eliminar definitivamente.
- [x] En la fila del SUPERADMIN (Carlos Fernández) NO aparece "Cambiar contraseña" (el backend lo rechaza, 403 4029).
- [x] Cambiar email:
  - [x] Abre precargado con el email actual; "Guardar" deshabilitado hasta que cambia.
  - [x] Un email inválido muestra "El email ingresado no es válido".
  - [x] Con "Nuevo.Mail@Misiones.gob.ar" → snackbar "Email actualizado" y la fila muestra `nuevo.mail@misiones.gob.ar`
        (en minúsculas).
- [x] Cambiar contraseña:
  - [x] "abc" → error de largo (8 a 20). "abcdefgh" → "Tiene que incluir mayúscula, minúscula y número".
  - [x] Dos contraseñas distintas → "Las contraseñas no coinciden"; Guardar deshabilitado.
  - [x] "Prueba123" en ambos → snackbar "Contraseña actualizada".
- [x] Eliminar definitivamente:
  - [x] El modal es rojo, nombra al usuario en negrita y sugiere desactivar como alternativa.
  - [x] "Sí, eliminar" → spinner en el botón, se cierra, snackbar "Usuario eliminado" y la fila desaparece.
- [x] Desactivar / Activar cuenta sigue funcionando como antes.

5. BO-7 — quién puede hacer qué en Usuarios  ⚠️ cambio de comportamiento respecto del QA de RBAC

Antes toda la gestión de usuarios era solo para SA. Ahora cada acción pide el permiso real del backend, y solo el
formulario (crear / editar) pide además `READ_ORGANISM` + rol admin, porque carga organismos y roles.

| Acción | SA | AB | AO |
|---|---|---|---|
| Ver la lista | ✅ | ✅ | ✅ |
| "Nuevo usuario" (botón, estado vacío, buscador de comandos) | ✅ | ❌ | ❌ |
| "Editar" en la fila | ✅ | ❌ | ❌ |
| Cambiar email / contraseña, Activar / Desactivar | ✅ | ✅ **nuevo** | ❌ |
| Eliminar definitivamente | ✅ | ✅ **nuevo** | ❌ |

- [x] Verificá la tabla con los tres usuarios. Que AB ahora vea esas acciones NO es bug.
- [x] Con AB, entrar por URL a `/dashboard/usuarios/nuevo` y a `/dashboard/usuarios/editar/usr-2` → redirige a Home.
- [x] Con SA, las dos URLs abren el formulario normalmente.

6. BO-5 — Etiquetas con el modelo real (mock)

- [x] La lista muestra columnas Slug (con badge "Global"), Organismo ("—" en las globales), Trámites y Acciones.
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
- [ ] Con un usuario que vea Etiquetas pero no tenga `READ_ORGANISM` (AB, si el seed le da permisos `*_TAXONOMY`):
      el form abre igual y el select de organismo solo ofrece "Ninguno". Si AB no ve Etiquetas en el menú, salteá esto.

7. BO-4 — Dashboard, Auditoría y Feedback (mock)

- [ ] Home/Dashboard se ve igual que antes: mismos widgets, números y porcentajes.
- [ ] Auditoría: lista, filtros, paginado y diálogo de detalle funcionan como antes.
- [ ] Feedback: lista, filtros, paginado y estadísticas funcionan como antes.
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

---

11. Fixes del audit (`INFORME_AUDIT_CICLO_BACKLOG.md` §4)

- [ ] Dashboard: al entrar se ve un skeleton un instante y después el Home. (El error no se puede forzar: es mock.)
- [ ] Feedback: el resumen carga igual que antes.
- [ ] Usuarios: logueado como SA, si tu email aparece en la lista, tu fila NO ofrece Desactivar ni Eliminar.
      (Con el listado mock puede que tu usuario no figure; en ese caso se verifica cuando exista `GET /api/user`.)
- [ ] Diálogo "Cambiar email": con el email sin cambios, la ayuda dice "Ingresá un email distinto al actual…".
- [ ] Diálogo "Cambiar contraseña": el botón del ojo muestra u oculta las dos contraseñas; los errores tienen ícono
      y los mismos textos que el resto de los formularios ("No debe ser menor a los 8 caracteres", etc.).
- [ ] Organismo con acrónimo repetido: el banner ahora dice "Revisá el campo marcado." (ya no repite "No se pudo guardar").
- [ ] Etiqueta: al tipear el slug aparece debajo "Se guardará como: …" con la versión canónica.
- [ ] Evento de vida: al tipear el nombre aparece "Identificador (slug): …".
- [ ] Categoría: al tipear un slug con mayúsculas o espacios aparece "Formato sugerido: …".
- [ ] Trámites → Nuevo/Editar: los selects de etiquetas y modalidades siguen cargando (dependen de rutas mock que se conservaron).

12. Roles y Permisos tras PPDT-5.1 (backend `0ea13a0` o posterior)

- [ ] Con AB: Roles y Permisos aparecen en el menú y las listas cargan, pero NO hay "Nuevo rol"/"Nuevo permiso",
      ni Editar/Eliminar en las filas, ni "Crear rol"/"Crear permiso" en el buscador de comandos.
- [ ] Con AB, por URL a `/dashboard/roles/nuevo`, `/dashboard/roles/editar/<id>`, `/dashboard/permisos/nuevo` → redirige a Home.
- [ ] Con SA: todo lo anterior disponible; editar y eliminar funcionan (2xx), incluido el rol SUPERADMIN.
- [ ] Form de rol (SA): aparece el toggle "Asignable por Administrador de Backoffice". Editá el rol AGENT sin tocarlo y
      guardá → en Network, el `PUT /api/role/<id>` lleva `"assignableByBackoffice": true` (si llegara `false`, es bug).
- [ ] Apagá el toggle en un rol y guardá. Logueado como AB, llamá a `GET /api/role/allowed` (desde Swagger o Postman, con
      su token): ese rol ya no aparece. (El form de usuario no sirve para verificarlo con AB: necesita `READ_ORGANISM`.)
- [ ] El detalle de un rol en la lista dice "asignable por Admin de Backoffice" cuando corresponde.

13. Etiquetas contra el backend real (backend `84fde37` o posterior)

- [ ] La lista carga desde `GET /api/tag` (Network → 200). Ya no existe la columna "Trámites".
- [ ] Crear una global con slug "Niños y Adolescentes!" → `POST /api/tag` 201 y queda `ninos-y-adolescentes`.
- [ ] Repetir el mismo slug global → error en el campo Slug (`4072`), sin diálogo modal encima.
- [ ] (SA) Crear una local eligiendo un organismo → badge "Local" y el nombre del organismo.
- [ ] Editar y eliminar → `PUT`/`DELETE` 2xx; el modal de borrado nombra el slug.
- [ ] Con AO o AGENT: el menú muestra Etiquetas y la lista trae solo las locales de su organismo. Al crear, si el form solo
      ofrece "global", el backend responde `4073` y se marca en el campo Organismo — es el gap conocido BO-20, no un bug nuevo.

14. Trámites (plantillas, adopciones, fichas, puntos de atención)

▎ Plan, permisos y decisiones: `PLAN_TRAMITES_API.md` §1.6 y §8. Pedidos al backend: `PEDIDOS_BACKEND.md`.
▎ **Qué corre en real y qué en mock** (`environment*.ts` → `featureOverrides`):
▎ - Plantillas provinciales → **real** (`/api/procedure-template`). Se ve en Network.
▎ - Trámites del organismo (adopciones) → **mock** hasta R-3. No hay requests a `/api/organism-procedure`.
▎ - Fichas por localidad y puntos de atención → **mock** hasta G-1. No hay requests a `/api/organism-procedure-location`
▎   ni a `/api/attention-point`. Los datos mock se reinician al recargar la página.
▎ **El menú se arma por permiso.** Con R-3 sin corregir, ningún rol tiene `*_ADOPTION` ni `*_ATTENTION_POINT`: "Trámites
▎ del organismo" y el panel de puntos no aparecen ni para SA. Para probarlos, asigná esos permisos a mano desde Roles (SA)
▎ según la tabla de §1.6 del plan. Volvé a iniciar sesión después de cambiar permisos.
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

SA (todo)
- [ ] Plantillas: crear una con título "Obtener certificado de prueba" → `POST /api/procedure-template` 201. El slug se
      sugiere desde el título y es editable. Repetir el slug → error en el campo Slug, sin diálogo modal encima.
- [ ] Plantillas: editar (aviso "Guardar reemplaza la plantilla completa."), ver detalle y desactivar → `PUT`/`DELETE` 2xx.
      La desactivada desaparece de la lista: el backend no lista inactivas (P-4).
- [ ] Trámites del organismo: "Adoptar trámite" abre el diálogo (también con el comando o `?adoptar=1`). Elegir
      plantilla, organismo y vigencia (datepicker en DD/MM/YYYY). Una vigencia que se superpone con otra adopción
      habilitada del mismo organismo y plantilla → error del mock con la forma del backend.
- [ ] Detalle de la adopción: badge de vigencia (vigente / programada / vencida / deshabilitada); editar fechas y salir sin
      guardar → aviso de cambios sin guardar. "Deshabilitar" desde la lista.
- [ ] Fichas: desde el detalle de una adopción → "Agregar localidad". Slug sugerido `slugBase-localidad`, editable; repetir
      una localidad ya usada → "Esa localidad ya tiene una ficha de este trámite".
- [ ] Workflow en el detalle de la ficha: `BORRADOR` → "Enviar a revisión" → `EN_REVISION` → "Publicar" → `PUBLICADO` →
      "Despublicar" → `DESPUBLICADO` → "Republicar". El badge cambia en cada paso. No existe "Enviar y publicar" (P-3).
- [ ] Fichas → tab "En revisión" con contador; el comando "Revisar fichas por localidad" abre esa tab.
- [ ] Editar una ficha `PUBLICADO` muestra "Esta ficha está publicada." (los cambios se ven en el portal al guardar, P-6).
- [ ] Puntos de atención (panel del detalle de la ficha): agregar uno con lat/long inválidas (fuera de rango o con más
      de 6 decimales) → error en el campo; con válidas → se guarda y "Ver en mapa" abre OpenStreetMap en ese punto.
      Editar y eliminar.

AB (Administrador de Backoffice)
- [ ] Ve "Plantillas provinciales" y gestiona plantillas (crear, editar), pero **no** tiene "Desactivar" (sin
      `DELETE_PROCEDURE`).
- [ ] **No** ve "Fichas por localidad" (sin `READ_VARIANT`) ni la lista de organismos.
- [ ] "Trámites del organismo" (si R-3 está resuelto o con permisos asignados a mano): ve la lista, pero **no** ve
      "Adoptar trámite", porque no tiene `READ_ORGANISM` para elegir organismo (P-2).

AO (Administrador de Organismo)
- [ ] **No** ve "Plantillas provinciales" (sin `READ_PROCEDURE`, G-3). Por la misma razón no ve "Adoptar trámite" (P-2/G-2).
- [ ] Ve "Trámites del organismo" (con `*_ADOPTION`) y "Fichas por localidad". Desde una adopción, "Agregar localidad".
- [ ] Workflow completo con su permiso `PUBLISH_VARIANT`: enviar a revisión, publicar, despublicar, republicar.
- [ ] Gestiona puntos de atención (con `*_ATTENTION_POINT`).

AGENT
- [ ] Ve "Fichas por localidad" pero **no** "Trámites del organismo" ni "Agregar localidad" (sin `READ_ADOPTION` ni
      `CREATE_VARIANT`).
- [ ] Edita una ficha existente y la envía a revisión. **No** ve "Publicar" ni "Despublicar" (sin `PUBLISH_VARIANT`).
- [ ] Gestiona puntos de atención (con `*_ATTENTION_POINT`).

MANAGER
- [ ] Solo lectura: ve "Plantillas provinciales" y "Fichas por localidad" sin "Nueva plantilla", "Editar", "Desactivar",
      acciones de workflow ni alta de puntos. No ve "Trámites del organismo".

Gaps conocidos — **no reportar como bugs**
- **R-3** (grants de `V2.20`/`V2.23`/`V2.24`): sin permisos asignados a mano, "Trámites del organismo" y los puntos de
  atención no aparecen para ningún rol, y Etiquetas tampoco. Adopciones siguen en mock por esto.
- **G-1** (response de la ficha incompleto): fichas y puntos corren en mock. En real, editar borraría requisitos, costos
  y URL, por eso no se activan todavía.
- **G-2** (organismo del usuario en `/api/auth/me`): AO no puede adoptar; "Adoptar trámite" se le oculta.
- **G-3**: AO no lista plantillas; AGENT no ve de qué trámite es cada ficha cuando el backend sea real.
- **G-4**: no hay "Rechazar" (`EN_REVISION → BORRADOR`) ni "Volver a borrador" desde `DESPUBLICADO`.
- Sin resumen de feedback por ficha (P-7) y sin plantillas/adopciones inactivas en las listas (P-4): decisiones, no bugs.

Lo que NO entra en este QA (pendiente del backend)

- Acciones de usuario contra el backend real (necesita `GET /api/user` para que los ids de la lista existan).
- Adopciones, fichas y puntos de atención en real (R-3, G-1; ver sección 14), Dashboard/Auditoría/Feedback reales, upload
  de archivos, reCAPTCHA.

Los puntos con más chance de sorpresa (mirá primero estos):
1. AB ahora gestiona credenciales y estado de usuarios (BO-7) — cambio intencional.
2. El modal de borrado ya no se cierra solo cuando falla (BO-11) — cambio intencional.
3. `/api/auth/me` sin Bearer: si el request sale sin header `Authorization`, es bug (BO-6).
