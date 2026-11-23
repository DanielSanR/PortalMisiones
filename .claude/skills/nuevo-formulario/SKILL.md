---
name: nuevo-formulario
description: Crea o reescribe un formulario de envío del backoffice (Angular 17) con el dynamic form, en diálogo (abrirFormDialog + <x>-dialogo.ts) o en página (app-dynamic-form), con sus errores de guardado por código de negocio. Úsalo al sumar un alta o edición, o al pasar un formulario hecho a mano al motor. No aplica a filtros de listas, a auth/ ni a public/.
---

# Crear un formulario con el dynamic form (backoffice)

Norma: `.claude/rules/formularios-dynamic-form.md` y `textos-y-errores.md`. Moldes verificados:
`pages/etiquetas/etiqueta-dialogo.ts` (diálogo), `pages/organismos/detail/organismo-detail.component.{ts,html}` (página de una
columna) y `pages/roles/form/` (página de dos paneles: `rol-campos.ts` + `role-form.component.{ts,html}`).
Por capacidad: `pages/categorias/categoria-dialogo.ts` (slug derivado, franja `vista`, árbol), `pages/tramites/adopciones/adoptar-dialogo.ts`
(fechas con regla cruzada), `pages/tramites/fichas/components/puntos-atencion-panel/punto-dialogo.ts` (enlace `vista`, aviso de
interruptor) y `pages/tramites/plantillas/form/plantilla-campos.ts` (`select-multiple`, panel de grupos, slug derivado, regla cruzada).
Excepciones cerradas (no usan el motor): filtros de listas, `auth/`, `pages/tramites/fichas/form/ficha-form`. Un `new FormGroup(` o
`fb.group(` en `pages/` fuera de `FORMULARIOS_A_MANO` (`.eslintrc.cjs`) es error de lint.

## 1. Elegí: diálogo o página (una sola forma por entidad)
- **Diálogo**: pocos campos, sin ficha propia, ayuda ver la lista de fondo.
- **Página**: ficha con más bloques o muchos campos.

## 2. Contrato y datos
- Leé el DTO real (`BACKEND_API_SPEC.md`, `core/features/<f>/models/*.dto.ts`): **solo** los campos que el backend persiste.
- El facade expone `getFormData(id | null)` (entidad + catálogos + `organismoFijo` si aplica) en una sola llamada, y
  `create` / `update`. Si falta, sumalo en el facade (no en el componente).

## 3. Campos (`FieldConfig[]`, `@core/models/field.interface`)
- Una función pura `camposDeX(catálogos, entidad | null, …): FieldConfig[]`.
- `validations` con `mensajes` propios; `hint` útil; `placeholder` de ejemplo; `cssClass` para el ancho.
- Dato fijado (organismo de la sesión, campo que no cambia en edición): `readonly: true` + `hint` con el motivo. Nunca `disabled`.
- `select`: `options` + `optionsLoaded: true` (+ `emptyOptionsMessage`). Jerarquías: `type: 'tree-select'`.
- Lo que el motor no dibuja: `type: 'custom'` + `<ng-template appCampoPropio="<name>" let-grupo>` dentro de
  `<app-dynamic-form>` (se dibuja en el lugar del campo; `pages/roles/form/`: la grilla de permisos).
- Selección múltiple de un catálogo: `type: 'select-multiple'` + `seleccion: { nombre, textoVacio }`. Normalizar mientras se
  escribe: `transformar`.
- Antes de pedirle algo nuevo al motor, revisá lo que ya declara un `FieldConfig`:
  - `derivado` (valor que sigue a otro campo + botón para volver a derivarlo), `validations.validarCon` (regla entre campos),
    `preview` (cómo queda lo tipeado), `aviso` (consecuencia de apagar un interruptor).
  - `type: 'vista'` + `vista: { componente, datos }` para contenido de solo lectura derivado del formulario. El componente va en
    `components/<pieza>/` (trío `.ts/.html/.scss`), implementa `VistaDeCampo` y arma su stream desde `grupo.valueChanges`.
  - `datepicker` + `fecha: { minDe, botonCalendario, quitar }`; `opcional`, `filas`, `inputMode`, `tip` con `tono: 'alerta'`.
- Si lo que falta solo le sirve a este formulario, no lo sumes al motor: resolvelo con una `vista` o planteá la excepción al dueño.

## 4a. En diálogo — `pages/<sección>/<entidad>-dialogo.ts`
`dialogoDeX(facade, fila | null): FormDialogData<XVM>` con `titulo`, `subtitulo`, `textoGuardar`,
`requiereCambios: !!fila`, `formId`, `cargar` (de `facade.getFormData`, devuelve `{ fields, initialData }`), `errorDeCarga`,
`guardar` (arma el `XFormValue` y llama `create` / `update`) y `errorDeGuardado`. Opcionales: `textoCargando`, `tituloDeError`,
`textoGuardando`, `mensajeDescartar`. Sin nada que cargar: `formDialogEstatico`
(`@shared/components/form-dialog/form-dialog-estatico`). Se abre con `abrirFormDialog` desde `DialogoEnLista` (skill `nueva-pantalla-lista`).

