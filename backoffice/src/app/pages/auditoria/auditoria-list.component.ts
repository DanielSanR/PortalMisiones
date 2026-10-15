import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent } from '@shared/components/table';
import { FilterTabsComponent } from '@shared/components/filter-tabs';
import { AccionLabelPipe } from './accion-label.pipe';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { AuditoriaAccion, AuditoriaFacade, AuditoriaPaginaVM, AuditoriaRegistroVM } from '@features/auditoria';
import { AuditoriaDetailDialogComponent } from './auditoria-detail-dialog.component';

@Component({
  selector: 'app-auditoria-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    AccionLabelPipe,
    PageActionsDirective,
  ],
  templateUrl: './auditoria-list.component.html',
  styleUrls: ['./auditoria-list.component.scss'],
})
export class AuditoriaListComponent implements OnInit {
  private readonly facade = inject(AuditoriaFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Última página cargada (server-side). */
  readonly pagina$ = this.facade.pagina$;
  readonly paginaVacia: AuditoriaPaginaVM = { registros: [], total: 0 };

  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  currentPage = 0;
  pageSize = 10;

  /** Carga en vuelo: se cancela si llega otra (filtro/página) para no pisar con una respuesta vieja. */
  private carga?: Subscription;

  columns: TableColumn<AuditoriaRegistroVM>[] = [
    { key: 'accion',  label: 'Acción',  width: '180px' },
    { key: 'tramite', label: 'Trámite' },
    { key: 'usuario', label: 'Usuario', hideOnMobile: true },
    { key: 'fecha',   label: 'Fecha',   width: '160px', hideOnMobile: true },
    { key: 'detalle', label: '',        width: '56px' },
  ];

  filterForm: FormGroup;

  acciones: { value: AuditoriaAccion; label: string }[] = [
    { value: 'crear',           label: 'Creación' },
    { value: 'editar',          label: 'Edición' },
    { value: 'publicar',        label: 'Publicación' },
    { value: 'despublicar',     label: 'Despublicación' },
    { value: 'enviar_revision', label: 'Envío a revisión' },
    { value: 'eliminar',        label: 'Eliminación' },
  ];

  constructor(
    private dialog: MatDialog,
    private fb: FormBuilder,
  ) {
    this.filterForm = this.fb.group({ search: [''], accion: [''] });
  }

  ngOnInit(): void {
    this.loadData();

    this.filterForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadData();
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = false;
    const v = this.filterForm.value;

    this.carga?.unsubscribe();
    this.carga = this.facade.loadPagina({
      page: this.currentPage + 1,
      pageSize: this.pageSize,
      search: v.search || undefined,
      accion: v.accion || undefined,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
        // Sin esto la tabla mostraría "No se encontraron registros", indistinguible de una carga fallida.
        error: () => {
          this.loading = false;
          this.error = true;
          this.cdr.markForCheck();
        },
      });
  }

  onPageChange(event: TablePageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  onViewDetail(registro: AuditoriaRegistroVM): void {
    this.dialog.open(AuditoriaDetailDialogComponent, {
      data: registro,
      width: '700px',
      panelClass: 'custom-modal-panel',
    });
  }

  clearFilters(): void {
    this.filterForm.reset({ search: '', accion: '' });
  }

  hasFilters(): boolean {
    const v = this.filterForm.value;
    return !!(v.search || v.accion);
  }
}
