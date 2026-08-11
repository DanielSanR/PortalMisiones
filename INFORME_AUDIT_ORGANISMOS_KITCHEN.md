# Auditoría de Organismos contra el Kitchen Sink

> **Estado:** los 11 puntos accionables del backlog se corrigieron. Queda abierto solo el
> punto 12 (incorporar "Ver detalle" y "Editar permisos" al menú), que es funcionalidad
> inexistente, no una desviación. Ver la sección *Estado de la corrección* al final.

**Fecha:** 2026-08-11 · **Modo:** AUDIT (sin modificar código)
**Trust of source:** `Kitchen Sink - Design System Misiones.dc.html` (proyecto Claude Design
`84343836`), complementado con la pantalla LISTA de `Pantallas - Backoffice Misiones.dc.html`
y los checklists de la skill `checklist-design`.

**Alcance:** las 10 secciones del Kitchen Sink, aplicadas al listado y al formulario de
Organismos (`pages/organismos/**`) y a los componentes de `@shared` que consumen.

---

## Resumen

| Sección | Aplica | Veredicto |
|---|---|---|
| 01 Fundaciones | sí | ✅ radios y elevaciones alineados |
| 02 Shell | no | fuera del alcance de esta pantalla |
| 03 Botones y acciones | sí | 🟡 alto de botón md |
| 04 Form fields | sí | 🟡 alto del control |
| 05 SharedTable | sí | 🟡 faltan iniciales y paginación |
| 06 Estados de lista | sí | 🟡 copy del error sin personalizar |
| 07 Badges, overlays y feedback | sí | 🔴 **modal**, 🟡 menú, 🟡 snackbar |
| 08 Data viz | no | Organismos no tiene gráficos |
| 09 Iconografía | sí | 🟡 tamaños fuera de spec |
| 10 Handoff | meta | — |

**Lo más grave está en la sección 07.** El modal de eliminar no solo difiere en medidas:
usa **otra familia de íconos** y **el color semántico equivocado**.

---

## 🔴 07 — Modal de confirmación

`shared/components/confirm-dialog/*` · usado por Organismos y otras 10 pantallas.

| Punto | Kitchen Sink | Implementación | |
|---|---|---|---|
| Familia del ícono | Phosphor `ph-warning` | `mat-icon` `warning_amber` (Material Symbols) | 🔴 |
| Color del ícono | error — círculo `#FFEBEE`, glifo `#D32F2F` | warning ámbar — `--theme-warning-bg` / `--theme-warning` | 🔴 |
| Círculo | 38 × 38 | 44 × 44 | 🟡 |
| Título | `h3`, 16px | `h2`, `--theme-font-size-lg` (18px) | 🟡 |
| Cuerpo | 13.5px, `line-height 1.5` | `--theme-font-size-base` (14px) | 🟡 |
| Botones | 34px de alto | 40px (override global de `.mat-mdc-*button`) | 🟡 |
| Label de confirmación | **"Sí, eliminar"** | "Eliminar" | 🟡 |
| Radio del panel | 12px (`dialog`) | `--theme-radius-lg` = 12px | ✅ |
| Sombra | XL | `--theme-elevation-3` | ✅ |

### Los dos que importan

**1. Familia de íconos.** Toda la pantalla usa Phosphor. El modal es el único punto que
cae en Material Symbols (`mat-icon`), así que el glifo de advertencia no es el mismo dibujo
que el resto del sistema. La sección 09 fija Phosphor regular como única familia.

**2. Color semántico.** El Kitchen Sink pinta el ícono con la escala de **error**
(`#FFEBEE` / `#D32F2F`); nosotros usamos la de **warning** (ámbar). No es un matiz estético:
un borrado irreversible se está comunicando con el color de "atención" en vez del de "peligro".

### Y el mensaje

El Kitchen Sink escribe la consecuencia concreta y **destaca el objeto en negrita**:

> Se eliminará **Ministerio de Salud Pública** y sus 112 trámites quedarán sin organismo
> asignado. Esta acción no se puede deshacer.

El nuestro (`organismos-list.component.ts`, `onDelete`) describe una **restricción**, no una
consecuencia:

> ¿Está seguro de eliminar "X"? Esta acción es permanente y no se puede deshacer. No se puede
> eliminar si tiene organismos hijos activos.

Son dos cosas distintas y ambas son ciertas, pero el diseño pide contar **qué pasa si sigo**,
no **cuándo me lo van a impedir**. El dato de los trámites huérfanos, además, hoy no lo
tenemos en el VM.

---

## 🟡 07 — Menú contextual

