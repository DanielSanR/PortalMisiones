import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { EstadoBadgePipe } from '../../../shared/pipes/estado-badge.pipe';
import { TramiteService } from '../../../core/services/tramite.service';
import { Tramite } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-tramite-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    PageHeaderComponent,
    LoadingComponent,
    EstadoBadgePipe,
  ],
  templateUrl: './tramite-detail.component.html',
  styleUrls: ['./tramite-detail.component.scss'],
})
export class TramiteDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  tramite: Tramite | null = null;
  loading = true;

  constructor(
    private tramiteService: TramiteService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.loading = false;
      this.router.navigate(['/dashboard/tramites/lista']);
      return;
    }

    this.tramiteService.getById(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (tramite) => {
        this.tramite = tramite;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onEdit(): void {
    this.router.navigate(['/dashboard/tramites/editar', this.tramite?.id]);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/tramites/lista']);
  }
}
