import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent } from '@shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '@shared/components/filter-tabs';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { FeedbackFacade, FeedbackFilterVM, FeedbackPageVM, FeedbackStatsVM, FeedbackVM } from '@features/feedback';

@Component({
  selector: 'app-feedback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule,
    MatTooltipModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    PageActionsDirective,
  ],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss',
})
export class FeedbackComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly facade = inject(FeedbackFacade);
  /** Cada emisión dispara una consulta; `switchMap` descarta la anterior si sigue en vuelo. */
  private readonly load$ = new Subject<FeedbackFilterVM>();
  /** Cada emisión vuelve a pedir el resumen (carga inicial y "Reintentar"). */
  private readonly loadStats$ = new Subject<void>();

  registros: FeedbackVM[] = [];
  stats: FeedbackStatsVM | null = null;
  /** Falló el resumen: en su lugar se muestra un aviso compacto con "Reintentar". */
  statsError = false;
  statsCargando = false;
  loading = true;
  /** La carga falló: la tabla muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  totalItems = 0;
  currentPage = 0;
  pageSize = 10;
  tramiteIdFijo: string | null = null;

  columns: TableColumn<FeedbackVM>[] = [
    { key: 'util',       label: 'Valoración', width: '120px' },
    { key: 'tramite',    label: 'Trámite' },
    { key: 'comentario', label: 'Comentario' },
    { key: 'fecha',      label: 'Fecha',      width: '150px', hideOnMobile: true },
  ];

  filterForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      esUtil: [''],
      fechaDesde: [null],
      fechaHasta: [null],
    });
  }

  ngOnInit(): void {
    this.tramiteIdFijo = this.route.snapshot.queryParamMap.get('tramiteId');

    this.loadStats$.pipe(
      switchMap(() => this.facade.getStats().pipe(
        catchError(() => of(null as FeedbackStatsVM | null)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((stats) => {
      this.stats = stats;
      this.statsError = !stats;
      this.statsCargando = false;
      this.cdr.markForCheck();
    });

    this.cargarStats();

    this.load$.pipe(
      switchMap((filter) => this.facade.list(filter).pipe(
        // Un error de carga se muestra como error (no como "no hay datos") y no corta el stream.
        catchError(() => of(null as FeedbackPageVM | null)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (page) {
        this.registros = page.items;
        this.totalItems = page.total;
      } else {
        this.registros = [];
        this.error = true;
      }
      this.loading = false;
      this.cdr.markForCheck();
    });

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

    this.load$.next({
      page: this.currentPage + 1,
      pageSize: this.pageSize,
      search: v.search || undefined,
      esUtil: v.esUtil !== '' && v.esUtil !== null ? v.esUtil : undefined,
      fechaDesde: v.fechaDesde ? this.toISODate(v.fechaDesde) : undefined,
      fechaHasta: v.fechaHasta ? this.toISODate(v.fechaHasta) : undefined,
      tramiteId: this.tramiteIdFijo ?? undefined,
    });
  }

  cargarStats(): void {
    this.statsCargando = true;
    this.loadStats$.next();
  }

  onPageChange(event: TablePageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  clearFilters(): void {
    this.filterForm.reset({ search: '', esUtil: '', fechaDesde: null, fechaHasta: null });
  }

  hasFilters(): boolean {
    const v = this.filterForm.value;
    return !!(v.search || v.esUtil !== '' || v.fechaDesde || v.fechaHasta);
  }

  /** Filtro real "Todas/Útil/No útil" (campo `esUtil`): reusa el mismo `filterForm` reactivo, sin llamadas nuevas. */
  get valoracionActiva(): string {
    const esUtil = this.filterForm.value.esUtil;
    return esUtil === true ? 'util' : esUtil === false ? 'no-util' : 'todas';
  }

  get valoracionTabs(): FilterTabOption[] {
    const total = this.stats?.total ?? this.totalItems;
    const noUtil = this.stats?.totalNoUtil ?? 0;
    return [
      { value: 'todas', label: 'Todas', count: total },
      { value: 'util', label: 'Útil', count: Math.max(total - noUtil, 0) },
      { value: 'no-util', label: 'No útil', count: noUtil },
    ];
  }

  filtrarValoracion(value: string): void {
    const esUtil = value === 'util' ? true : value === 'no-util' ? false : '';
    this.filterForm.patchValue({ esUtil });
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
