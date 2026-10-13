import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { AccessRule } from '../../../core/models/access-rule.model';

/** Una acción de fila. `run` la ejecuta el consumidor; el componente solo la presenta. */
export interface RowAction {
  label: string;
  /** Ícono Phosphor SIN el prefijo `ph-` (ej. `'trash'`). */
  icon: string;
  run: () => void;
  /** Permiso atómico requerido. Sin él la acción no se muestra. */
  permission?: string;
  /** Regla completa (varios permisos y/o roles), para cuando un permiso solo no alcanza. */
  rule?: AccessRule;
  /** Destructiva: se pinta en rojo y se agrupa al final, detrás de un divisor. */
  danger?: boolean;
  disabled?: boolean;
  /** Solo si el label no alcanza como texto accesible. */
  ariaLabel?: string;
}

/**
 * Acciones de una fila de tabla: una acción principal con texto + un menú "⋮" con el resto.
 *
 * El patrón viene del diseño ("Pantallas · Backoffice Misiones", LISTA) y reemplaza al
 * de acción principal + ícono suelto. Ese dejaba el borrado —irreversible— a un click de
 * distancia del botón de uso diario y sin etiqueta que lo nombrara, justo al revés de lo
 * que conviene: lo explícito debe ser lo peligroso.
 *
 *   <app-row-actions [primary]="editarDe(row)" [actions]="accionesDe(row)"></app-row-actions>
 *
 * El gating por permiso es interno y reactivo (se reevalúa si cambia la sesión), así que
 * el consumidor no necesita `*appHasPermission` por botón.
 */
@Component({
  selector: 'app-row-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, MatMenuModule, MatTooltipModule],
  templateUrl: './row-actions.component.html',
  styleUrl: './row-actions.component.scss',
})
export class RowActionsComponent {
  private readonly auth = inject(AuthTokenService);

  private readonly primary$ = new BehaviorSubject<RowAction | null>(null);
  private readonly actions$ = new BehaviorSubject<RowAction[]>([]);

  /** Acción principal, con texto a la vista (normalmente "Editar"). */
  @Input() set primary(value: RowAction | null) {
    this.primary$.next(value ?? null);
  }

  /** Resto de acciones; van dentro del menú "⋮". */
  @Input() set actions(value: RowAction[]) {
    this.actions$.next(value ?? []);
  }

  /** Hay una operación en curso sobre esta fila: bloquea todo y muestra el spinner. */
  @Input() busy = false;
  @Input() busyLabel = 'Procesando...';
  @Input() menuLabel = 'Más acciones';

  private readonly usuario$ = this.auth.getCurrentUser$();

  readonly primaryVisible$ = combineLatest([this.primary$, this.usuario$]).pipe(
    map(([accion]) => (accion && this.permitida(accion) ? accion : null)),
  );

  /**
   * Las destructivas se ordenan al final para que el menú no las ponga bajo el cursor
   * al abrirse. `divisor` marca dónde cortar entre los dos grupos.
   */
  readonly menu$ = combineLatest([this.actions$, this.usuario$]).pipe(
    map(([acciones]) => {
      const visibles = acciones.filter((accion) => this.permitida(accion));
      const normales = visibles.filter((accion) => !accion.danger);
      const destructivas = visibles.filter((accion) => accion.danger);
      return {
        normales,
        destructivas,
        divisor: normales.length > 0 && destructivas.length > 0,
        vacio: visibles.length === 0,
      };
    }),
  );

  private permitida(accion: RowAction): boolean {
    return (!accion.permission || this.auth.can(accion.permission))
      && (!accion.rule || this.auth.canAccess(accion.rule));
  }
}
