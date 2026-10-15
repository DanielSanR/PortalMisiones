# QA e2e en vivo — staging

Pasada end-to-end del backoffice contra el backend **online** de staging, sin Docker, ordenada por rol y por flujo de
usuario real. Para el detalle fino de cada ítem se remite a `QA manual — backlog backoffice (BO-1 a BO-12).md`
(abajo: **QA §N**). Relevado el 2026-10-15.

> **Staging es compartido.** Todo lo que crees lleva el prefijo `E2E-` (o `e2e-` en slugs) y se borra al final
> (sección 4). No edites ni borres datos ajenos. No crees usuarios reales salvo que puedas borrarlos (ver 3.1.9).

---

## 1. Preparación

```bash
nvm use 20.11.0
cd backoffice
npm ci                 # solo si no tenés node_modules o cambió package-lock.json
npm run start:staging  # ng serve --configuration staging + proxy.staging.cjs
```

- [ ] La consola del `ng serve` termina en `Local: http://localhost:4200/` sin errores de compilación.
- [ ] Abrí `http://localhost:4200` → pantalla de login.
- [ ] DevTools → **Network**: tildá **Preserve log** y filtrá por `Fetch/XHR`. Todas las llamadas reales salen a
      `localhost:4200/api/...` (same-origin); el proxy las reenvía a `https://tramitesmisiones.api.dev.stagemnes.net.ar`
      y quita el header `Origin` (staging da 403 a cualquier request con `Origin`, y no admite CORS desde localhost).
- [ ] En la terminal del `ng serve` ves las líneas `[HPM] …` del proxy por cada request.

**Forzar un error del backend:** en Network, clic derecho sobre el request → **Block request URL**, repetí la acción y
después desbloqueá (Network → ⋮ → More tools → **Network request blocking** → destildar). El bloqueo da status 0
("Error de conexión"), suficiente para ver dónde aparece el error.

**Ver features que staging no tiene permisos para mostrar** (Etiquetas, Trámites del organismo, Puntos de atención): la
sesión se restaura desde Local Storage al recargar, así que podés inyectar permisos **solo en tu navegador**, sin tocar
staging:
1. Logueado, DevTools → **Application → Local Storage → `http://localhost:4200` → `user_data`**.
2. Editá el JSON y agregá al array `permissions`:
   `"READ_TAG","CREATE_TAG","UPDATE_TAG","DELETE_TAG","READ_ADOPTION","CREATE_ADOPTION","UPDATE_ADOPTION","DELETE_ADOPTION","READ_ATTENTION_POINT","CREATE_ATTENTION_POINT","UPDATE_ATTENTION_POINT","DELETE_ATTENTION_POINT"`
3. **F5**. Los ítems aparecen en el menú. Se pierden al cerrar sesión o al refrescarse el token (vuelve a llamar a
   `/api/auth/me`): repetí el paso si desaparecen.

> No crees esos permisos en la pantalla Permisos de staging para "probar": es data compartida y el backend viejo no los usa.

---

## 2. Qué es real y qué es mock en staging

Fuente: `backoffice/src/environments/environment.staging.ts` (`featureOverrides`). Mock = sin requests a staging; los
datos mock se reinician al recargar (F5).

