---
paths:
  - "backoffice/src/app/**/*.html"
  - "backoffice/src/app/**/*.scss"
  - "backoffice/src/app/**/*.component.ts"
---

# Accesibilidad: WCAG 2.2 AA (backoffice)

**AA gana sobre el diseño** cuando chocan (`DESIGN.md` §10). No es opcional ni "para después".

## Hacé
- **Función sin backend** (ordenar, exportar, más filtros): visible con `appUnavailable="<motivo>"`
  (`@shared/directives/unavailable.directive`): `aria-disabled`, tooltip con el motivo, sigue focusable.
- **Control que pasa de disponible a no disponible** (Guardar / Descartar sin cambios): **un solo nodo** que alterna su estado
  con `[appUnavailable]="sinCambios ? 'No hay cambios para guardar' : false"` (`false` / `null` = disponible; `''` y el
  atributo suelto = no disponible con el motivo por defecto). Así el foco queda en el mismo botón al guardar, al descartar y
  cuando aparece el primer cambio (WCAG 2.4.3).
- **Acción bloqueada por regla de negocio**: `RowAction.disabledReason` o `[appAriaDisabled]`; el motivo queda a la vista.
- **Dato fijado en un formulario**: `FieldConfig.readonly` + `hint` (queda en el tabulado y asociado por `aria-describedby`).
- Botón de solo ícono: `aria-label` + tooltip. Ícono decorativo: `<i class="ph ph-x" aria-hidden="true"></i>`.
- `aria-label` de una acción de fila nombra el objeto: `Eliminar etiqueta ${slug}`.
- Foco visible con `@include focus-ring` o `focus-ring-inset`.
- **Foco tras cerrar o eliminar**: un diálogo devuelve el foco a quien lo abrió; al eliminar una fila,
  `indiceDeFilaActiva` antes de confirmar + `enfocarTrasEliminar` después (`@shared/utils/foco-lista`).
- Diálogo de formulario: abre con `abrirFormDialog` (foco al primer campo al terminar de cargar); la X, Cancelar, Escape y el
  clic afuera pasan por `cierreConConfirmacion`.
- Estados: error de carga con `role="alert"` + "Reintentar"; cargando con texto accesible; contadores que cambian con `aria-live="polite"`.
- **Texto que aparece por una acción** (el `aviso` de un interruptor, una vista previa): dentro de una región `aria-live="polite"`
  que ya estaba montada (vacía). Una región creada junto con su texto no se anuncia.
- **Entidad que no existe** (enlace viejo o mal escrito): `conCarga(esXInexistente)` + `<app-estado-carga [noExiste]>` con texto
  propio e "Ir al listado", sin "Reintentar" ni diálogo global (`sinDialogoGlobal()` en la lectura del datasource).
- Labels reales (`<label for>` o `aria-labelledby`); selects de filtro sin label visible llevan `aria-label="Filtrar por …"`.
- Errores de campo asociados al campo y en texto, no solo color. Texto ≥ 4.5:1; contornos y estados ≥ 3:1
  (`--theme-success-text` y `--theme-warning-text` para texto, nunca `--theme-success` / `--theme-warning`).
- Targets ≥ 24px (acciones de fila 30px; controles sueltos ≥ 34px). Teclado completo. `<title>` por ruta (`title` o `data.breadcrumb`).
- Atajos: solo con `appAtajo` (`@shared/directives/atajo.directive`) sobre el control existente; hereda permisos y estado.
- Columna que se oculta en mobile (`hideOnMobile`): el dato reaparece en la celda principal (`.cell-name__meta`).

## No hagas
- `disabled` nativo + `title` o `matTooltip` para explicar por qué algo no está disponible (no recibe foco ni hover).
- Ocultar una función pendiente, o un nodo no elegible de un árbol (se muestra con `disabledReason`).
- `outline: none` sin reemplazo; `tabindex` positivo; `autofocus`; `(click)` en un `<div>` o `<span>` sin rol ni teclado.
- `disabled` nativo para "Guardar sin cambios" o "Descartar sin cambios": el botón queda enfocable con
  `appUnavailable="No hay cambios para guardar"` (lo resuelven `app-form-actions` y `form-dialog`; no lo reimplementes).
  `disabled` nativo solo mientras una operación está en curso.
- Dos `<button>` alternados con `@if` / `@else` para el mismo lugar (uno con `appUnavailable` y otro normal): al cambiar de
  estado se destruye el que tenía el foco y el foco cae a `body`.
- Transmitir estado solo con color; animación decorativa (respetar `prefers-reduced-motion`).

Ejemplo canónico: `pages/etiquetas/list/etiquetas-list.component.html` (`appUnavailable`, `aria-label`, `aria-live`,
`aria-hidden`) y `onDelete` en su `.ts` (foco tras eliminar); botón de un solo nodo:
`shared/components/form-actions/form-actions.component.html` y `pages/tramites/adopciones/detail/adopcion-detail.component.html`.
Lo verifica: `npm run lint` — `@angular-eslint/template/{alt-text, valid-aria, role-has-required-aria, no-positive-tabindex,
no-autofocus, elements-content, interactive-supports-focus, click-events-have-key-events, label-has-associated-control,
button-has-type}`; foco, contraste y motivos visibles los revisa `angular-ssr-reviewer` (y `front-design` en modo AUDIT).
