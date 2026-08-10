import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
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

  /**
   * ¿Es el rol SUPERADMIN? A diferencia de `canModify()` (que depende de QUIÉN mira la pantalla), esto es
   * un hecho estructural del rol: el tag "Protegido" y la nota del detalle deben verse siempre para
   * SUPERADMIN, sea cual sea el usuario logueado (incluido otro SUPERADMIN).
   */
  readonly isSuperAdminRole = (rol: RolVM): boolean => rol.codigo.toUpperCase() === UserRole.SUPERADMIN;

  columns: TableColumn<RolVM>[] = [
    { key: 'rol',      label: 'Rol' },
    { key: 'permisos', label: 'Permisos', width: '110px' },
    // Divergencia: BACKEND_API_SPEC.md (ítem "G") documenta que `RoleResponseDTO` YA expone `active`
    // ("ahora SÍ incluye active"; antes no se exponía) y QA lo confirmó pendiente ("Editar Roles: no
    // muestra el 'active' del role", ver qa_result.md). El dato real existe en el backend, pero
    // `RolVM`/`toRolVM()` (core/features/roles) todavía no lo mapean — fuera del alcance de esta pantalla
    // (solo se tocan los archivos de roles-list). Hasta que se agregue `activo` al ViewModel, la columna
    // muestra un placeholder honesto (no se inventa true/false). TODO: una vez mapeado, bindear a
    // `row.activo` con `.bool-badge`/`.bool-badge--active`/`.bool-badge--inactive` (mismo patrón que Organismos).
    { key: 'activo',   label: 'Activo', width: '110px' },
    { key: 'acciones', label: 'Acciones', width: '150px' },
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
