---
paths:
  - "backoffice/src/app/pages/**"
  - "backoffice/src/app/shared/components/dynamic-form*/**"
  - "backoffice/src/app/shared/components/form-dialog/**"
  - "backoffice/src/app/core/models/field.interface.ts"
---

# Formularios: siempre el dynamic form (backoffice)

## Hacé
- Todo formulario de envío se describe como `FieldConfig[]` (`@core/models/field.interface`) y lo dibuja el motor:
  - **En diálogo**: `pages/<x>/<x>-dialogo.ts` exporta `camposDeX(...)` y `dialogoDeX(facade, fila): FormDialogData<R>`
    (`titulo`, `subtitulo`, `textoGuardar`, `requiereCambios` en edición, `cargar`, `errorDeCarga`, `guardar`, `errorDeGuardado`).
    Se abre con `abrirFormDialog` (`@shared/utils/abrir-form-dialog`). Sin nada que cargar: `formDialogEstatico`.
  - **En página**: `<app-dynamic-form [fields] [initialData] [requireChanges] [saving] [serverError] (formSubmit) (formCancel)>`
    (trae su pie `<app-form-actions>`) + `canDeactivate: [unsavedChangesGuard]` en la ruta. Los campos y paneles de una
    página se declaran en un helper puro al lado del componente (`form/rol-campos.ts`, `form/plantilla-campos.ts`,
    `detail/organismo-campos.ts`), con su spec.
- **Ciclo de un formulario de página**: `readonly marco = formularioDePagina<D>()` (`@shared/utils/formulario-de-pagina`).
  `marco.cargar(facade.getFormData(id), aError)` (también es "Reintentar"), `marco.guardar({ peticion$, form, motor,
  conflictos, fallback, aviso, destino, esAlta, siNoNavega })` (guarda una sola vez, marca el campo del conflicto, avisa y
  sale; sin `destino` se queda y llama `alQuedarse`) y `marco.tieneCambiosSinGuardar(form)` para el guard. El template enlaza
  `<app-estado-carga [tipo]="marco.pendiente">` y `[saving]="marco.guardando"` / `[serverError]="marco.errorDeGuardado"`.
- **Formulario de dos paneles** (ficha con datos | lo relacionado): `[paneles]="PanelDeFormulario[]"` (`id`, `titulo`,
  `subtitulo`, `total`, `campos`, `opciones`, `lateral`, `acotado`, `cuerpo: 'campos' | 'grupos' | 'libre'`) y
  `[panelesIguales]`. Las variantes son los modificadores de la familia global `.ficha-paneles`; elegí por lo que va
  en el panel (detalle en `PanelDeFormulario`):
  - campos sueltos + interruptores al pie → `cuerpo` omitido + `opciones` ("Datos del rol", "Datos de la plantilla");
  - catálogos `select-multiple`, cada uno en su bloque con divisor → `cuerpo: 'grupos'` ("Clasificación" de plantilla;
    `[['categoriaIds', 'principal'], …]` reúne campos en un grupo; un grupo que es solo una `vista` de la página va de
    borde a borde, `.ficha-paneles__grupo--corrido`);
  - un widget propio que se dibuja entero (campo `custom`) → `cuerpo: 'libre'` ("Permisos" del rol);
  - una lista larga que no debe estirar la tarjeta → `acotado: true` + `.ficha-paneles__desplazable` en el widget
    ("Permisos": buscador fijo, grupos con scroll).

  El motor dibuja la tarjeta `.ficha-paneles` con el pie integrado; la página proyecta el indicador del
  pie (`<span formActionsInfo class="pill ficha-paneles__indicador">`) y, si hace falta, un aviso sobre la tarjeta
  (`<div formAviso class="form-aviso">`). Arriba va `<app-membrete class="ficha-membrete">`, armado en vivo con `(valueChanges)`.
- Los datos para armar el form (entidad + catálogos) salen de **un** `facade.getFormData(id)`.
- Dato que la persona no elige (organismo de la sesión, campo que no cambia en edición): `readonly: true` + `hint` con el
  **motivo**. El valor viaja igual en `form.value`; sus `validations` no rigen mientras sea `readonly`.
- Mensajes propios por campo en `validations.mensajes` ("El slug es obligatorio"); regla propia en `validations.validar`.
- Catálogo de un `select`: `options` + `optionsLoaded: true`; si puede llegar vacío, `emptyOptionsMessage` que diga cómo destrabarse.
- Widget que el motor no dibuja: campo `type: 'custom'` + `<ng-template appCampoPropio="<name>" let-grupo>` proyectado dentro
  de `<app-dynamic-form>`: se dibuja en el lugar del campo (su celda o su panel) y participa de cambios y envío. Contenido
  propio sin control (un "qué sigue"): campo `type: 'vista'` sin componente + el mismo template.
- Selección múltiple de un catálogo: `type: 'select-multiple'` + `seleccion: { nombre, textoVacio }` (lo dibuja
  `app-seleccion-multiple`; el valor es `string[]` y queda abierta una lista a la vez). Admite `validations.required`
  (al menos una): el error va bajo el grupo, por `aria-describedby`, y entra al resumen.
