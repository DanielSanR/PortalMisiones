import { Injectable, TemplateRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * "Cromática de página": mecanismo transversal que permite a cualquier pantalla registrar sus
 * acciones (botones de la toolbar) en el slot que expone el header del shell (`AdminLayout`), sin que
 * el shell conozca de antemano qué pantalla está montada. Reemplaza el patrón de pasar `topActions`
 * por `@Input` — cada feature se registra a sí misma vía `appPageActions` (ver
 * `shared/directives/page-actions.directive.ts`).
 *
 * Un solo slot activo a la vez: al navegar, la pantalla saliente limpia su `TemplateRef` (la
 * directiva lo hace en `ngOnDestroy`) y la entrante registra el suyo.
 */
@Injectable({ providedIn: 'root' })
export class LayoutChromeService {
  private readonly actionsSubject = new BehaviorSubject<TemplateRef<unknown> | null>(null);

  /** Template de acciones de la página activa (o `null` si ninguna registró acciones). */
  readonly actions$: Observable<TemplateRef<unknown> | null> = this.actionsSubject.asObservable();

  setActions(template: TemplateRef<unknown> | null): void {
    this.actionsSubject.next(template);
  }

  clearActions(): void {
    this.actionsSubject.next(null);
  }
}