| Sección | Fuente | Requests esperados / nota |
|---|---|---|
| Login, refresh, sesión | **real** | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh` |
| Organismos | **real** | `/api/organism` (+ `/api/organism-type` para el select) |
| Tipos de Organismo | **real** | `/api/organism-type` |
| Categorías | **real** | `/api/category` |
| Modalidades | **real** | `/api/modality` |
| Eventos de Vida | **real** | `/api/life-event` |
| Destinatarios | **real** | `/api/recipient` |
| Roles / Permisos | **real** | `/api/role`, `/api/permission`. Staging no devuelve `assignableByBackoffice` (es pre PPDT-5.1) |
| Localidades (selects) | **real** | `/api/department`, `/api/location` |
| Usuarios | **híbrido** | Alta real (`POST /api/user`); listado, edición y acciones de fila **mock** (no existe `GET /api/user`) |
| Etiquetas | **mock** | Staging no tiene `/api/tag`. Requiere inyectar `*_TAG` (§1) |
| Plantillas provinciales | **mock** | Staging no tiene `/api/procedure-template` |
| Trámites del organismo (adopciones) | **mock** | Staging no tiene `/api/organism-procedure`. Requiere inyectar `*_ADOPTION` (§1) |
| Fichas por localidad | **mock** | Staging no tiene `/api/organism-procedure-location` |
| Puntos de atención | **mock** | Staging no tiene `/api/attention-point`. Requiere inyectar `*_ATTENTION_POINT` (§1) |
| Dashboard, Auditoría, Feedback | **mock** | Sin backend en ningún entorno |

Si en una sección **mock** ves un request a `/api/tag`, `/api/procedure-template`, `/api/organism-procedure*` o
`/api/attention-point` → **es bug** (el override no se aplicó; en staging respondería 500 `5000`).

---

## 3. Flujos por rol

Usuarios (todos con `<ver backoffice/login.data.md>`):
**SA** `sergio@misiones.gov.ar` · **AB** `mariquena@vicegobernacion.gov.ar` · **AO** `silvestre@silicon.gov.ar`.
Entre rol y rol: **Cerrar sesión** desde el menú de usuario (no solo cerrar la pestaña).

### 3.1 SUPERADMIN (SA)

#### 3.1.1 Login y sesión (QA §1)
- [ ] Login con SA → Home sin errores en consola. Network: `POST /api/auth/login` 200 y enseguida `GET /api/auth/me` 200.
- [ ] En `GET /api/auth/me` → Request Headers: `Authorization: Bearer eyJ…`. **Sin Bearer = bug.**
- [ ] Response de `/me`: ~47 permisos; **no** trae `*_TAG`, `*_ADOPTION` ni `*_ATTENTION_POINT` (R-3, esperado).
      Anotá si trae `READ_PROCEDURE` y `READ_VARIANT`: si no, Plantillas y Fichas tampoco aparecen y hay que inyectarlos (§1).
- [ ] Credenciales inválidas → error inline en el form de login, sin diálogo modal.
- [ ] Fallback: bloqueá `/api/auth/me`, cerrá sesión y entrá de nuevo → entra igual (cae al JWT). Desbloqueá.
- [ ] Refresh: en Local Storage reemplazá `access_token` por un valor vencido/inválido y navegá a otra sección →
      `POST /api/auth/refresh` 200 + `GET /api/auth/me` 200, sin volver al login.

#### 3.1.2 Humo de todo el menú (QA §0)
- [ ] Recorré cada ítem: Inicio, Organismos, Tipos de Organismo, Categorías, Modalidades, Eventos de Vida,
      Destinatarios, Plantillas provinciales, Fichas por localidad, Usuarios, Roles, Permisos, Auditoría,
      Feedback Ciudadano. Ninguna queda en blanco ni tira `NullInjectorError` en consola.
- [ ] Sin permisos inyectados **no** aparecen Etiquetas ni Trámites del organismo (R-3). Inyectalos (§1) → aparecen.
- [ ] Las listas reales cargan con 200; las mock no generan requests (tabla §2).
- [ ] Breadcrumb: en un detalle o form (ej. Organismos → Detalle) muestra `Inicio > Organismos > Detalle`; **"Inicio"
      y "Organismos" son links** y navegan; el último tramo no es clickeable.
- [ ] Rutas viejas: `/dashboard/tramites`, `/dashboard/tramites/nuevo` → terminan en Plantillas provinciales.
- [ ] Una URL inexistente dentro del dashboard (`/dashboard/xyz`) → Home (no el login).

#### 3.1.3 Organismos (QA §2, BO-1)
- [ ] Tipos de Organismo → Nuevo: `E2E-Tipo` → `POST /api/organism-type` 2xx, aparece en la lista.
- [ ] Organismos → Nuevo: nombre `E2E-Organismo`, acrónimo `E2E1015`, tipo `E2E-Tipo` → `POST /api/organism` 2xx,
      snackbar de éxito, aparece en la lista como `E2E-Organismo (E2E1015)`.
- [ ] Nuevo con el acrónimo de un organismo existente (copiá uno de la lista) → `POST` 409 con código `4069`; el campo
      *Acrónimo* en rojo: "Ya existe un organismo con ese acrónimo (también cuentan los dados de baja)"; banner
      "Revisá el campo marcado."; **sin** diálogo modal encima. Al editar el acrónimo el error del campo se va.
- [ ] Desde la **lista**, menú de la fila de `E2E-Organismo` → Editar (URL con `?origen=lista`) → cambiá el nombre a
      `E2E-Organismo editado` → Guardar → `PUT /api/organism/<id>` 2xx y **vuelve a la lista** (no a la ficha).
- [ ] Desde la **ficha** → Editar → Cancelar/Guardar → vuelve a la ficha.
- [ ] Editar `E2E-Organismo` poniéndole el acrónimo de otro → mismo error `4069` en el campo.
- [ ] Organismos migrados (V1.7) sin acrónimo se listan sin paréntesis: **no es bug** (§5).

#### 3.1.4 Taxonomía: Categorías, Modalidades, Eventos de Vida, Destinatarios
Para cada una, con nombres `E2E-…`:
- [ ] **Categorías** → Nueva `E2E-Categoria` (slug con mayúsculas/espacios muestra "Formato sugerido: …") →
      `POST /api/category` 2xx. Editar → `PUT` 2xx.
- [ ] **Modalidades** → Nueva `E2E-Modalidad` → `POST /api/modality` 2xx. Editar → `PUT` 2xx.
- [ ] **Eventos de Vida** → Nuevo `E2E-Evento` (aparece "Identificador (slug): …") → `POST /api/life-event` 2xx. Editar.
- [ ] **Destinatarios** → Nuevo `E2E-Destinatario` → `POST /api/recipient` 2xx. Editar.
- [ ] Duplicado: repetí el nombre/slug de uno ya creado → error inline (`4072`, en staging puede venir 400; G-6), sin
      diálogo modal.

#### 3.1.5 Errores inline sin diálogo duplicado (QA §3, BO-11)
- [ ] Modalidades → Nueva `E2E-Bloqueo`, bloqueá `/api/modality` y guardá → **solo** el banner rojo del form; no aparece
      el diálogo "Error de conexión". Desbloqueá y guardá → 2xx.
- [ ] Borrado con error: bloqueá el `DELETE /api/modality/<id>` de `E2E-Bloqueo` y confirmá "Eliminar" → el modal **queda
      abierto** con el error en rojo adentro y botones habilitados. Desbloqueá → "Sí, eliminar" → 2xx, cierra, snackbar.
- [ ] Con el error visible, "Cancelar" cierra sin borrar.
- [ ] Una CARGA de lista (GET) bloqueada sí muestra el diálogo global (comportamiento esperado).

#### 3.1.6 Cambios sin guardar
- [ ] En cualquier form real (ej. editar `E2E-Categoria`) cambiá un campo y tocá otro ítem del menú o el breadcrumb →
      diálogo "Salir sin guardar" / "Hay cambios sin guardar en este formulario. Si salís ahora se pierden.".
      Cancelar → seguís en el form con el cambio; "Salir sin guardar" → navega sin request.
- [ ] Sin cambios, salir no pregunta nada. Después de guardar, salir no pregunta nada.

#### 3.1.7 Roles y Permisos (QA §12)
- [ ] Roles y Permisos: listas cargan (`GET /api/role`, `GET /api/permission` 200); SA ve "Nuevo", Editar y Eliminar.
- [ ] Permisos → Nuevo `E2E_PERMISO` (descripción `E2E-…`) → `POST /api/permission` 2xx.
- [ ] Roles → Nuevo `E2E-Rol` con `E2E_PERMISO` → `POST /api/role` 2xx. El form muestra el toggle
      **"Asignable por Administrador de Backoffice"**.
- [ ] Editá `E2E-Rol` con el toggle **encendido** y guardá → en el payload del `PUT /api/role/<id>` va
      `"assignableByBackoffice": true`. Staging viejo lo ignora: al reabrir el rol el toggle vuelve apagado y la lista no
      dice "asignable por Admin de Backoffice" → **esperado en staging** (§5), no bug.
- [ ] **No** edites roles ni permisos existentes (SUPERADMIN, AGENT, etc.): staging es compartido.

#### 3.1.8 Usuarios — acciones de fila mock (QA §4, §11)
Todo esto opera sobre el mock: **no** genera requests y se pierde con F5.
- [ ] Fila AGENT/ADMIN_ORGANIZATION → "⋮": Cambiar email, Cambiar contraseña y, separados en rojo, Desactivar cuenta y
      Eliminar definitivamente. En la fila SUPERADMIN **no** está "Cambiar contraseña".
- [ ] Cambiar email: precargado, "Guardar" deshabilitado sin cambios ("Ingresá un email distinto al actual…");
      `Nuevo.Mail@Misiones.gob.ar` → snackbar **"Email actualizado"** y la fila en minúsculas.
- [ ] Cambiar contraseña: `abc` → error de largo; `abcdefgh` → mayúscula/minúscula/número; distintas → "Las contraseñas
      no coinciden"; `Prueba123` ×2 → snackbar **"Contraseña actualizada"**. El ojo muestra/oculta ambas.
- [ ] Eliminar definitivamente: modal rojo con el nombre en negrita → snackbar "Usuario eliminado", la fila desaparece.
- [ ] Desactivar / Activar cuenta cambia el estado de la fila.

#### 3.1.9 Usuarios — alta real (opcional, crea un usuario en staging)
Hacelo **solo** si `GET https://tramitesmisiones.api.dev.stagemnes.net.ar/api-docs` lista `DELETE /api/user/{id}/admin`
(si no, no hay forma de borrarlo después: salteá este bloque).
- [ ] Usuarios → Nuevo: nombre `E2E`, apellido `Usuario`, email `e2e-usuario+1015@example.com`, rol AGENT →
      `POST /api/user` 2xx. **Copiá el `id` del response** (Network → Response).
