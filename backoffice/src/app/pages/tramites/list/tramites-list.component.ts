import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDivider } from '@angular/material/divider';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TramitePreviewComponent } from '../../../shared/components/tramite-preview/tramite-preview.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent, TableSortEvent } from '../../../shared/components/table';
import { EstadoBadgePipe } from '../../../shared/pipes/estado-badge.pipe';
import { TramiteService } from '../../../core/services/tramite.service';
import { OrganismoService } from '../../../core/services/organismo.service';
import { LocalidadService } from '../../../core/services/localidad.service';
import { Tramite, TramiteFilter, Organismo, Localidad } from '../../../core/models/tramite.model';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { UserRole } from '../../../core/enums/user-role.enum';

@Component({
  selector: 'app-tramites-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDivider,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
    EstadoBadgePipe,
  ],
  templateUrl: './tramites-list.component.html',
  styleUrls: ['./tramites-list.component.scss'],
})
export class TramitesListComponent implements OnInit {
  tramites: Tramite[] = [];
  organismos: Organismo[] = [];
  localidades: Localidad[] = [];
  loading = true;
  totalItems = 0;
  currentPage = 0;
  pageSize = 10;
  isSuperAdmin = false;
  filterForm: FormGroup;

  private destroyRef = inject(DestroyRef);
  private loadTrigger$ = new Subject<TramiteFilter>();
  columns: TableColumn<Tramite>[] = [
    { key: 'titulo', label: 'Titulo', sortable: true, width: '30%' },
    { key: 'estado', label: 'Estado', sortable: true, width: '130px' },
    { key: 'modalidad', label: 'Modalidad', hideOnMobile: true },
    { key: 'updatedAt', label: 'Actualizado', sortable: true, width: '160px', hideOnMobile: true },
    { key: 'acciones', label: 'Acciones', width: '80px' },
  ];

  constructor(
    private fb: FormBuilder,
    private tramiteService: TramiteService,
    private organismoService: OrganismoService,
    private localidadService: LocalidadService,
    private authTokenService: AuthTokenService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      organismoId: [''],
      estado: [''],
      localidadId: [''],
    });

    this.isSuperAdmin = this.authTokenService.getUserRole() === UserRole.SUPERADMIN;
  }

  ngOnInit(): void {
    this.loadTrigger$.pipe(
      tap(() => this.loading = true),
      switchMap(f => this.tramiteService.getAll(f)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.tramites = response.data;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    this.filterForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadTramites();
    });

    this.loadTramites();
    this.loadOrganismos();
    this.loadLocalidades();
  }

  loadLocalidades(): void {
    this.localidadService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => (this.localidades = response.data),
    });
  }

  loadTramites(): void {
    const tramiteFilter: TramiteFilter = {
      ...this.filterForm.value,
      page: this.currentPage + 1,
      pageSize: this.pageSize,
    };
    this.loadTrigger$.next(tramiteFilter);
  }

  loadOrganismos(): void {
    if (this.isSuperAdmin) {
      this.organismoService.getAll().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (response) => (this.organismos = response.data),
      });
    }
  }

  onPageChange(event: TablePageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTramites();
  }

  onSortChange(_event: TableSortEvent): void {
    this.loadTramites();
  }

// Acciones

  onCreate(): void {
    this.router.navigate(['/dashboard/tramites/nuevo']);
  }

  onEdit(tramite: Tramite): void {
    this.router.navigate(['/dashboard/tramites/editar', tramite.id]);
  }

  onView(tramite: Tramite): void {
    this.router.navigate(['/dashboard/tramites/detalle', tramite.id]);
  }

  onPreview(tramite: Tramite): void {
    this.dialog.open(TramitePreviewComponent, {
      data: tramite,
      width: '95vw',
      maxWidth: '1100px',
      maxHeight: '90vh',
      panelClass: 'preview-dialog-panel',
    });
  }

  onSendToReview(tramite: Tramite): void {
    this.tramiteService.sendToReview(tramite.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.snackBar.open('Tramite enviado a revision', 'OK', { duration: 3000 });
        this.loadTramites();
      },
    });
  }

  onPublish(tramite: Tramite): void {
    this.tramiteService.publish(tramite.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.snackBar.open('Tramite publicado', 'OK', { duration: 3000 });
        this.loadTramites();
      },
    });
  }

  onUnpublish(tramite: Tramite): void {
    this.tramiteService.unpublish(tramite.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.snackBar.open('Tramite despublicado', 'OK', { duration: 3000 });
        this.loadTramites();
      },
    });
  }

  onDelete(tramite: Tramite): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tramite',
        message: `Esta seguro de eliminar "${tramite.titulo}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed().pipe(
      filter(Boolean),
      switchMap(() => this.tramiteService.delete(tramite.id)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.snackBar.open('Tramite eliminado', 'OK', { duration: 3000 });
      this.loadTramites();
    });
  }
}