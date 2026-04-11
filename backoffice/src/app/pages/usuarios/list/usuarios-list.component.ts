import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { RolLabelPipe } from '../../../shared/pipes/rol-label.pipe';
import { UsuarioService } from '../../../core/services/usuario.service';
import { Usuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
    RolLabelPipe,
  ],
  templateUrl: './usuarios-list.component.html',
})
export class UsuariosListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  usuarios: Usuario[] = [];
  loading = true;

  /** Configuracion de columnas para la tabla de usuarios */
  columns: TableColumn<Usuario>[] = [
    { key: 'nombre', label: 'Nombre', width: '25%' },
    { key: 'email', label: 'Email', width: '25%', hideOnMobile: true },
    { key: 'rol', label: 'Rol', width: '140px' },
    { key: 'organismo', label: 'Organismo', hideOnMobile: true },
    { key: 'activo', label: 'Activo', width: '100px' },
    { key: 'acciones', label: 'Acciones', width: '80px' },
  ];

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsuarios();
  }

  loadUsuarios(): void {
    this.loading = true;
    this.usuarioService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.usuarios = response.data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/usuarios/nuevo']);
  }

  onEdit(usuario: Usuario): void {
    this.router.navigate(['/dashboard/usuarios/editar', usuario.id]);
  }

  onToggleActive(usuario: Usuario): void {
    const previousState = usuario.activo;
    usuario.activo = !usuario.activo;

    this.usuarioService.toggleActive(usuario.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.snackBar.open(
          previousState ? 'Usuario desactivado' : 'Usuario activado',
          'OK',
          { duration: 3000 }
        );
      },
      error: () => {
        usuario.activo = previousState;
        this.snackBar.open('Error al cambiar estado', 'OK', { duration: 3000 });
      },
    });
  }
}