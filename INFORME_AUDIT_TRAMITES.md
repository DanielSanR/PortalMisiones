# Audit — Trámites

Fecha: 2026-08-14 · Rama: `feat/tramites-audit` · Modo: **AUDIT** (propone, no implementa)

Alcance: `pages/tramites/list`, `pages/tramites/detail`, `pages/tramites/create`
(1.739 líneas entre TS, HTML y SCSS).

## Checklists consultadas

| Checklist | Aplicada a |
|---|---|
| `design-system/table` | lista |
| `design-system/searchbar` | lista |
| `flows/filtering-items` | lista |
| `web-app/empty-state` | lista, detalle |
| `web-app/single-item-detail` | detalle |
| `design-system/tabs` | detalle, formulario |
| `flows/submitting-a-form` | formulario |
| `flows/saving-changes` | formulario, acciones de workflow |
| `design-system/loading` | formulario, detalle |
| `flows/deleting-account` | confirmación destructiva (patrón) |

---

## Resumen ejecutivo

**24 hallazgos: 11 🔴 bloqueantes, 9 🟡 mejoras, 4 🔵 pulido.**

Trámites es la pantalla más importante del backoffice y la que quedó más atrás.
No es que le falten features: **está tomando decisiones sobre datos que no tiene y
ofreciendo acciones que no ejecuta.**

Tres patrones se repiten y explican 9 de los 11 bloqueantes:

1. **Errores tragados.** Once `subscribe` no tienen rama `error`, o la tienen vacía.
   Cuando algo falla, la pantalla no lo dice: se queda vacía, muestra ceros, o
   simplemente no pasa nada.
2. **Acciones que mienten.** "Vista previa" está en dos menús y es un `console.log`.
   El ordenamiento de la tabla está activado pero el filtro no tiene campo de orden.
   Ninguna acción está gateada por permiso: el menú ofrece Publicar y Eliminar a
   cualquiera que pueda leer.
3. **Trámites nunca se migró.** Es la única sección que sigue inyectando servicios
   directamente en el componente, contra `.claude/rules/arquitectura-capas.md`.

---

## Pantalla 1 — Lista (`pages/tramites/list`)

### 🔴 T-01 · "Vista previa" es una acción muerta, visible en el menú
`tramites-list.component.ts:205-214` — el cuerpo está comentado y queda un
`console.log("deshabilitado temporalmente")`. El ítem se dibuja igual
(`tramites-list.component.html:113-115`) y no está deshabilitado.

Clickearlo no hace nada y no dice nada. La convención acordada en Organismos es
mostrar lo que no funciona **deshabilitado, pero a la vista**.

### 🔴 T-02 · Ninguna acción está gateada por permiso
Ni el CTA `Nuevo trámite` (`html:2`) ni un solo ítem del menú (`html:107-135`)
usan `*appHasPermission`. Comparar con Organismos y Tipos de Organismo, donde
cada acción declara su permiso.

La UI ofrece Editar, Publicar, Despublicar y Eliminar a cualquiera que tenga
`READ_PROCEDURE`. El backend rechazará, pero el usuario ya hizo el clic y recibe
un error genérico en vez de no ver la opción.

### 🔴 T-03 · Publicar y Despublicar son acciones de cara al ciudadano y no piden confirmación
`ts:227-247` — `onPublish` / `onUnpublish` disparan de inmediato desde el menú
contextual. Publicar hace visible el trámite en el portal público; despublicar lo
saca. Son las dos acciones de mayor alcance del backoffice y las únicas sin
confirmación, mientras que borrar un tipo de organismo sí la pide.

### 🔴 T-04 · Un error de carga se ve como "no se encontraron trámites"
`ts:109-112` — el `error` solo apaga `loading`. La tabla cae al vacío
(`html:69`). Mismo patrón ya corregido en Organismos y Tipos.
`web-app/empty-state` · *Error state variant*.

### 🔴 T-05 · Las tres acciones de workflow fallan en silencio
`ts:216-247` — `sendToReview`, `publish` y `unpublish` solo tienen `next`. Si el
backend rechaza (permiso, estado inválido, validación), no aparece nada: el
usuario ve el trámite sin cambiar de estado y sin explicación.
`flows/saving-changes` paso 5.

### 🔴 T-06 · La tabla dice que ordena, y no ordena
`html:62` declara `[sortable]="true"`, pero `onSortChange` (`ts:189-191`) descarta
el evento (`_event`) y vuelve a pedir la misma página. Y no podría hacer otra
cosa: **`TramiteFilter` no tiene campo de orden** (`core/models/tramite.model.ts:59-71`).

Los encabezados responden al clic, dibujan la flecha y la lista no cambia.

### 🟡 T-07 · El contador de "Todos" miente cuando hay filtros
`ts:179` usa `totalItems`, que es el total **ya filtrado** que devolvió el backend.
Con un filtro puesto, el chip "Todos" muestra el subconjunto. Además "Publicados" y
"Requieren revisión" no tienen `count` (`ts:180-181`), así que la barra mezcla un
número engañoso con dos vacíos.

