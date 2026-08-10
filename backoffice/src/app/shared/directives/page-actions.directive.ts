import { Directive, DestroyRef, OnInit, TemplateRef, inject } from '@angular/core';
import { LayoutChromeService } from '../../core/services/layout-chrome.service';

/**
 * Registra el `TemplateRef` de la página activa en el slot de acciones del header del shell.
 *
 *   <ng-template appPageActions>
 *     <button class="btn btn--secondary">Exportar</button>
 *     <button class="btn btn--primary">Nuevo trámite</button>
 *   </ng-template>
 *
 * No proyecta el template por sí misma (no es una directiva `*estructural` con `viewContainerRef`):
 * solo lo publica en `LayoutChromeService` para que `AdminLayout` lo renderice vía
 * `*ngTemplateOutlet` en el header. Se limpia sola al destruirse (cambio de ruta).
 */
@Directive({
  selector: '[appPageActions]',
  standalone: true,
})
export class PageActionsDirective implements OnInit {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly chrome = inject(LayoutChromeService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.chrome.setActions(this.templateRef);
    this.destroyRef.onDestroy(() => this.chrome.clearActions());
  }
}
