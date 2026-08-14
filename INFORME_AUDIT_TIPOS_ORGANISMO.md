# Audit — Tipos de Organismo

Fecha: 2026-08-14 · Rama: `fix/organismos-bugs`

Alcance: `pages/tipos-organismo/list` y `pages/tipos-organismo/create`.

Contrastado contra tres fuentes, en este orden de autoridad:

1. **El diseño** (`Pantallas · Backoffice Misiones`, pantalla LISTA) — trust of source.
   La pantalla LISTA del diseño es genérica: la misma plantilla sirve a trámites,
   modalidades, eventos, etiquetas, usuarios, auditoría, reportes y feedback
   (`pantallas2.html:1227`). Tipos de Organismo es una lista de datos maestros más,
   así que le aplica tal cual.
2. **Kitchen Sink** — componentes (menú contextual, modal destructivo, snackbar).
3. **checklist.design** — UX funcional. Checklists consultadas:
   `design-system/table`, `design-system/searchbar`, `web-app/empty-state`,
   `flows/filtering-items`, `flows/submitting-a-form`, `flows/saving-changes`.

> **Nota previa.** La skill `checklist-design` NO está en esta rama: vive solo en
> `feat/checklist-design-skill`, que nunca se mergeó. Las checklists de este informe
> se leyeron con `git show feat/checklist-design-skill:...`. Mientras siga así, el
> agente `front-design` no puede cumplir su paso 0 en esta rama.

---

## Resumen

13 hallazgos. Dos son **fallos silenciosos** (la pantalla miente sobre lo que pasó),
seis son puntos de checklist directamente incumplidos, y cinco son deuda respecto
del patrón que ya quedó implementado en Organismos.

| # | Hallazgo | Fuente | Severidad |
|---|---|---|---|
| 1 | Un error de carga se muestra como "no hay datos" | `web-app/empty-state` · error state variant | **Crítico** |
| 2 | Un error al guardar no se muestra en ningún lado | `flows/submitting-a-form` | **Crítico** |
| 3 | No hay buscador | `design-system/table` · Search | Alto |
| 4 | El estado vacío no distingue "no hay nada" de "no matchea el filtro" | `web-app/empty-state` | Alto |
| 5 | El modal de borrado no es el del Kitchen Sink | Kitchen Sink | Alto |
| 6 | No se puede quitar un filtro individualmente | `flows/filtering-items` 4–5 | Medio |
| 7 | La tabla no ordena | `design-system/table` · Filter and sort | Medio |
| 8 | La tabla no pagina | `design-system/table` · Pagination | Medio |
| 9 | El toolbar no sigue el layout del diseño | Diseño, pantalla LISTA | Medio |
| 10 | Salir del formulario con cambios sin guardar no avisa | `flows/saving-changes` | Medio |
| 11 | El snackbar no usa la variante del design system | Kitchen Sink §07 | Bajo |
| 12 | La fila no se bloquea mientras se borra | Kitchen Sink | Bajo |
| 13 | El copy del borrado cuenta la restricción, no la consecuencia | Diseño | Bajo |

---

## Detalle

### 1. Un error de carga se muestra como "no hay datos" — Crítico

`tipos-organismo-list.component.ts:72-75`: el `error` del subscribe apaga `loading` y
no hace nada más. La tabla cae al estado vacío y dice **"No hay tipos de organismo
registrados"**.

Es el peor final posible: si la API se cayó, la pantalla afirma que el usuario no
tiene datos. `web-app/empty-state` lo nombra explícitamente — *"Showing an empty
state when the real issue is a loading error causes users to assume they have lost
their data"*.

`SharedTableComponent` ya expone `[error]`, `errorTitle`, `errorMessage` y `(retry)`;
la lista simplemente no los usa. Es el mismo bug que se corrigió en Organismos.

### 2. Un error al guardar no se muestra en ningún lado — Crítico

`tipo-organismo-form.component.ts:77-80`: ante un fallo del backend solo se hace
`saving = false`. El botón vuelve a "Crear tipo" y no aparece nada. El usuario no
sabe si guardó.

`organismo-form.component.ts` ya resuelve esto con `serverError` +
`extractErrorMessage`, y `DynamicFormComponent` ya acepta `[serverError]`.

### 3. No hay buscador — Alto

