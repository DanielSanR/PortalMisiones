import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { EstadoBadgePipe } from '../../../shared/pipes/estado-badge.pipe';
import { TramitePreviewComponent } from '../../../shared/components/tramite-preview/tramite-preview.component';
import { TramiteService } from '../../../core/services/tramite.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { Tramite } from '../../../core/models/tramite.model';
import { FeedbackTramite } from '../../../core/models/dashboard.model';

const FEEDBACK_PREVIEW_LIMIT = 5;

@Component({
  selector: 'app-tramite-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
    PageHeaderComponent,
    LoadingComponent,
    EstadoBadgePipe,
  ],
  templateUrl: './tramite-detail.component.html',
  styleUrls: ['./tramite-detail.component.scss'],
})
export class TramiteDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  tramite: Tramite | null = null;
  loading = true;

  feedbackItems: FeedbackTramite[] = [];
  feedbackTotal = 0;
  feedbackUtil = 0;
  readonly feedbackLimit = FEEDBACK_PREVIEW_LIMIT;

  get feedbackPorcentajeUtil(): number {
    return this.feedbackTotal > 0 ? Math.round((this.feedbackUtil / this.feedbackTotal) * 100) : 0;
  }

  constructor(
    private tramiteService: TramiteService,
    private feedbackService: FeedbackService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.loading = false;
      this.router.navigate(['/dashboard/tramites/lista']);
      return;
    }

    this.tramiteService.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tramite) => {
          this.tramite = tramite;
          this.loading = false;
          this.loadFeedback(tramite.id);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadFeedback(tramiteId: string): void {
    this.feedbackService.getAll({ tramiteId, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.feedbackTotal = response.total;
          this.feedbackUtil = response.data.filter(f => f.esUtil).length;
          this.feedbackItems = response.data.slice(0, FEEDBACK_PREVIEW_LIMIT);
          this.cdr.markForCheck();
        },
      });
  }

  goToFeedback(): void {
    this.router.navigate(['/dashboard/feedback'], {
      queryParams: { tramiteId: this.tramite?.id },
    });
  }

  onPreview(): void {
    console.log("deshabilitado temporalmente");
 /*    if (this.tramite) {
      this.dialog.open(TramitePreviewComponent, {
        data: this.tramite,
        width: '95vw',
        maxWidth: '1100px',
        maxHeight: '90vh',
        panelClass: 'preview-dialog-panel',
      });
    } */
  }

  onEdit(): void {
    this.router.navigate(['/dashboard/tramites/editar', this.tramite?.id]);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/tramites/lista']);
  }
}