- Normalizar mientras se escribe (mayúsculas, sin espacios): `transformar: (valor) => …` (solo `text`, pura e idempotente).
  Lo que cambia recién al guardar (recortes) va en el helper que arma el payload.
- **Un campo que depende de otro o de su propio valor** (todo se declara en el `FieldConfig`, documentado en `field.interface.ts`):
  - Valor que sale de otro campo hasta que la persona lo edita, con botón para volver a derivarlo:
    `derivado: { de: 'nombre', transform: canonicalizarSlug, seguir: !esEdicion, accion: 'Usar el del nombre' }` (solo `text`).
  - Regla entre campos: `validations.validarCon: { campos: ['vigenteDesde'], validar: (hasta, valores) => mensaje | null }`
    (se reevalúa al cambiar esos campos). La regla de un solo campo sigue siendo `validations.validar`. Si fallan las dos se ve
    la de `validar` (claves de error distintas: `personalizado` antes que `entreCampos`). Al cambiar uno de `campos` el campo
    se revalida y **pierde un error de servidor** que tuviera (`setErrors({ server })`).
  - Contenido de solo lectura derivado de lo cargado (ruta en un árbol, un enlace que depende de dos campos):
    campo `type: 'vista'` + `vista: { componente, datos? }`; el componente vive en `components/<pieza>/`, implementa
    `VistaDeCampo` (`@Input() grupo: FormGroup`, `@Input() datos`) y solo lee. Es el `custom` de un formulario en diálogo.
  - **Widget que completa otros campos dentro de un diálogo** (un mapa que llena latitud y longitud): la misma `vista`
    + `escribe: ['latitud', 'longitud']`; el motor le entrega `@Input() escribir?: EscrituraDeVista` y cada valor que
    cambia queda dirty y touched (libera "Guardar" en una edición, pide confirmar el descarte, muestra su error). Los
    campos que escribe siguen en el formulario como forma alternativa de cargar el dato (WCAG: el widget no puede ser
    la única). Lee con `grupo`; un `name` fuera de `escribe` se ignora. Ejemplo canónico: `punto-dialogo.ts` +
    `punto-ubicacion/` (y `shared/components/mapa-ubicacion`, el mapa reutilizable, que no sabe qué ubica).
  - Consecuencia de apagar un interruptor: `aviso: (valor) => valor ? null : { texto, tono: 'alerta' }` (solo `checkbox`).
  - Fechas: dos campos `datepicker` (DD/MM/AAAA, es-AR, en diferido) con `fecha: { minDe, botonCalendario, quitar }` y la
    regla cruzada en `validarCon`. Los valores son `Date` (vacío: `''` o `null`); los bordes del día los pone `guardar`.
  - Marcas: `opcional: true` ("(opcional)" en la etiqueta), `filas` (textarea), `inputMode` (text), `tip` con `tono: 'alerta'`,
    `autocomplete: 'off'` (u otro valor del atributo) para un dato que no es de quien lo carga (coordenadas, el correo de otra
    persona); sin declararlo no se emite el atributo.
- **Recalcular `fields`** (la página los vuelve a entregar porque cambió otro campo: el alcance de un rol, las categorías
  de una plantilla, `alCambiar` de un diálogo) no borra el error de servidor de un campo cuyo valor no cambió: el motor lo
  guarda como un validador atado al valor rechazado (`reglaDeRechazo`; el host avisa con `refrescarErrores`, que ya
  llaman `formularioDePagina` y `form-dialog`). Se va al editar ese campo; no rige si pasa a `readonly` / `disabled`.
- Textos del marco del diálogo que no son los genéricos: `textoCargando`, `tituloDeError`, `textoGuardando`, `mensajeDescartar`.
- Formulario embebido con pie propio (guardado en el lugar): `<app-dynamic-form [hideButtons]="true">` con los botones
  **proyectados** adentro (quedan dentro del `<form>`: `type="submit"` lo envía). Cada botón es **un solo nodo**:
  `[disabled]="guardando"` + `[appUnavailable]="sinCambios && !guardando ? 'No hay cambios para guardar' : false"` (ídem
  "Descartar", con "No hay cambios para descartar"). El guardado no navega: el foco tiene que quedar en el botón.
- **Ids de los campos = su `name`** (`#nombre`, `#nombre-label`, `#nombre-ayuda`): de ahí salen `label for`, `aria-labelledby`
  y los selectores de specs y e2e (`#slug`, `#vigenteDesde`…). No se prefijan por instancia; por eso los `name` tienen que ser
  únicos entre los formularios del motor que estén a la vez en el documento.
