import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { EventoDeVidaService } from '../../../core/services/evento-de-vida.service';
import { TramiteService } from '../../../core/services/tramite.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-evento-de-vida-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './evento-de-vida-form.component.html',
})
export class EventoDeVidaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('EVENTO_DE_VIDA');
  isEdit = false;
  saving = false;
  initialData: Record<string, any> | null = null;

  private editId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private eventoService: EventoDeVidaService,
    private tramiteService: TramiteService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    this.isEdit = !!rawId;
    this.editId = rawId ? Number(rawId) : null;

    const tramites$ = this.tramiteService.getAll({ pageSize: 100 });
    const editData$ = this.isEdit && this.editId
      ? this.eventoService.getById(this.editId)
      : of(null);

    forkJoin({ tramites: tramites$, editData: editData$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tramites, editData }) => {
          const tramiteOptions = tramites.data.map(t => ({ id: t.id, name: t.titulo }));
          this.config = updateFormConfigOptions(this.config, 'tramiteIds', tramiteOptions);

          if (editData) {
            this.initialData = {
              nombre:      editData.nombre,
              descripcion: editData.descripcion,
              icono:       editData.icono,
              color:       editData.color,
              tramiteIds:  (editData.tramites ?? []).map(t => t.id),
            };
          }
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.eventoService.update(this.editId!, data)
      : this.eventoService.create(data);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Evento actualizado' : 'Evento creado',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/eventos-de-vida/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/eventos-de-vida/lista']);
  }
}