- [ ] El usuario **no** aparece en la lista (es mock): esperado.
- [ ] Email repetido → error inline en el form, sin diálogo modal.

#### 3.1.10 Etiquetas (mock — con `*_TAG` inyectados) (QA §6)
- [ ] Lista con columnas Slug (badge "Global"), Organismo ("—" en globales) y Acciones; chips Todas/Globales/Locales.
- [ ] Nueva → el form **abre** (antes rompía con `DataCloneError … structuredClone`); al tipear el slug aparece
      "Se guardará como: …".
- [ ] Slug `  E2E Niños!` + "Ninguno — etiqueta global" → se guarda `e2e-ninos`, badge Global.
- [ ] Repetir el mismo slug global → error en el campo Slug, sin diálogo.
- [ ] Mismo slug eligiendo un organismo (el select carga con `GET /api/organism` real) → badge Local + nombre del organismo.
- [ ] Editar precarga slug y organismo; Eliminar nombra el slug. Ningún request a `/api/tag`.

#### 3.1.11 Trámites (mock) (QA §14, bloque SA)
- [ ] **Plantillas**: Nueva "Obtener certificado E2E" → slug sugerido editable; guardar → aparece. Repetir slug → error
      en el campo. Editar (aviso "Guardar reemplaza la plantilla completa."), detalle y Desactivar → desaparece (P-4).