`shared/components/row-actions/*` + overrides de `.mat-mdc-menu-panel`.

| Punto | Kitchen Sink | Implementación | |
|---|---|---|---|
| Alto del ítem | 38px | 40px (`min-height`) | 🟡 |
| Tipografía del ítem | 13.5px | `--theme-font-size-base` (14px) | 🟡 |
| Ícono del ítem | 18px | 20px | 🟡 |
| Radio del ítem | 6px | `--theme-radius-sm` (4px) | 🟡 |
| Hover | `#F7F9FB` | `--theme-surface-sunken` (`#F7F9FB`) | ✅ |
| Deshabilitado | `#BDBDBD` | default de Material | 🟡 |
| Destructivo | `#C62828` | `--theme-error-icon` — medido `rgb(198,40,40)` | ✅ |
| Divisor | 1px `#F1F3F5`, margen `5px 4px` | 1px `--theme-border-primary` (`#E6E9ED`), margen `space-xs 0` | 🟡 |
| Panel | padding 6, radio 8, borde `#F1F3F5`, sombra sm | padding 6 ✅, `radius-md` ✅, `border-secondary`, `elevation-2` | 🟡 |
| **Contenido** | Ver detalle · Editar · Editar permisos · Eliminar | solo Eliminar | 🟡 |

El menú del Kitchen Sink incluye **Ver detalle** y **Editar permisos**, que hoy no existen en
Organismos. No es un defecto de implementación —son funcionalidad que no está— pero conviene
decidir si el menú va a crecer hacia eso o si el catálogo muestra un caso de otra pantalla.

**Nota sobre "Editar":** el Kitchen Sink lo pone *dentro* del menú, mientras que la pantalla
LISTA lo deja *afuera* como botón con texto. Seguimos la pantalla, que es el spec de este caso.

---

## 🟡 03 — Botones y acciones

Spec: **md 34px · sm 30px**, radio de control 7–8, y *tooltip obligatorio* en acciones de fila.

- 🟡 **Botón "Nuevo organismo": 40px.** El override global
  `.mat-mdc-raised-button { height: 40px !important }` pisa el tamaño md del diseño (34px).
  Afecta a todos los botones Material del backoffice, no solo a este.
- ✅ Acción de fila en 30px, radio 8 (dentro del rango 7–8).
- ✅ Tooltip: el requisito aplica a las acciones **icon-only**. El kebab lo tiene
  (`matTooltip="Más acciones"`); "Editar" lleva texto, así que no lo necesita.
- ℹ️ El Kitchen Sink **sí muestra** un tacho icon-only como variante válida de acción de fila.
  O sea que el patrón anterior no estaba prohibido por el sistema; lo que manda para este caso
  es la pantalla LISTA, que usa `Editar` + kebab. La migración fue correcta.

---

## 🟡 04 — Form fields

Spec: **label overline · alto 40px · error inline es-AR**.

- ✅ Labels externas tipo overline (`.form-field__label`), no floating de Material.
- ✅ Errores inline en español.
- 🟡 **Alto del control: 44px** (`infix` con `min-height: 42px` + 10px de padding arriba y
  abajo) contra los 40px del spec.
- ℹ️ Este es el mismo `infix` cuyo desajuste causó el label flotante descentrado que se
  corrigió en `808c02f`. Llevarlo a 40px cerraría el punto del diseño y simplificaría ese
  parche.

---

## 🟡 05 — SharedTable

| Punto | Kitchen Sink | Implementación | |
|---|---|---|---|
| Fondo del header | `#F7F9FB` | `--theme-surface-sunken` | ✅ |
| Alto de fila | 56px | `--theme-table-row-height: 56px` | ✅ |
| Acciones de fila | Editar + kebab | migrado en `f686c1d` | ✅ |
| **Iniciales tintadas** | avatar 30×30 con iniciales y color por organismo, junto al nombre | no existe | 🟡 |
| **Paginación** | "1–4 de 68" + controles de página | `paginated` en `false` | 🟡 |

La tabla ya soporta `paginated`/`totalItems`/`pageSize`; Organismos simplemente no los usa.

---

## 🟡 06 — Estados de lista

Estructura ✅: círculo de 56px, ícono, título de 15px/600, texto de 12.5px y CTA de 34px —
tanto en vacío como en error, con `ph-cloud-slash` y `ph-arrow-clockwise` tal cual el spec.

- ✅ Empty state: título "Todavía no hay organismos" coincide con el Kitchen Sink.
- 🟡 **Error sin personalizar.** El spec dice *"No pudimos cargar **los organismos**"*;
  la pantalla no pasa `errorTitle`, así que queda el default *"No pudimos cargar los datos"*.