## 4b. En página — `pages/<sección>/form/` o `detail/`
1. **Helper puro al lado del componente** (`form/<entidad>-campos.ts` + spec): `camposDeX(...)`, `panelesDeX(...)` si es de dos
   paneles, `valorInicialDeX(entidad)` y `aValorDeX(valorDelForm): XFormValue`.
2. **Marco**: `readonly marco = formularioDePagina<XFormData>()` (`@shared/utils/formulario-de-pagina`). `cargar()` llama
   `marco.cargar(facade.getFormData(id), aError)`; `onSubmit(valor)` llama `marco.guardar({ peticion$, form: motor.form, motor,
   conflictos, fallback, aviso, destino, esAlta, siNoNavega })`; `tieneCambiosSinGuardar()` devuelve
   `marco.tieneCambiosSinGuardar(motor?.form)`. No repitas `saving` / `serverError` / `unaVez` / `salirTrasGuardar` a mano.
3. **Template** (mismo patrón en todas las páginas):
   ```html
   @if (marco.pendiente; as tipo) {
     <app-estado-carga [tipo]="tipo" [noExiste]="!!marco.errorDeCarga?.noExiste" [titulo]="marco.errorDeCarga?.titulo ?? ''"
         [texto]="marco.errorDeCarga?.texto ?? ''" cargandoTexto="Cargando el rol…" volverTexto="Ir al listado"
         (reintentar)="cargar()" (volver)="volver()"></app-estado-carga>
   } @else if (marco.datos) {
     <app-membrete class="ficha-membrete" icono="shield-star" [titulo]="vista.titulo" tituloVacio="Rol sin descripción" [datos]="vista.datos">
       <span membretePill class="pill pill--bordered pill--active">…</span>
       <span class="pill pill--revision pill--bordered">…Editando…</span>
     </app-membrete>
     <app-dynamic-form [fields]="campos" [paneles]="paneles" [initialData]="inicial" [requireChanges]="esEdicion"
                       [saving]="marco.guardando" [serverError]="marco.errorDeGuardado" [submitButtonText]="…" [helpText]="…"
                       (valueChanges)="onValor($event)" (formSubmit)="onSubmit($event)" (formCancel)="volver()">
       <ng-template appCampoPropio="permissionsIds" let-grupo>…</ng-template>
       <span formActionsInfo class="pill ficha-paneles__indicador">…</span>
     </app-dynamic-form>
   }
   ```
   Sin `[paneles]` el motor dibuja la grilla de una columna con su pie (organismo). El membrete en vivo y lo que depende del
   valor (un `hint`, las opciones de un select) se recalculan en `(valueChanges)` y se vuelven a entregar como `fields`.
4. Ruta con `canActivate: [accessGuard]` + `canDeactivate: [unsavedChangesGuard]`.
Guardado en el lugar dentro de una tarjeta (sin el pie flotante): `[hideButtons]="true"` y los botones proyectados dentro de
`<app-dynamic-form>`; volver a los valores guardados = entregar un `initialData` nuevo
(`pages/tramites/adopciones/detail/adopcion-detail.component.{ts,html}`).

## 5. Errores de guardado — `pages/<sección>/<entidad>-save-error.ts`
`CONFLICTOS_X: ConflictoDeCampo[]` (`code: API_CODES.…` → `control` + `mensaje`) y `FALLBACK_X`; se aplican con
`aplicarErrorDeGuardado(err, form, CONFLICTOS_X, FALLBACK_X)`. El `.http.datasource.ts` lleva `sinDialogoGlobal()` en esas
escrituras y el mock falla con el mismo código (`errorDeNegocio`). Nunca el `message` del backend.

## 6. Specs
- `<entidad>-dialogo.spec.ts` (o del componente): campos según el modo (alta / edición / sesión con organismo), `readonly`
  y no `disabled`, payload que sale de `guardar`. Lo que se ve (textos de error, foco, campos derivados) se prueba montando el
  diálogo real con `montarFormDialog(dialogoDeX(...))` (`@shared/components/form-dialog/testing/form-dialog.testing`).
- `<entidad>-save-error.spec.ts`: cada código marca su campo. `.http.datasource.spec.ts`: `describeDuplicadoSinDialogoGlobal`.

## Verificación (obligatoria)
- `cd backoffice && npm run check` en verde.
- A mano: edición sin cambios no guarda; cerrar con cambios pide confirmación (X, Cancelar, Escape, clic afuera); el
  duplicado marca el campo y no abre el diálogo global; teclado completo y foco al primer campo.
- Agente `angular-ssr-reviewer`.
