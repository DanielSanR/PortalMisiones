import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { EventosDeVidaFacade, EventoDeVidaFormValue } from '@features/eventos-de-vida';

@Component({
  selector: 'app-evento-de-vida-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './evento-de-vida-form.component.html',
  styleUrls: ['./evento-de-vida-form.component.scss'],
})
export class EventoDeVidaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('EVENTO_DE_VIDA');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: EventosDeVidaFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    if (rawId) {
      this.isEdit = true;
      this.editId = rawId;
      this.facade.getById(rawId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (evento) => {
            this.initialData = { nombre: evento.nombre };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    const form: EventoDeVidaFormValue = {
      nombre: String(data['nombre'] ?? ''),
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

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