- [ ] **Trámites del organismo** (con `*_ADOPTION`): "Adoptar trámite" (también `?adoptar=1` o comando) → plantilla,
      organismo y vigencia con datepicker DD/MM/YYYY. Vigencia superpuesta con otra habilitada del mismo
      organismo+plantilla → error. Detalle: badge vigente/programada/vencida/deshabilitada; editar fechas y salir sin
      guardar → aviso. "Deshabilitar" desde la lista.
- [ ] **Fichas**: desde el detalle de una adopción → "Agregar localidad" (localidades reales de `/api/location`); slug
      sugerido `slugBase-localidad`; localidad repetida → "Esa localidad ya tiene una ficha de este trámite".
- [ ] Workflow en el detalle: `BORRADOR` → "Enviar a revisión" → `EN_REVISION` → "Publicar" → `PUBLICADO` →
      "Despublicar" → `DESPUBLICADO` → "Republicar". Badge cambia en cada paso. No hay "Enviar y publicar" (P-3).
- [ ] Tab "En revisión" con contador; comando "Revisar fichas por localidad" abre esa tab. Editar una ficha publicada →
      "Esta ficha está publicada.".
- [ ] **Puntos de atención** (con `*_ATTENTION_POINT`, panel del detalle de la ficha): lat `-95` o con 7 decimales →
      error en el campo; `-27.367`/`-55.896` → se guarda, "Ver en mapa" abre OpenStreetMap ahí. Editar y eliminar.