- 🟡 El mensaje del spec cierra con *"Si sigue, avisá a Gobierno Inteligente."* — un canal de
  escape que el nuestro no ofrece.
- ✅ Skeleton en carga fría, indicador discreto al refrescar (`176d9b7`).

---

## ✅ 01 — Fundaciones

| Token | Kitchen Sink | `_themes.scss` | |
|---|---|---|---|
| Radio sm | 4 | `--theme-radius-sm: 4px` | ✅ |
| Radio control | 7–8 | `--theme-radius-md: 8px` | ✅ |
| Radio card | 10 | (`radius-panel`) | ✅ |
| Radio dialog | 12 | `--theme-radius-lg: 12px` | ✅ |
| Elevación 2 = menú | sí | `.mat-mdc-menu-panel` usa `elevation-2` | ✅ |
| Elevación 3 = dialog | sí | `.custom-modal-panel` usa `elevation-3` | ✅ |
| `tabular-nums` en números | sí | contador del toolbar lo usa | ✅ |

---

## 🟡 09 — Iconografía

Spec: **Phosphor regular · 18px acciones / 20px nav**.

- 🔴 El modal usa `mat-icon` (Material Symbols) — ver sección 07.
- 🟡 `.row-action i.ph`: **15px** (spec: 18px).
- 🟡 Ítems de menú `i.ph`: **20px** (spec: 18px para acciones; los 20px son para nav).
- ✅ Todo el resto de la pantalla usa Phosphor regular.

---

## Backlog priorizado

**🔴 Primero — comunican mal**

1. Modal: pasar a Phosphor `ph-warning` y a la escala de **error** en vez de warning.
2. Modal: reescribir el mensaje como consecuencia, con el nombre del organismo destacado.
3. Modal: label de confirmación **"Sí, eliminar"**.

**🟡 Después — desalineación de medidas (afectan a todo el backoffice)**

4. Botones md a 34px (revisar el `!important` global de 40px).
5. Control de formulario a 40px.
6. Íconos de acción a 18px; ítems de menú a 38px / 13.5px / radio 6.
7. Divisor del menú al color y márgenes del spec.

**🟡 Funcionalidad ausente en Organismos**

8. `errorTitle` propio: "No pudimos cargar los organismos".
9. Paginación (la tabla ya la soporta).
10. Iniciales tintadas en la celda de nombre.
11. Snackbar con el estilo del spec (fondo oscuro, check verde, acción "Ver").
12. Decidir si el menú incorpora "Ver detalle" y "Editar permisos".

---

## Estado de la corrección

| # | Punto | Cómo quedó |
|---|---|---|
| 1 | Modal: ícono Phosphor + escala de error | ✅ círculo 38px, `#FFEBEE` / `#D32F2F` medidos en el navegador |
| 2 | Modal: mensaje como consecuencia, nombre destacado | ✅ nuevo `highlight` en `ConfirmDialogData` |
| 3 | Modal: "Sí, eliminar" | ✅ + `danger` explícito en vez de inferir del texto |
| 4 | Botón md a 34px | ✅ global |
| 5 | Control de formulario a 40px | ✅ global (medido: 40) |
| 6 | Íconos 18px · ítem de menú 38px / 13px / radio 6 | ✅ global |
| 7 | Divisor del menú | ✅ `--theme-border-subtle` (`#F1F3F5`), margen `5px 4px` |
| 8 | `errorTitle` propio de organismos | ✅ + el mensaje con el canal de escape del spec |
| 9 | Paginación | ✅ client-side, con la página acotada al filtrar |
| 10 | Iniciales tintadas | ✅ 4 tintes derivados del id, conectores salteados |
| 11 | Snackbar del spec | ✅ vía `panelClass: 'snackbar-success'`, que ya existía sin usarse |
| 12 | "Ver detalle" / "Editar permisos" en el menú | ⬜ funcionalidad inexistente — decisión de producto |

**Desviación conocida:** el snackbar del Kitchen Sink lleva un ícono `ph-check-circle` verde.
El `MatSnackBar` simple no admite íconos; requeriría un componente propio vía
`openFromComponent()` y tocar todos los llamadores. El contenedor sí quedó en spec.

---

## Nota de método

Los puntos marcados ✅ se verificaron leyendo el token o la regla concreta, no por inspección
visual. Los ítems de la sección 07 sobre el menú se midieron en el navegador durante la
migración (`f686c1d`): el color destructivo dio `rgb(198,40,40)`, que es exactamente el
`#C62828` del Kitchen Sink.