- Campo del diseño que el backend todavía no persiste: **no va**. Nunca un campo editable que no se guarda.
- Tipos de campo del motor: `text`, `textarea`, `email`, `password`, `url`, `select`, `select-multiple`, `tree-select`,
  `datepicker`, `checkbox`, `tip`, `section-header`, `vista`, `custom`. (`number`, `radio` y la marca `pendiente` se
  eliminaron el 2026-11-21 por no tener uso; un número se carga como `text` + `inputMode`.)
- Error de guardado: `errorDeGuardado: (err, form) => aplicarErrorDeGuardado(err, form, CONFLICTOS_X, FALLBACK_X)` con los
  conflictos declarados en `<x>-save-error.ts` (ver `textos-y-errores.md`).
- Cierre de un diálogo con formulario propio: `cierreConConfirmacion` (`@shared/utils/cierre-con-confirmacion`) sobre el marco `.dialogo-formulario`.

## No hagas
- `FormGroup` / `FormBuilder` + `mat-form-field` a mano para un formulario de envío (`new FormGroup(` y `fb.group(` son
  error de lint en `pages/`, fuera de la lista `FORMULARIOS_A_MANO` de `.eslintrc.cjs`).
- Sumar una capacidad al motor para un solo formulario: si no sirve a otros, es una `vista` de esa pantalla o una excepción.
- Abrir un diálogo de formulario sobre una página con formulario embebido (hoy `organismo-detail` en edición y
  `adopcion-detail`) que comparta nombres de campo: duplica ids y las etiquetas nombran al campo equivocado. Si hace falta,
  cambiá el `name` de uno de los dos. En desarrollo el motor lo avisa por consola ("Ids repetidos en el documento").
- Alternar dos `<button>` con `@if` / `@else` para "sin cambios" (ver `accesibilidad.md`).
- `disabled: true` para un dato fijado: sale del orden de tabulación y no explica el motivo. Usá `readonly` + `hint`.
- Un componente `dialog/*-dialog.component.ts` para "nombre y poco más".
- Volver a pedir catálogos en el componente, o transformar el payload en el componente (va en el mapper).

## Excepciones cerradas (no sumar otras sin decisión del dueño)
- Filtros de listas (`FormControl` del buscador, selects de filtro).
- Pantallas de `auth/` (login, recuperar, restablecer, activar).
- `pages/tramites/fichas/form/ficha-form` (edición concurrente por versión, validadores que dependen del facade). Arma su
  `FormGroup` a mano, pero comparte el marco: `<app-membrete>`, la tarjeta `.ficha-paneles`, `<app-estado-carga>`,
  `<app-form-actions>` y lo que le sirve de `formularioDePagina`. Sus piezas viven al lado (`form/ficha-form-*.ts`).
- `pages/preferencias/form/` (Preferencias): pantalla de ajustes **sin envío**. Cada control (interruptor, botones de
  alternar, radios de Material) aplica y guarda al momento por `CuentaFacade`; no hay "Guardar", `FormGroup`, cambios
  sin guardar ni error de guardado, así que no usa el motor.
- La lista ejecutable es `FORMULARIOS_A_MANO` en `backoffice/.eslintrc.cjs` (incluye los filtros de `auditoria` y `feedback`).
  Desde 2026-11-20 no quedan diálogos con formulario propio, y desde 2026-11-21 tampoco páginas fuera de la ficha:
  plantilla y rol usan el motor con `paneles`.

Ejemplo canónico: `pages/etiquetas/etiqueta-dialogo.ts` (diálogo), `pages/organismos/detail/organismo-detail.component.html`
(página de una columna) y `pages/roles/form/` (página de dos paneles: `rol-campos.ts` + `role-form.component.*`).
Por capacidad: `pages/categorias/categoria-dialogo.ts` (`derivado`, `vista`, `tree-select`),
`pages/tramites/adopciones/adoptar-dialogo.ts` (fechas, `validarCon`, organismo `readonly`),
`pages/tramites/fichas/components/puntos-atencion-panel/punto-dialogo.ts` (`vista` que escribe, `aviso`, `tip` de alerta, secciones),
`pages/tramites/adopciones/detail/adopcion-detail.component.html` (embebido con pie propio),
`pages/roles/form/rol-campos.ts` (`paneles`, `transformar`, `custom` + `appCampoPropio`) y
`pages/tramites/plantillas/form/plantilla-campos.ts` (`select-multiple`, panel de `grupos`, `derivado`, `validarCon`).
Lo verifica: `npm run lint` (`no-restricted-syntax`: `FormGroup` a mano en `pages/`, error); `npm run check:structure`
(nombres `*-dialogo.ts`); specs `shared/components/dynamic-form/dynamic-form.capacidades.spec.ts`, `dynamic-form.vista.spec.ts` (vista que escribe),
`dynamic-form.paneles.spec.ts` y `shared/utils/formulario-de-pagina.spec.ts`; y, como modelo de spec de un
diálogo, `pages/etiquetas/etiqueta-dialogo.spec.ts` (funciones puras) + `pages/categorias/categoria-dialogo.spec.ts` (lo que se
ve, con `montarFormDialog` de `@shared/components/form-dialog/testing/form-dialog.testing`).
