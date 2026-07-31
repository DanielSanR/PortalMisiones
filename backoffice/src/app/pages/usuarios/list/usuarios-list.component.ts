import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { RolLabelPipe } from '../../../shared/pipes/rol-label.pipe';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { UsuariosFacade, UsuarioVM } from '@features/usuarios';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
    RolLabelPipe,
    HasPermissionDirective,
  ],
  templateUrl: './usuarios-list.component.html',
})
export class UsuariosListComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  /** Stream de estado del facade; se consume con async pipe en el template. */
  readonly usuarios$ = this.facade.usuarios$;
  loading = true;

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