- [ ] Ningún request a `/api/procedure-template`, `/api/organism-procedure*` ni `/api/attention-point` en todo el bloque.

#### 3.1.12 Mock sin backend (QA §7)
- [ ] Dashboard, Auditoría (filtros, paginado, diálogo de detalle) y Feedback cargan; cambiar rápido de filtro/página
      deja la ÚLTIMA selección.

### 3.2 ADMIN_BACKOFFICE (AB)

- [ ] Login → `/me` trae `*_CATEGORY`, `*_MODALITY`, `*_LIFE_EVENT`, `*_RECIPIENT`, `*_TAXONOMY` y
      `CREATE/READ/UPDATE/DELETE_USER`; nada de organismos ni procedure.
- [ ] **Ve**: Inicio, Categorías, Modalidades, Eventos de Vida, Destinatarios, Usuarios, Roles, Permisos, Feedback.
- [ ] **No ve**: Organismos, Tipos de Organismo, Etiquetas, Plantillas provinciales, Trámites del organismo, Fichas
      por localidad, Auditoría.
- [ ] Taxonomía: crear `E2E-AB-Modalidad` → `POST /api/modality` 2xx; editarla y borrarla → 2xx.
- [ ] Por URL: `/dashboard/organismos/lista`, `/dashboard/tipos-organismo/lista`, `/dashboard/tramites/plantillas`,
      `/dashboard/auditoria` → redirigen a Home.
- [ ] **Roles y Permisos en lectura**: las listas cargan, pero **no** hay "Nuevo rol"/"Nuevo permiso", ni
      Editar/Eliminar en filas, ni "Crear rol"/"Crear permiso" en el buscador de comandos.
      ⚠️ El backend viejo de staging todavía le **permitiría** escribir; que la UI lo oculte es **intencional** (PPDT-5.1).
- [ ] Por URL: `/dashboard/roles/nuevo`, `/dashboard/roles/editar/<id de E2E-Rol>`, `/dashboard/permisos/nuevo` → Home.
- [ ] **Usuarios** (mock, QA §5): ve Cambiar email, Cambiar contraseña, Activar/Desactivar y Eliminar definitivamente;
      **no** ve "Nuevo usuario" ni "Editar" (le falta `READ_ORGANISM`). Probá una acción de cada una → snackbar.
- [ ] Por URL: `/dashboard/usuarios/nuevo` y `/dashboard/usuarios/editar/usr-2` → Home.

### 3.3 ADMIN_ORGANIZATION (AO)

- [ ] Login → `/me` trae solo `CREATE_USER` y `READ_USER` (más sus roles).
- [ ] **Ve**: Inicio, Usuarios, Feedback Ciudadano. Nada más (ni taxonomía, ni Trámites, ni Roles/Permisos, ni Auditoría).
- [ ] Usuarios en **lectura**: sin "Nuevo usuario" (tiene `CREATE_USER` pero no `READ_ORGANISM`), sin acciones de fila.
- [ ] Por URL → Home en todos: `/dashboard/usuarios/nuevo`, `/dashboard/organismos/lista`, `/dashboard/categorias/lista`,
      `/dashboard/roles/lista`, `/dashboard/permisos/lista`, `/dashboard/tramites/plantillas`, `/dashboard/tramites/fichas`,
      `/dashboard/auditoria`, `/dashboard/tramites` (redirige a plantillas → Home).
- [ ] Buscador de comandos: no ofrece acciones de creación.

---