### 🟡 T-08 · Cuatro filtros y ninguna forma de ver ni quitar lo aplicado
Búsqueda, Organismo, Estado y Localidad (`html:9-47`), más los chips de estado.
No hay barra de filtros activos ni "limpiar todo". Es la lista con más filtros del
backoffice y la única sin esa barra, que ya existe como `app-active-filters`.
`flows/filtering-items` pasos 4 y 5.

### 🟡 T-09 · El buscador no es el del diseño
`html:10-14` usa `mat-form-field` con label flotante y subscript. El diseño
especifica la caja plana de 34px, hoy disponible como `app-list-search`. Es el
mismo problema que se corrigió en Organismos, donde el subscript desalineaba la fila.

### 🟡 T-10 · Estado vacío sin título, sin CTA y sin distinguir los dos casos
`html:69` — solo `emptyMessage="No se encontraron trámites"`. El texto ya asume
"no hay resultados" aunque no haya ningún filtro puesto, y no ofrece salida ni
para crear el primero ni para limpiar filtros. `web-app/empty-state`.

### 🟡 T-11 · Las acciones de fila no usan el componente compartido
`html:102-137` mantiene su propio `mat-menu`. Las otras seis listas ya usan
`app-row-actions`, que resuelve el gateo por permiso, la acción primaria visible,
el orden de los destructivos y el estado `busy`.

### 🔵 T-12 · `isSuperAdmin` decide por rol, no por permiso
`ts:94` y `html:16`, `html:122`. El proyecto migró a gatear por permiso; acá
sobrevive el rol hardcodeado para mostrar el filtro de Organismo y la acción
Publicar.

### 🔵 T-13 · Dos icon sets en la misma celda
`html:76` usa `mat-icon` para `row.icono`, el resto del backoffice usa Phosphor.

---

## Pantalla 2 — Detalle (`pages/tramites/detail`)

### 🔴 T-14 · Si la carga falla, la pantalla queda literalmente en blanco
`ts:83-86` apaga `loading` sin marcar error, y el template envuelve todo en
`@if (!loading && tramite)` (`html:12`). Sin trámite no se dibuja **nada**: ni
mensaje, ni reintento, ni explicación. Solo queda el botón de volver del header.

Es peor que el caso de la lista: ahí al menos se veía un vacío. Acá el usuario ve
una página en blanco y no sabe si el trámite no existe, si no tiene permiso o si
se cayó la API.

### 🔴 T-15 · Un id inexistente produce la misma página en blanco
Mismo `@if`. No hay rama para 404. `web-app/empty-state` pide distinguir
"no hay nada" de "falló la carga"; acá no hay ninguna de las dos.

### 🔴 T-16 · Si el feedback falla, la pantalla afirma que no hay valoraciones
`ts:90-101` — `loadFeedback` no tiene `error`. Los contadores quedan en 0 y el
template muestra **"Este trámite aún no recibió valoraciones"** (`html:168-173`).

No es una pantalla incompleta: es un dato falso presentado como hecho.

### 🔴 T-17 · "Vista previa" muerta, otra vez
`ts:109-120` — mismo `console.log`, botón visible y habilitado en el header
(`html:2-4`).

### 🟡 T-18 · Sin acciones de workflow donde más se necesitan
`web-app/single-item-detail` pide que las acciones sobre el ítem vivan en su
detalle. Enviar a revisión, Publicar y Despublicar existen solo en el menú de la
lista. Estando parado en el trámite, con toda la ficha a la vista —que es cuando
uno decide publicar—, no hay forma de hacerlo.

### 🟡 T-19 · Sin acción destructiva, y sin separación de las primarias
`web-app/single-item-detail` · *Destructive actions*. Eliminar no está en el
detalle. Las dos acciones que hay (Vista previa, Editar) están juntas sin jerarquía.

### 🟡 T-20 · No sigue el patrón de detalle que quedó en Organismos
Organismos tiene barra de identidad, pestañas y ficha en grilla. Trámites apila
`mat-card` sueltas (`html:13-176`) con `mat-divider` entre filas. Son dos lenguajes
distintos para la misma clase de pantalla.

### 🔵 T-21 · Icon set mezclado en toda la pantalla
`preview`, `edit`, `open_in_new`, `star`, `public`, `location_on`, `forum`,
`thumb_up`, `arrow_forward`, `event_note` son `mat-icon`. El resto del backoffice
es Phosphor.

---

## Pantalla 3 — Formulario (`pages/tramites/create`)

### 🔴 T-22 · Se puede escribir en un formulario que todavía no cargó, y perderlo
`html:9-14` renderiza `app-dynamic-form` de entrada, con `initialData = null`. En
edición, mientras cargan los siete catálogos y el trámite (`ts:88`, un `forkJoin`
de 7-8 requests), el formulario está **vacío y editable**. Cuando llega la
respuesta, `initialData` pisa lo que el usuario haya escrito.

