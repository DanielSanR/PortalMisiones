# Audit — las 8 secciones ABM restantes

Fecha: 2026-08-14 · Rama: `feat/abm-secciones` · Modo: **AUDIT**

Alcance: Categorías, Etiquetas, Modalidades, Eventos de Vida, Destinatarios,
Usuarios, Roles y Permisos (lista + formulario de cada una).

Checklists: `design-system/table`, `design-system/searchbar`, `web-app/empty-state`,
`flows/filtering-items`, `flows/submitting-a-form`, `flows/saving-changes`,
`flows/deleting-account`, `web-app/user-management` (Usuarios/Roles/Permisos).

---

## Por qué este informe es uno solo

Los tres audits anteriores (Organismos, Tipos de Organismo, Trámites) encontraron
el mismo conjunto de defectos. Antes de escribir nada, se corrió un **barrido
mecánico** de las 8 secciones buscando las firmas de esos defectos. El resultado
es homogéneo: no hay hallazgos particulares por sección, hay **un patrón repetido
ocho veces**. Un informe por sección sería el mismo texto con otro sustantivo.

### Barrido — pantallas de lista

| Sección | Buscador | Estado de error | Vacío honesto | Orden | Paginado | Filtros activos | `app-row-actions` |
|---|---|---|---|---|---|---|---|
| Categorías | ❌ | ❌ | ✅ propio | N/A árbol | N/A árbol | ❌ | ❌ |
| Etiquetas | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Modalidades | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Eventos de Vida | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Destinatarios | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Usuarios | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Permisos | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Barrido — formularios y acciones

| Sección | Error de guardado visible | Aviso al salir sin guardar | Modal de borrado del Kitchen Sink | Snackbar del sistema |
|---|---|---|---|---|
| las 8 | ❌ | ❌ | ❌ | ❌ |

**Cero de ocho** en las cuatro columnas.

---

## Los hallazgos

### 🔴 A-01 · Un error de carga se muestra como "no hay datos" — las 8

Dos variantes del mismo final:

- **Categorías, Modalidades, Eventos de Vida, Destinatarios** — rama `error` que
  solo apaga `loading` (`error: () => { this.loading = false; this.cdr.markForCheck(); }`).
- **Etiquetas, Usuarios, Roles, Permisos** — `try { await firstValueFrom(...) } finally { loading = false }`,
  **sin `catch`**. `loading` sí se apaga, pero el error queda como *unhandled
  promise rejection* y la pantalla cae igual al vacío.

En los dos casos la lista termina diciendo "no hay etiquetas / usuarios / roles…"
cuando lo que pasó es que la API no respondió. `web-app/empty-state` lo nombra:
*"Showing an empty state when the real issue is a loading error causes users to
assume they have lost their data"*.

`SharedTableComponent` ya expone `[error]`, `errorTitle`, `errorMessage` y `(retry)`.

### 🔴 A-02 · Un error al guardar no se muestra en ningún lado — las 8

Ningún formulario pasa `[serverError]` al `app-dynamic-form`, que ya lo acepta.
Al fallar, el botón vuelve a su estado normal y no aparece nada: guardar bien y
guardar mal se ven igual. `flows/submitting-a-form`, paso 4.

### 🔴 A-03 · Salir con cambios sin guardar no avisa — las 8

Ninguna implementa `PuedeTenerCambiosSinGuardar` ni declara `canDeactivate` en su
ruta. Lo tipeado se pierde sin preguntar.

### 🟡 A-04 · El estado vacío no distingue "no hay nada" de "el filtro no matchea" — 7

Todas las de tabla pasan solo `emptyMessage`, sin título ni CTA. Un no-results sin
salida es un callejón: `web-app/empty-state` pide **siempre** una vía de escape.

Categorías es la excepción: tiene vacío propio con título y CTA — pero tampoco
distingue los dos casos.

### 🟡 A-05 · No hay buscador — las 8

`design-system/table` lo pide como punto propio. Permisos y Roles son las listas
más largas del backoffice y no tienen forma de encontrar una fila.

### 🟡 A-06 · La tabla no ordena ni pagina — 7

`[sortable]` y `[paginated]` existen en la tabla compartida y no se usan en ninguna.

### 🟡 A-07 · No se puede quitar un filtro individualmente — las 8

`flows/filtering-items`, pasos 4 y 5. Ya existe `app-active-filters`.

### 🟡 A-08 · El modal de borrado no es el del Kitchen Sink — las 8

Sin `danger`, sin `highlight`, sin `busyText`, y con `switchMap` sobre
`afterClosed()`: **cierra el modal y recién ahí llama al backend**, así que un
borrado fallido se queda sin dónde contarse. Ya existe `confirmAction`.

### 🔵 A-09 · Snackbar sin la variante del design system — las 8

Falta `panelClass: 'snackbar-success'` (Kitchen Sink §07).

### 🔵 A-10 · Cuatro listas no usan `app-row-actions`

Categorías, Usuarios, Roles y Permisos mantienen su propio patrón de acciones, sin
el gateo por permiso interno ni el estado `busy` que el componente ya resuelve.

---

## Lo que NO se toca

- **La estructura de árbol de Categorías.** Es correcta para el dominio (jerarquía
  padre→hijas) y ya tiene skeleton, expandir/colapsar y vacío con CTA. Le faltan
  buscador y estado de error, no una tabla.
- **Pantallas de detalle.** Ninguna de las 8 tiene, y ninguna la necesita: son
  entidades de 2 a 4 campos que se ven enteras en la fila y en el formulario.
  Roles y Permisos son el caso dudoso —un rol tiene una matriz de permisos— pero
  eso ya se ve en su formulario.
- **Migración a capas.** Las 8 ya están en `core/features/`. Trámites era la única
  que faltaba y se cerró en la tanda anterior.

---

## Plan de ejecución

Como el trabajo es idéntico y los directorios son disjuntos, va en dos tandas de
cuatro subagentes en paralelo, cada uno con lista + formulario de su sección:

- **Tanda 1** — Etiquetas, Modalidades, Eventos de Vida, Destinatarios (ABM simples,
  casi idénticos entre sí).
- **Tanda 2** — Usuarios, Roles, Permisos, Categorías (las que además migran a
  `app-row-actions`, más el caso árbol).

`pages.module.ts` (las rutas con `canDeactivate`) lo toca una sola mano al final,
para que ocho agentes no editen el mismo archivo.

La referencia de patrón es Organismos y Tipos de Organismo, ya probados en browser.
