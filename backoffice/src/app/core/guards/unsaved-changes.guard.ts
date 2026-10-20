import { Injector, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { from, map, switchMap } from 'rxjs';

/**
 * La implementa cualquier pantalla que pueda perder trabajo al navegar fuera.
 * Devolver `false` cuando no haya nada que perder: el guard no pregunta.
 */
export interface PuedeTenerCambiosSinGuardar {
  tieneCambiosSinGuardar(): boolean;
}

/**
 * Pide confirmación antes de abandonar un formulario con cambios sin guardar.
 * Cubre tanto el botón "Cancelar" como la navegación del sidenav o el breadcrumb,
 * que hasta ahora descartaban el formulario sucio sin avisar.
 *
 * Se aplica por ruta:
 *   { path: '...', component: XForm, canDeactivate: [unsavedChangesGuard] }
 *
 * Nota: no intercepta el cierre o recarga de la pestaña del navegador — eso
 * requiere `beforeunload` y es una decisión aparte.
 */
export const unsavedChangesGuard: CanDeactivateFn<PuedeTenerCambiosSinGuardar> = (component) => {
  if (!component?.tieneCambiosSinGuardar?.()) return true;

  // `MatDialog` y el diálogo se cargan con `import()` solo cuando hay algo que confirmar: el guard
  // vive en `pages.module` y sin esto arrastra cdk/overlay + material/dialog al chunk compartido.
  // `inject` tiene que correr acá (contexto de inyección síncrono); el `get` va después del import.
  const injector = inject(Injector);
  return from(
    Promise.all([
      import('@angular/material/dialog'),
      import('../../shared/components/confirm-dialog/confirm-dialog.component'),
    ]),
  ).pipe(
    switchMap(([{ MatDialog }, { ConfirmDialogComponent }]) =>
      injector
        .get(MatDialog)
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Salir sin guardar',
            message: 'Hay cambios sin guardar en este formulario. Si salís ahora se pierden.',
            confirmText: 'Salir sin guardar',
            cancelText: 'Seguir editando',
          },
          panelClass: 'custom-modal-panel',
        })
        .afterClosed(),
    ),
    map((confirmado) => !!confirmado),
  );
};
