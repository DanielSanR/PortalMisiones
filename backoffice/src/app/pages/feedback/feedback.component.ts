import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SharedTableComponent, TableCellDirective, TableColumn, TablePageEvent } from '../../shared/components/table';
import { FeedbackService } from '../../core/services/feedback.service';
import { FeedbackTramite, FeedbackFilter, FeedbackStats } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-feedback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule,
    MatTooltipModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
  ],
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.scss'],
})
export class FeedbackComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  registros: FeedbackTramite[] = [];
  stats: FeedbackStats | null = null;
  loading = true;
  totalItems = 0;
  currentPage = 0;
  pageSize = 10;
  tramiteIdFijo: string | null = null;

  columns: TableColumn<FeedbackTramite>[] = [
    { key: 'util',       label: 'Valoración', width: '120px' },
    { key: 'tramite',    label: 'Trámite' },
    { key: 'comentario', label: 'Comentario' },
    { key: 'fecha',      label: 'Fecha',      width: '150px', hideOnMobile: true },
  ];

  filterForm: FormGroup;

  constructor(
    private feedbackService: FeedbackService,
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

    this.feedbackService.getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.cdr.markForCheck();
        },
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
    const v = this.filterForm.value;

    const filter: FeedbackFilter = {
      page: this.currentPage + 1,
      pageSize: this.pageSize,
      search: v.search || undefined,
      esUtil: v.esUtil !== '' && v.esUtil !== null ? v.esUtil : undefined,
      fechaDesde: v.fechaDesde ? this.toISODate(v.fechaDesde) : undefined,
      fechaHasta: v.fechaHasta ? this.toISODate(v.fechaHasta) : undefined,
      tramiteId: this.tramiteIdFijo ?? undefined,
    };

    this.feedbackService.getAll(filter)
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

  clearFilters(): void {
    this.filterForm.reset({ search: '', esUtil: '', fechaDesde: null, fechaHasta: null });
  }

  hasFilters(): boolean {
    const v = this.filterForm.value;
    return !!(v.search || v.esUtil !== '' || v.fechaDesde || v.fechaHasta);
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
