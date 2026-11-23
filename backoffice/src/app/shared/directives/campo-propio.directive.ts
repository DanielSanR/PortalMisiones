import { Directive, Input, TemplateRef, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';

/** Lo que recibe el template de un campo propio: el `FormGroup` del formulario (`let-grupo`). */
export interface ContextoDeCampoPropio {
  $implicit: FormGroup;
}

/**
 * Contenido de un campo `custom` (o de un `vista` sin componente) de `<app-dynamic-form>`: la página lo
 * proyecta como template y el motor lo dibuja en el lugar del campo —su celda de la grilla o su panel—, no al
 * final del formulario. Ver `FieldConfig.type` (`custom`) en `@core/models/field.interface`.
 *
 *   <app-dynamic-form [fields]="campos" [paneles]="paneles">
 *     <ng-template appCampoPropio="permissionsIds" let-grupo>…</ng-template>
 *   </app-dynamic-form>
 */
@Directive({
  selector: 'ng-template[appCampoPropio]',
  standalone: true,
})
export class CampoPropioDirective {
  /** `name` del campo al que pertenece. */
  @Input({ required: true }) appCampoPropio = '';

  readonly template = inject<TemplateRef<ContextoDeCampoPropio>>(TemplateRef);

  /** Tipa `let-grupo` en el template de la página. */
  static ngTemplateContextGuard(_dir: CampoPropioDirective, ctx: unknown): ctx is ContextoDeCampoPropio {
    return true;
  }
}
