import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardMetrics, TopTramite, TopBusqueda } from '../../core/models/dashboard.model';

interface MetricCard {
  label: string;
  value: number;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  loading = true;
  metrics!: DashboardMetrics;
  metricCards: MetricCard[] = [];
  topTramites: TopTramite[] = [];
  topBusquedas: TopBusqueda[] = [];

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.dashboardService.getMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.metricCards = [
          { label: 'Total trámites', value: metrics.totalTramites, icon: 'description', color: '#2F6EB1' },
          { label: 'Publicados', value: metrics.tramitesPublicados, icon: 'check_circle', color: '#16A34A' },
          { label: 'En borrador', value: metrics.tramitesBorrador, icon: 'edit_note', color: '#FF9800' },
          { label: 'Organismos', value: metrics.totalOrganismos, icon: 'business', color: '#3B82C4' },
          { label: 'Búsquedas hoy', value: metrics.busquedasHoy, icon: 'search', color: '#9C27B0' },
          { label: 'Sin resultados', value: metrics.busquedasSinResultado, icon: 'search_off', color: '#F44336' },
        ];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    this.dashboardService.getTopTramites().subscribe({
      next: (data) => (this.topTramites = data),
    });

    this.dashboardService.getTopBusquedas().subscribe({
      next: (data) => (this.topBusquedas = data),
    });
  }
}
