import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent } from '../../shared/components/table';
import { FilterTabsComponent } from '../../shared/components/filter-tabs';
import { AccionLabelPipe } from '../../shared/pipes/accion-label.pipe';
import { PageActionsDirective } from '../../shared/directives/page-actions.directive';
import { AuditoriaService } from '../../core/services/auditoria.service';
import { AuditoriaTramite, AuditoriaAccion, AuditoriaFilter } from '../../core/models/dashboard.model';
import { AuditoriaDetailDialogComponent } from './auditoria-detail-dialog.component';

@Component({
  selector: 'app-auditoria-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  registros: AuditoriaTramite[] = [];
  loading = true;
  totalItems = 0;
  currentPage = 0;
  pageSize = 10;

  columns: TableColumn<AuditoriaTramite>[] = [
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
    private auditoriaService: AuditoriaService,
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
    const v = this.filterForm.value;

    const filter: AuditoriaFilter = {
      page: this.currentPage + 1,
      pageSize: this.pageSize,
      search: v.search || undefined,
      accion: v.accion || undefined,
    };

    this.auditoriaService.getAll(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.registros = response.data;
          this.totalItems = response.total;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onPageChange(event: TablePageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  onViewDetail(registro: AuditoriaTramite): void {
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