`design-system/table` lo pide como punto propio: *"Search — the ability to find a
specific keyword or row"*. El diseño lo dibuja en la fila A del toolbar. Hoy solo
están los chips Todos/Activos/Inactivos.

### 4. El estado vacío no distingue zero-state de no-results — Alto

Hoy hay un único `emptyMessage="No hay tipos de organismo registrados"`, sin título,
sin descripción y **sin acción**. `web-app/empty-state` pide separar los dos casos y
advierte: *"A no-results state without a way to reset or broaden the search is a dead
end — always provide an escape route"*.

### 5. El modal de borrado no es el del Kitchen Sink — Alto

`onDelete` abre el `ConfirmDialogComponent` con `title`/`message`/`confirmText` a
secas: sin `danger`, sin `highlight`, sin `busyText`. Además usa `switchMap` sobre
`afterClosed()`, o sea **cierra el modal y recién ahí llama al backend**: si el
borrado falla, el modal ya no está para contarlo.

El diálogo ya soporta `confirmAction`, que lo mantiene abierto con el botón en
spinner hasta que el backend responde.

### 6. No se puede quitar un filtro individualmente — Medio

`flows/filtering-items` pide, como pasos 4 y 5, mostrar los filtros activos y
permitir quitarlos de a uno o todos juntos. No existe la barra "Filtros activos".

### 7. La tabla no ordena — Medio

`design-system/table` · *"Filter and sort"*. `SharedTableComponent` acepta
`[sortable]` y `(sortChange)`; ninguna columna los declara.

### 8. La tabla no pagina — Medio

`design-system/table` · *"Pagination"*. La tabla ya trae el paginador custom del
diseño; la lista renderiza todo de una.

### 9. El toolbar no sigue el layout del diseño — Medio

El diseño define dos filas: A = buscador + contador + acciones, B = chips de filtro.
Organismos ya quedó así (`list-toolbar--stacked`). Tipos usa el toolbar viejo de una
sola fila.

### 10. Salir del formulario con cambios sin guardar no avisa — Medio

`organismo-form.component.ts` implementa `PuedeTenerCambiosSinGuardar`;
`tipo-organismo-form.component.ts` no. Se pierde lo tipeado sin preguntar.

### 11. El snackbar no usa la variante del design system — Bajo

`snackBar.open('Tipo eliminado', 'OK', { duration: 3000 })` sin
`panelClass: 'snackbar-success'` (Kitchen Sink §07).

### 12. La fila no se bloquea mientras se borra — Bajo

`RowActionsComponent` acepta `[busy]`/`busyLabel`. Sin eso, la fila invita a
re-clickear mientras el borrado está en vuelo.

### 13. El copy del borrado cuenta la restricción, no la consecuencia — Bajo

> "¿Está seguro de eliminar "X"? No se puede desactivar si tiene organismos activos
> asociados."

Mezcla dos cosas (eliminar / desactivar) y adelanta una regla que aplica el backend.
El diseño pide contar qué pasa si sigo.

---

## Lo que NO se hace, y por qué

- **Pantalla de detalle.** Organismos la tiene porque tiene 9 campos, pestañas y
  métricas. Un tipo de organismo tiene tres campos —nombre, descripción, activo—
  que ya se ven enteros en la fila y en el formulario. Un detalle sería una copia
  del form en modo lectura. Lo que sí valdría es "cuántos organismos usan este
  tipo", y **la API no lo devuelve**.
- **Avatar con iniciales tintadas** (Kitchen Sink §05). En Organismos las iniciales
  salen de la sigla. Un tipo de organismo no tiene sigla; derivar dos letras de
  "Ministerio" y "Municipalidad" da "MI"/"MU", que confunde más de lo que ayuda.
- **"Más filtros"** y **Ordenar/Exportar**: se dibujan deshabilitados, igual que en
  Organismos, porque no hay funcionalidad detrás todavía.

---

## Deuda que este trabajo destapa

Al implementar 3, 4, 6 y 9 el toolbar de Organismos pasa a estar duplicado
(~175 líneas de SCSS y ~30 de markup). La regla del proyecto es explícita
(`.claude/rules/scss-bem.md` — *"si un patrón visual se repite, extraer un mixin"*;
`componentes-angular.md` — *"si un patrón se repite en ≥2 lugares, extraerlo"*), así
que la implementación extrae primero y después consume desde las dos listas.
