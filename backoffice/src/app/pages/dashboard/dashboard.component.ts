import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../shared/components/table';
import { ChartConfiguration, ChartData } from 'chart.js';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AccionLabelPipe } from '../../shared/pipes/accion-label.pipe';
import { DashboardService } from '../../core/services/dashboard.service';
import {
  DashboardMetrics,
  TopTramite,
  TopBusqueda,
  AuditoriaTramite,
  TramitesPorOrganismo,
} from '../../core/models/dashboard.model';

interface MetricCard {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  suffix?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    SharedTableComponent,
    TableCellDirective,
    PageHeaderComponent,
    AccionLabelPipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  metrics!: DashboardMetrics;
  metricCards: MetricCard[] = [];
  topTramites: TopTramite[] = [];
  topBusquedas: TopBusqueda[] = [];
  actividadReciente: AuditoriaTramite[] = [];
  tramitesPorOrganismo: TramitesPorOrganismo[] = [];

  topTramitesColumns: TableColumn<TopTramite>[] = [
    { key: 'titulo',    label: 'Trámite' },
    { key: 'consultas', label: 'Consultas', width: '100px' },
  ];

  topBusquedasColumns: TableColumn<TopBusqueda>[] = [
    { key: 'termino',       label: 'Término' },
    { key: 'cantidad',      label: 'Cantidad',       width: '90px' },
    { key: 'sinResultados', label: 'Sin resultados', width: '130px' },
  ];

  // ── Donut chart — distribución por estado ─────────────
  doughnutData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed} trámites`,
        },
      },
    },
  };

  // ── Bar chart — trámites por organismo ────────────────
  barData: ChartData<'bar'> = { labels: [], datasets: [] };
  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.x} trámite${ctx.parsed.x !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: '#F3F4F6' },
        border: { display: false },
      },
      y: {
        ticks: { font: { size: 12 } },
        grid: { display: false },
        border: { display: false },
      },
    },
  };

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadData();
  }

  getAccionBgColor(accion: AuditoriaTramite['accion']): string {
    const colorMap: Record<string, string> = {
      crear:           '#4CAF5018',
      editar:          '#2196F318',
      publicar:        '#1B5E2018',
      despublicar:     '#F4433618',
      enviar_revision: '#FF980018',
      eliminar:        '#B71C1C18',
    };
    return colorMap[accion] ?? '#60708B18';
  }

  private loadData(): void {
    this.dashboardService.getMetrics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metrics) => {
          this.metrics = metrics;
          this.buildMetricCards(metrics);
          this.buildDoughnutChart(metrics);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });

    this.dashboardService.getTopTramites()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.topTramites = data;
          this.cdr.markForCheck();
        },
      });

    this.dashboardService.getTopBusquedas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.topBusquedas = data;
          this.cdr.markForCheck();
        },
      });

    this.dashboardService.getAuditoria(1, 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.actividadReciente = data.slice(0, 5);
          this.cdr.markForCheck();
        },
      });

    this.dashboardService.getTramitesPorOrganismo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.tramitesPorOrganismo = data;
          this.buildBarChart(data);
          this.cdr.markForCheck();
        },
      });
  }

  private buildMetricCards(metrics: DashboardMetrics): void {
    this.metricCards = [
      { label: 'Total trámites', value: metrics.totalTramites,          icon: 'description', color: '#2F6EB1' },
      { label: 'Publicados',     value: metrics.tramitesPublicados,      icon: 'check_circle', color: '#16A34A' },
      { label: 'En borrador',    value: metrics.tramitesBorrador,        icon: 'edit_note',    color: '#F59E0B' },
      { label: 'En revisión',    value: metrics.tramitesRevision,        icon: 'rate_review',  color: '#3B82F6' },
      { label: 'Organismos',     value: metrics.totalOrganismos,         icon: 'business',     color: '#6366F1' },
      { label: 'Búsquedas hoy',  value: metrics.busquedasHoy,           icon: 'search',       color: '#9C27B0' },
      { label: 'Sin resultados', value: metrics.busquedasSinResultado,   icon: 'search_off',   color: '#F44336' },
      { label: 'Satisfacción',   value: metrics.satisfaccionPromedio.toFixed(1), icon: 'star', color: '#F59E0B', suffix: '/ 5' },
    ];
  }

  private buildDoughnutChart(metrics: DashboardMetrics): void {
    this.doughnutData = {
      labels: ['Publicados', 'Borrador', 'Revisión', 'Despublicados'],
      datasets: [{
        data: [
          metrics.tramitesPublicados,
          metrics.tramitesBorrador,
          metrics.tramitesRevision,
          metrics.tramitesDespublicados,
        ],
        backgroundColor:      ['#16A34A', '#F59E0B', '#3B82F6', '#9CA3AF'],
        hoverBackgroundColor: ['#15803D', '#D97706', '#2563EB', '#6B7280'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    };
  }

  private buildBarChart(data: TramitesPorOrganismo[]): void {
    this.barData = {
      labels: data.map((o) => o.sigla),
      datasets: [{
        data:                data.map((o) => o.total),
        backgroundColor:     '#3B82F620',
        borderColor:         '#3B82F6',
        borderWidth:         2,
        borderRadius:        6,
        hoverBackgroundColor: '#3B82F640',
      }],
    };
  }
}
