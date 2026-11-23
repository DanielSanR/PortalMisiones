---
name: nueva-pantalla-lista
description: Crea una pantalla de lista del backoffice (Angular 17) con alta y edición en diálogo, su ruta, permisos, nav y comando, copiando el molde pages/etiquetas. Úsalo para cualquier ABM nuevo de pocos campos o para sumar una lista a un feature existente. Requiere que el feature ya exista (skill nueva-feature). No aplica a public/.
---

# Crear una lista con alta y edición en diálogo (backoffice)

Molde verificado: `backoffice/src/app/pages/etiquetas/` (`list/etiquetas-list.component.{ts,html,scss,spec.ts}`,
`etiqueta-dialogo.ts`, `etiqueta-save-error.ts`). Normas: `.claude/rules/pantallas-lista-dialogo.md`,
`formularios-dynamic-form.md`, `textos-y-errores.md`, `accesibilidad.md`, `rbac-permisos.md`, `scss-bem.md`.
Si la entidad tiene ficha propia o muchos campos, no va en diálogo: usá `nuevo-formulario` (en página).

## Pasos
0. **Checklists de UX**: resolvé los aplicables con la skill `checklist-design` (tabla, buscador, filtros, estado vacío).
1. **Feature**: el facade expone `xxx$`, `loadX()`, `getFormData(id)`, `create`, `update`, `delete`. Si falta, `nueva-feature`.
2. **Archivos** en `pages/<sección>/`:
   - `list/<sección>-list.component.{ts,html,scss}` (+ `.spec.ts`).
   - `<entidad>-dialogo.ts`: `camposDeX(...)` y `dialogoDeX(facade, fila): FormDialogData<XVM>`.
   - `<entidad>-save-error.ts`: `CONFLICTOS_X: ConflictoDeCampo[]` + `FALLBACK_X` (y `errorDeEliminarX` con
     `errorDeAccionPorCodigo` si eliminar tiene rechazos de negocio).
3. **Componente de lista**: standalone, OnPush, `inject(XFacade)`. Sin `loading` / `error` / `sort$` / `pageIndex$` propios:
   ```ts
   readonly lista = new ListaCliente<XVM>({
     fuente$: this.facade.xs$,
     cargar: () => this.facade.loadXs(),
     buscarEn: (x) => [x.nombre],
     comparar: compararPorTexto((x, columna) => (columna === 'nombre' ? x.nombre : '')),
     extras: textosDeVacio({ emptyTitle: 'Todavía no hay …', … }, { emptyTitle: 'Sin resultados', … }),
     alCargar: (lista) => this.dialogo.listaLista(lista),
   });
   ngOnInit(): void { this.lista.cargar(); }
   onEmptyAction(): void { this.lista.accionDeVacio(() => this.onCreate()); }
   ```
   Con un filtro real (tabs o select): `filtros$`, `filtrar`, `filtrosActivos`, `limpiarFiltros`, `quitarFiltro`; las tabs se
   cuentan sobre `this.lista.buscadas$`. La vuelta a la primera página al buscar, filtrar u ordenar la hace `ListaCliente` sola.
4. **Template**: `<ng-template appPageActions>` con el botón "Nuevo…" (`appAtajo="n"` + `*appHasPermission`);
   `@if (lista.vista$ | async; as vista)`; `.list-toolbar` con `<app-list-search [atajoFoco]="true" [control]="lista.searchCtrl">`,
   contador con `aria-live="polite"`, `<button type="button" appListaPendiente="ordenar | exportar | mas-filtros">`,
   `<app-filter-tabs>`, `<app-active-filters (quitar)="lista.quitar($event)" (limpiar)="lista.limpiar()">`;
   `<app-shared-table [data]="vista.rows" [loading]="vista.cargando" [error]="vista.error" (retry)="lista.cargar()"
   (sortChange)="lista.ordenar($event)" [totalItems]="vista.total" [pageIndex]="vista.pageIndex" [pageSize]="vista.pageSize"
   (pageChange)="lista.paginar($event)">` con el vacío en sus dos variantes y `appTableCell`;
   `<app-row-actions [primary] [actions] [busy]="vista.ocupadaId === row.id">`.
5. **Diálogo**: `private readonly dialogo = new DialogoEnLista<XVM, XVM>({ abrir, buscar, alGuardar, noEncontrada })` con
   `abrirFormDialog(this.dialog, dialogoDeX(this.facade, fila))` y
   `alGuardar: (_g, fila) => avisarExito(this.snackBar, fila ? 'X actualizada' : 'X creada')`. La lista le avisa con `alCargar`.
6. **Eliminar**: `confirmarBaja({ dialog, snackBar, destroyRef, confirmacion: { title (en pregunta), message, highlight,
   danger: true, confirmText, busyText, confirmAction: () => this.facade.delete(x.id), errorDeAccion? }, aviso: 'X eliminada',
   ocupado: this.lista.ocupar(x.id), foco: { host: this.host } })`. No armes el ciclo a mano con `abrirConfirmacion`.
7. **Estilos**: solo lo propio, con el prefijo `<entidad>list` (`&__`, `&--`, tokens). Si no hay nada propio, no inventes reglas.
8. **Rutas** en `pages/pages.module.ts` (copiá las tres de `etiquetas/*`): `<x>/lista` con `accessGuard` +
   `validarDialogoDeLista({ nuevo, editar })` + `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`; `<x>/nuevo` y
   `<x>/editar/:id` con `redirigirAlDialogo(...)` y `children: []`. Siempre `data: { access, redirectTo: HOME, breadcrumb }`.
9. **Permisos en todas las puertas con la misma regla**: ruta, `NAV_GROUPS` (`core/constants/role-mapping.constants.ts`),
   `COMANDOS` (`core/constants/comandos.constants.ts`), botón, CTA del vacío (`[emptyActionPermission]`) y `RowAction.permission`.
   Regla compuesta → constante en `core/constants/policy-overrides.constants.ts`.
10. **Íconos nuevos**: `npm run icons`.
11. **Specs**: `<entidad>-dialogo.spec.ts` (campos y payload) y `<sección>-list.component.spec.ts` con el arnés
    `@shared/utils/testing/lista.testing`: `describeLista({...})` (carga, error, vacíos, búsqueda, orden, paginado, gating,
    baja con foco y aviso) + `describeDialogoDeLista({...})` (alta y edición), más los casos propios con `montarLista` / `ListaPO`.
    Molde: `pages/modalidades/list/modalidades-list.component.spec.ts`.

## Verificación (obligatoria)
- `cd backoffice && npm run check` en verde.
- Probá a mano con `npx ng serve` (mock): alta, edición sin cambios (no guarda), duplicado (error en el campo, sin diálogo
  global), eliminar (foco en la fila siguiente), carga fallida (reintento), teclado completo, y un rol sin permiso.
- Agentes: `angular-ssr-reviewer`; `front-design` en modo AUDIT si hubo diseño nuevo.