No hay `app-loading` en esta pantalla, aunque el detalle sí lo usa.
`design-system/loading` · *Visual indicator* + *Time*.

### 🔴 T-23 · Si falla la carga inicial, el formulario queda vacío para siempre y en silencio
`ts:88-115` (edición) y `ts:117-121` (alta): ningún `error`. Y `forkJoin` falla
entero si **una sola** de las ocho fuentes falla, así que un catálogo caído deja
la pantalla muerta sin decir nada. En edición es peor: parece un alta, y guardar
sobrescribiría el trámite con lo que el usuario tipee.

### 🔴 T-24 · Un guardado fallido no muestra nada
`ts:211-214` — solo `saving = false`. `DynamicFormComponent` ya acepta
`[serverError]` y `extractErrorMessage` ya existe; ninguno se usa acá.
`flows/submitting-a-form` paso 4.

### 🔴 T-25 · El formulario más largo del backoffice no avisa al salir con cambios sin guardar
No implementa `PuedeTenerCambiosSinGuardar` y la ruta no declara `canDeactivate`
(`pages.module.ts:60-61`). Organismos y Tipos de Organismo sí. Acá hay dos
pestañas, ~20 campos y sub-formularios por localidad: es donde más caro sale
perderlo.

### 🟡 T-26 · Las cuatro operaciones de "contenido por localidad" fallan en silencio
`ts:224-244` (cargar), `ts:260-278` (agregar), `ts:288-305` (editar),
`ts:307-327` (borrar): ninguna tiene `error`. Un alta que falla deja el panel
abierto sin explicación, y la lista no se actualiza.

### 🟡 T-27 · "Guardar" de localidad no tiene estado de envío
`html:93-96` — sin `saving`, se puede clickear repetidamente y disparar N altas.
`flows/submitting-a-form` paso 2.

### 🟡 T-28 · El sub-formulario de localidad no valida nada
`html:78-85` — "URL Iniciar trámite" y "Sitio web" son texto libre con placeholder
`https://...`. No hay validación de formato ni mensaje de error.
`flows/showing-input-error`.

### 🔵 T-29 · El sub-formulario es template-driven en una app reactiva
`html:57-143` usa `[(ngModel)]` mientras el resto del backoffice es
`ReactiveFormsModule`. Funciona, pero convive mal con la validación reactiva que
pide T-28.

---

## Transversal

### 🔴 T-30 · Trámites es la única sección sin migrar a la arquitectura de capas
Los tres componentes inyectan servicios directamente:
`TramiteService`, `OrganismoService`, `LocalidadService`, `EventoDeVidaService`,
`CategoriaService`, `DestinatarioService`, `FeedbackService`
(`list:23-25`, `detail:16-17`, `create:18-23`).

`.claude/rules/arquitectura-capas.md` es explícito: *"Prohibido inyectar
HttpClient, Services, Repositories o DataSources en un componente"*. No existe
`core/features/tramites/`.

Esto no es cosmético: es lo que hace que los otros 29 hallazgos sean caros de
arreglar de a uno.

### 🟡 T-31 · El contrato de Trámites usa ids numéricos donde el backend real usa UUID
`core/models/tramite.model.ts:198` declara `Localidad.id: number`, y `TramiteContenidoLocalidad.localidadId: number`
(`:172`). El backend real expone Localidades con UUID. Hoy no explota porque
`environment.featureOverrides.tramites` está en `'mock'`, pero es deuda que
aparece el día que se conecte.

---

## Backlog priorizado

**Tanda 1 — la pantalla deja de mentir** (T-01, T-04, T-05, T-14, T-15, T-16,
T-17, T-22, T-23, T-24). Todos son "algo falló y no se dice" o "esto se ofrece y
no existe". Son independientes entre sí y baratos.

**Tanda 2 — permisos y acciones destructivas** (T-02, T-03, T-25). Lo que hoy
permite disparar acciones de cara al ciudadano sin confirmación ni gateo.

**Tanda 3 — la lista al patrón** (T-06, T-07, T-08, T-09, T-10, T-11, T-12).
Es el mismo trabajo hecho en Organismos y Tipos, con los componentes ya extraídos.

**Tanda 4 — detalle y sub-formularios** (T-18, T-19, T-20, T-26, T-27, T-28).

**Tanda 5 — migración a capas** (T-30, T-31) + pulido (T-13, T-21, T-29).

> T-30 es la decisión de fondo: hacerla **primero** encarece la tanda 1 (hay que
> migrar antes de arreglar), pero hacerla **al final** obliga a tocar dos veces
> los mismos `subscribe`. Recomendación: tandas 1 y 2 sobre el código actual —son
> ramas `error` y guards, sobreviven a la migración—, y migrar antes de la tanda 3,
> que es la que reescribe la lista entera.