## 4. Limpieza de staging (con SA)

Borrá en este orden (las dependencias primero). Cada `DELETE` debe dar 2xx.

- [ ] Organismo `E2E-Organismo editado` → Eliminar. ⚠️ Si el backend hace baja lógica, queda "dado de baja" y su
      acrónimo `E2E1015` queda reservado: anotalo y usá otro sufijo la próxima vez.
- [ ] Tipo de Organismo `E2E-Tipo`.
- [ ] Categoría `E2E-Categoria`, Modalidades `E2E-Modalidad` / `E2E-Bloqueo` / `E2E-AB-Modalidad`, Evento `E2E-Evento`,
      Destinatario `E2E-Destinatario`.
- [ ] Rol `E2E-Rol` y después permiso `E2E_PERMISO`.
- [ ] Usuario de 3.1.9 (si lo creaste): `DELETE /api/user/<id>/admin` con el token de SA. Desde la terminal (curl no
      manda `Origin`):
      `curl -X DELETE "http://localhost:4200/api/user/<id>/admin" -H "Authorization: Bearer <access_token de SA>"`
- [ ] Lo mock (etiquetas, plantillas, adopciones, fichas, puntos, acciones de usuarios) no necesita limpieza: F5.
- [ ] Local Storage: **Cerrar sesión** (borra `user_data` con los permisos inyectados).

**Verificación:** con SA, en cada lista real (Organismos, Tipos, Categorías, Modalidades, Eventos de Vida, Destinatarios,
Roles, Permisos) buscá `E2E` → **sin resultados**. Si algo no se pudo borrar, anotalo en el reporte con su id.

---

## 5. Gaps conocidos — no reportar como bug

- **Staging viejo (≈ `d800be0`)**: sin `/api/tag`, API de trámites ni PPDT-5.1. Una ruta inexistente responde 500
  `5000`. Por eso Etiquetas, Plantillas, Adopciones, Fichas y Puntos van en mock acá.
- **PPDT-5.1 ausente**: `GET /api/role` no trae `assignableByBackoffice` → el toggle aparece apagado y la lista nunca dice
  "asignable…"; el backend permitiría a AB escribir roles/permisos aunque la UI lo oculte.
- **R-3**: ningún rol tiene `*_TAG`, `*_ADOPTION`, `*_ATTENTION_POINT` → Etiquetas, Trámites del organismo y Puntos de
  atención no aparecen sin inyectar permisos (§1). Confirmado en staging.
- **G-1**: fichas y puntos de atención en mock en todos los entornos.
- **G-2 / BO-20**: la sesión no trae el organismo del usuario → AO no puede "Adoptar"; AO/AGENT no crean etiquetas locales.
- **G-6**: el `4072` de duplicados de taxonomía viene 400 (no 409).
- **Listado de usuarios mock** (BO-17, sin `GET /api/user`): edición y acciones de fila no tocan el backend, se pierden
  con F5; un usuario creado de verdad no aparece en la lista.
- **Acrónimos nulos**: organismos migrados en V1.7 no tienen acrónimo; la lista y la edición lo muestran vacío.
- Decisiones de producto (no bugs): sin "Enviar y publicar" (P-3), sin inactivas en listas (P-4), sin "Rechazar" ni
  "Volver a borrador" (G-4), sin resumen de feedback por ficha (P-7).

---

## 6. Plantilla para reportar un bug

~~~markdown
### [Sección] Título corto en infinitivo (ej. "Guardar organismo duplica el diálogo de error")

- **Rol:** SA | AB | AO          - **Paso del guion:** 3.1.3, 3er ítem
- **URL:** http://localhost:4200/dashboard/...
- **Fuente:** real | mock         - **Commit del front:** `git rev-parse --short HEAD`

**Pasos**
1. …
2. …

**Esperado**
…

**Obtenido**
…

**Network** (request relevante)
- `MÉTODO /api/...` → status `…`, código de negocio `…`
- Payload: ```json … ```
- Response: ```json … ```

**Consola:** (errores, si hay)

**Screenshot:** (adjuntar)
~~~

Antes de reportar, chequeá que no esté en la sección 5.
