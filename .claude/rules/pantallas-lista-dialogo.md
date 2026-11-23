---
paths:
  - "backoffice/src/app/pages/**"
---

# Pantallas: árbol de `pages/`, listas y diálogos (backoffice)

## Dónde vive cada archivo
- Componentes: `pages/<sección>[/<subsección>]/<tipo>/…` con `<tipo>` ∈ `list | form | detail | dialog | components/<pieza>`.
  Solo `tramites/` tiene subsecciones (`plantillas`, `adopciones`, `fichas`).
  - Única excepción: `pages/dashboard/home/` (pantalla de inicio: única sección sin lista). `home` no vale en otra sección.
  - El diálogo de una pieza vive con ella: su `<x>-dialogo.ts` al lado (`components/puntos-atencion-panel/punto-dialogo.ts`)
    y, si necesita una vista propia, en una subcarpeta (`…/punto-ubicacion/`).
- Raíz de la sección: solo helpers y sus specs, con uno de estos sufijos:
  `*-save-error.ts` (rechazos al guardar un formulario o eliminar su entidad) · `*-accion-error.ts` (rechazos de acciones que
  no son un guardado: activar, desactivar, cambiar credencial; ej. `usuarios/usuario-accion-error.ts`) · `*-dialogo.ts` ·
  `*-textos.ts` (textos y etiquetas que comparten ≥2 pantallas) · `*.rutas.ts` (rutas y query params de la sección).
  Si ninguno describe el contenido, no fuerces el nombre: lo que usa una sola pantalla o pieza va **al lado de ella**
  (`dialog/auditoria-campos.ts`, `components/puntos-atencion-panel/coordenadas.ts`, `home/dashboard.view.ts`).
- Pipe o directiva de la sección: `components/<pieza>/` (`auditoria/components/accion-label/accion-label.pipe.ts`).
- Imports: `./x` o `../x` dentro de la sección; desde dos niveles arriba o desde otra sección, `@pages/<sección>/…`.
- Raíz de `pages/`: solo `pages.module.ts` (rutas con `loadComponent`). Ningún spec suelto.
- `<x>-dialogo.ts` = configuración (`FormDialogData`) de un diálogo de formulario estándar.
  `dialog/<x>-dialog.component.ts` = diálogo que **no** es un formulario estándar; es la excepción y se justifica en su cabecera.

## Lista (molde: `pages/etiquetas/list/`)
- **Datos y estado**: `readonly lista = new ListaCliente({...})` (`@shared/utils/lista-cliente`) sobre `facade.xxx$`: da la
  búsqueda (`lista.searchCtrl`), orden, paginado, chips de filtros, textos del vacío, **estado de carga** y fila ocupada en
  `lista.vista$`, que el template consume con `@if (lista.vista$ | async; as vista)`. Comandos: `lista.cargar()` (también
  "Reintentar"), `ordenar($event)`, `paginar($event)`, `limpiar()`, `quitar(clave)`, `accionDeVacio(() => this.onCreate())`.
  - Filtros propios (tabs, selects): `filtros$` + `filtrar` + `filtrosActivos` + `limpiarFiltros`; `quitarFiltro` solo con dos
    o más filtros (con uno solo, quitar su chip usa `limpiarFiltros`). Las tabs se cuentan sobre `lista.buscadas$`. Textos del
    vacío: `extras: textosDeVacio(sinDatos, sinResultados)`.
  - El template y el spec usan `lista.vista$`, `lista.searchCtrl` y `lista.cargar()` directo: sin alias (`vista$ = lista.vista$`,
    `load()`) en el componente. Un `vista$` propio solo si **agrega** datos (`fichas-list`: `accionesWorkflow`).
  - La vista no trae un "estado" resumido: `app-shared-table` lo deduce de `vista.cargando`, `vista.error` y `vista.total`.
  - Orden: `comparar: compararPorTexto((fila, columna) => …)`; con columnas numéricas o de fecha, una función propia + `compararTexto`.
  - Sin paginado: `tamanoDePagina: null`. Dato extra en la vista: devolvelo en `extras` o combiná `lista.vista$` con el stream del facade.
  - Paginado (único, sin opción): cambiar la búsqueda, un filtro (tab, select, chip, "Limpiar") o el orden **vuelve a la
    primera página**; cambiar de página o de tamaño no, y una recarga (alta, edición, baja) conserva la página, acotada a la
    última que exista. Lo hace `ListaCliente` sola: el criterio son los campos simples de `filtros$` (texto, número, booleano);
    los arrays u objetos que viajen ahí (catálogos para los chips) no cuentan. No reinicies la página a mano.
- Markup con piezas compartidas, sin estilos propios para ellas: `appPageActions` (acción principal, con `appAtajo="n"`),
  `.list-toolbar` + `<app-list-search>` + `<app-filter-tabs>` + `<app-active-filters>`, `<app-shared-table>` con
  `appTableCell`, `<app-row-actions [busy]="vista.ocupadaId === row.id">`.
- **Tres estados distintos**: cargando (`[loading]="vista.cargando"`), error con "Reintentar" (`[error]="vista.error"` +
  `(retry)="lista.cargar()"`), vacío. El vacío distingue "todavía no hay nada" (CTA crear, con el permiso de crear) de "los
  filtros no coinciden" (CTA limpiar filtros).
