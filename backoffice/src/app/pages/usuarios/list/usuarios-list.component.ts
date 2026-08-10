import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { RolLabelPipe } from '../../../shared/pipes/rol-label.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@core/utils/list-filter.utils';
import { UsuariosFacade, UsuarioVM } from '@features/usuarios';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RolLabelPipe,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.scss',
})
export class UsuariosListComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  /** Stream de estado del facade; se consume con async pipe en el template. */
  readonly usuarios$ = this.facade.usuarios$;
  loading = true;

  /** Filtro "Todos/Activos/Inactivos" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');
  readonly filterTabs$ = this.usuarios$.pipe(map((usuarios) => activoFilterTabs(usuarios)));
  readonly usuariosFiltrados$ = combineLatest([this.usuarios$, this.filtro$]).pipe(
    map(([usuarios, filtro]) => filterByActivo(usuarios, filtro)),
  );

  columns: TableColumn<UsuarioVM>[] = [
    { key: 'nombre',    label: 'Nombre',    width: '25%' },
    { key: 'email',     label: 'Email',     width: '25%', hideOnMobile: true },
    { key: 'rol',       label: 'Rol',       width: '140px' },
    { key: 'organismo', label: 'Organismo', hideOnMobile: true },
    { key: 'activo',    label: 'Activo',    width: '100px' },
    { key: 'acciones',  label: 'Acciones',  width: '80px' },
  ];

  constructor(
    private facade: UsuariosFacade,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await firstValueFrom(this.facade.loadUsuarios());
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/usuarios/nuevo']);
  }

  onEdit(usuario: UsuarioVM): void {
    this.router.navigate(['/dashboard/usuarios/editar', usuario.id]);
  }

  async onToggleActive(usuario: UsuarioVM): Promise<void> {
    const eraActivo = usuario.activo;
    try {
      await firstValueFrom(this.facade.toggleActive(usuario.id));
      this.snackBar.open(eraActivo ? 'Usuario desactivado' : 'Usuario activado', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Error al cambiar estado', 'OK', { duration: 3000 });
    } finally {
      this.cdr.markForCheck();
    }
  }
}
