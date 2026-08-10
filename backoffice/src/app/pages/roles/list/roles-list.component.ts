import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { buildPermisoGroups, PermisoGroupVM } from '@core/utils/permiso-groups.util';
import { RolesFacade, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    PageActionsDirective,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly authTokenService = inject(AuthTokenService);

  readonly roles$ = this.facade.roles$;
  loading = true;

  /** Filtro "Todos/Global/Organismo" (campo real `scopeTipo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<'todos' | 'global' | 'organismo'>('todos');
  readonly filterTabs$ = this.roles$.pipe(map((roles): FilterTabOption[] => [
    { value: 'todos', label: 'Todos', count: roles.length },
    { value: 'global', label: 'Global', count: roles.filter((r) => r.scopeTipo === 'global').length },
    { value: 'organismo', label: 'Organismo', count: roles.filter((r) => r.scopeTipo === 'organismo').length },
  ]));
  readonly rolesFiltrados$ = combineLatest([this.roles$, this.filtro$]).pipe(
    map(([roles, filtro]) => (filtro === 'todos' ? roles : roles.filter((r) => r.scopeTipo === filtro))),
  );

  /**
   * `/api/role` se autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE), no por permiso: quien llega
   * a esta pantalla puede gestionar roles, así que los botones no se gatean por permiso. Única salvedad:
   * el rol `SUPERADMIN` solo lo puede editar/eliminar un SUPERADMIN (backend corta con 403 `4029`, §4.4).
   *
   * Se recalcula reactivamente ante cada emisión de `getCurrentUser$()` (no se cachea en un field
   * initializer) para no quedar stale si cambia la sesión —p. ej. el switcher de rol de dev—, siguiendo la
   * misma convención que `admin-layout` y `*appHasPermission`.
   */
  private isSuperAdmin = false;

  /** ¿Puede el usuario logueado modificar esta fila? (protege el rol SUPERADMIN). */
  canModify(rol: RolVM): boolean {
    return this.isSuperAdmin || rol.codigo.toUpperCase() !== UserRole.SUPERADMIN;
  }

  columns: TableColumn<RolVM>[] = [
    { key: 'rol',       label: 'Rol',      width: '42%' },
    { key: 'scopeTipo', label: 'Scope',    width: '16%', hideOnMobile: true },
    { key: 'permisos',  label: 'Permisos', width: '18%' },
    { key: 'acciones',  label: 'Acciones', width: '24%' },
  ];

  // ── Master-detail: rol seleccionado + su editor de permisos (visualización read-friendly). ──
  // El catálogo completo de permisos se resuelve una sola vez (reusa `RolesFacade.getFormData`, ya
  // cableado para el form de rol); la selección compara `rol.permisos` contra ese catálogo — sin
  // llamadas de red adicionales por click.
  private catalogoPermisos: PermisoVM[] = [];
  selectedRol: RolVM | null = null;
  permisoGroups: PermisoGroupVM[] = [];

  readonly isRowSelected = (rol: RolVM): boolean => this.selectedRol?.id === rol.id;

  constructor(
    private facade: RolesFacade,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    // Rol reactivo: mantiene `canModify()` alineado con la sesión actual (switcher de rol dev, refresh).
    this.authTokenService.getCurrentUser$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.isSuperAdmin = user?.role === UserRole.SUPERADMIN;
        this.cdr.markForCheck();
      });

    this.loading = true;
    try {
      const [roles, formData] = await Promise.all([
        firstValueFrom(this.facade.loadRoles()),
        firstValueFrom(this.facade.getFormData(null)),
      ]);
      this.catalogoPermisos = formData.permisos;
      if (roles.length > 0) {
        this.selectRol(roles[0]);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  selectRol(rol: RolVM): void {
    this.selectedRol = rol;
    this.permisoGroups = buildPermisoGroups(this.catalogoPermisos, new Set(rol.permisos.map((p) => p.id)));
    this.cdr.markForCheck();
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/roles/nuevo']);
  }

  onEdit(rol: RolVM): void {
    this.router.navigate(['/dashboard/roles/editar', rol.id]);
  }

  onDelete(rol: RolVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar rol',
        message: `¿Está seguro de eliminar el rol "${rol.codigo}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(Boolean),
        switchMap(() => this.facade.delete(rol.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Rol eliminado', 'OK', { duration: 3000 });
          if (this.selectedRol?.id === rol.id) {
            this.selectedRol = null;
            this.permisoGroups = [];
          }
          this.cdr.markForCheck();
        },
      });
  }
}