- Helpers de filtro: `filterByActivo`, `activoFilterTabs`, `todasOnlyTabs` (`@shared/utils/list-filter.utils`).
  No inventes filtros sin un campo real que los respalde.
- **Eliminar / desactivar / cualquier acción confirmada**: `confirmarBaja({ dialog, snackBar, destroyRef, confirmacion, aviso,
  ocupado: this.lista.ocupar(fila.id), foco: { host: this.host } })` (`@shared/utils/confirmar-baja`). Hace el ciclo entero:
  confirmación con `confirmAction` (el diálogo espera al backend), error en el propio diálogo (`errorDeAccion` si hay rechazos
  de negocio), fila bloqueada, foco en la fila que ocupa el lugar y aviso. `foco` **siempre** que la fila desaparezca de la
  lista o pierda su menú (eliminar, desactivar, deshabilitar: hoy todas las listas); se omite si la fila queda igual (una transición de workflow).
- **Avisos**: `avisarExito(this.snackBar, 'Etiqueta creada')` y, cuando corresponda, `avisarAdvertencia` / `avisarError` /
  `avisar` (`@shared/utils/avisos`); lo único que se pasa aparte es `{ duracion, accion }`.
- Funciones sin backend del toolbar (ordenar, exportar, más filtros): `<button type="button" appListaPendiente="ordenar | exportar |
  mas-filtros"></button>` (`@shared/components/lista-pendiente`); cualquier otra, con `appUnavailable="<motivo>"`. Nunca ocultas.
- Rutas de la sección: constantes en `pages/<sección>/<sección>.rutas.ts` (`RUTA_LISTA_X`, `RUTA_NUEVO_X`, …).
- Estado de carga de una **página**: un detalle usa `Carga<T>` + `conCarga()` (`@shared/utils/carga`); un formulario,
  `formularioDePagina()` (`marco.pendiente` / `marco.errorDeCarga`). Los dos se dibujan con `<app-estado-carga>`
  (`@shared/components/estado-carga`): cargando (un solo dibujo, con `aria-live`) / error con "Reintentar" / no existe con "Ir al listado".
  "No existe" se decide con `esXInexistente` (404 o código de negocio) en `<x>-save-error.ts`, y la lectura va con
  `sinDialogoGlobal()` en el datasource: adopción, ficha, plantilla, organismo y rol.

## Alta y edición: diálogo **o** página, nunca las dos para la misma entidad
- **Diálogo** (pocos campos, sin ficha propia): `DialogoEnLista` (`@shared/utils/dialogo-en-lista`) +
  `abrirFormDialog(this.dialog, dialogoDeX(facade, fila))`. Rutas `…/nuevo` y `…/editar/:id` sin componente, con
  `redirigirAlDialogo`; la lista lleva `validarDialogoDeLista` + `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`.
- **Página** (ficha con bloques o muchos campos): `form/` o `detail/` con `canDeactivate: [unsavedChangesGuard]`. Todas
  siguen el mismo patrón: `<app-membrete>` arriba, la familia `.ficha-paneles` abajo (ver `scss-bem.md`) y, si hay
  formulario, `<app-dynamic-form>` (con `[paneles]` si es de dos paneles) + `formularioDePagina()`
  (ver `formularios-dynamic-form.md`). Helpers de una sola pantalla van al lado de ella (`form/rol-campos.ts`).

## No hagas
- Reimplementar en la pantalla lo que ya da un helper de `@shared/utils` o `@core/utils` (confirmación, foco, diálogo por URL,
  cierre con cambios sin guardar, búsqueda). Si falta un helper y el comportamiento se repite, se extrae ahí.
- `snackBar.open(...)` a mano; `sort$` / `pageIndex$` / `pageSize$` y un `combineLatest` propio para buscar, ordenar y paginar;
  flags `loading` / `error` / `deletingId` + `cdr.markForCheck()` en una lista; `abrirConfirmacion(...).pipe(...).subscribe(...)`
  con el foco y el aviso armados a mano; literales `'/dashboard/…'` en un componente.
- Copiar el bloque `.load-state` (cargando / error / no existe) en el template de una página.
- Escribir a mano el membrete (`<header class="detail-header">`) o repetir en la pantalla el ciclo `saving` / `serverError` /
  `unaVez` / `salirTrasGuardar`: son `<app-membrete>` y `formularioDePagina()`.
- Componentes, pipes o modelos sueltos en la raíz de la sección. Lógica de dominio o llamadas HTTP en la pantalla.
- Una lista con paginado en servidor (auditoría, feedback) sobre `ListaCliente`: es solo para listas que el backend devuelve enteras.

Ejemplo canónico: `pages/etiquetas/**` (lista + `etiqueta-dialogo.ts` + `etiqueta-save-error.ts`) y sus rutas en `pages/pages.module.ts`;
`pages/modalidades/list/` es la lista mínima sobre `ListaCliente`; `pages/tramites/fichas/list/` la que tiene más filtros.
Lo verifica: `npm run check:structure` (árbol y nombres) y `npm run lint` (`no-restricted-syntax` en `pages/`: `snackBar.open`,
`sort$` / `pageIndex$` / `pageSize$`, literales `'/dashboard/…'`); el spec de la lista con `describeLista` /
`describeDialogoDeLista` (`@shared/utils/testing/lista.testing`); estados, foco y textos los revisa `angular-ssr-reviewer`.
