import { Directive, HostBinding, Input } from '@angular/core';

/**
 * Fija `aria-disabled` en hosts que ya lo bindean por su cuenta (p. ej. `mat-menu-item`, que escribe
 * `aria-disabled="false"` mientras no esté `[disabled]`). Un `[attr.aria-disabled]` del template no
 * tiene precedencia sobre el host binding del componente; el de una directiva aplicada sobre el mismo
 * host sí, porque los host bindings de directivas se ejecutan después que los del componente.
 *
 *   <button mat-menu-item [appAriaDisabled]="accion.disabled">…</button>
 *
 * Para features pendientes con motivo, usar `appUnavailable` (ya incluye esto + tooltip).
 */
@Directive({
  selector: '[appAriaDisabled]',
  standalone: true,
})
export class AriaDisabledDirective {
  @Input({ alias: 'appAriaDisabled' }) deshabilitado: boolean | null | undefined = false;

  @HostBinding('attr.aria-disabled')
  get ariaDisabled(): 'true' | null {
    return this.deshabilitado ? 'true' : null;
  }
}
