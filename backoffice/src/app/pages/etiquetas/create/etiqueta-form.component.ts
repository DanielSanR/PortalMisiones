import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { extractErrorMessage } from '../../../core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { EtiquetasFacade, EtiquetaFormValue } from '@features/etiquetas';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA } from '../etiqueta-save-error';

@Component({
  selector: 'app-etiqueta-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './etiqueta-form.component.html',
  styleUrls: ['./etiqueta-form.component.scss'],
})
export class EtiquetaFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  config: FormConfig = getFormConfig('ETIQUETA');
  isEdit = false;
  saving = false;
  /** Motivo del último fallo de guardado (o de carga), para mostrarlo dentro del formulario. */
  serverError = '';
  initialData: Record<string, unknown> | null = null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  /** UUID de la etiqueta en edición (null en alta). */
  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: EtiquetasFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.facade.getFormData(this.editId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ etiqueta, organismos }) => {
          // '' = sin organismo ⇒ etiqueta global. Si el catálogo no se pudo leer (sin
          // `READ_ORGANISM`), queda solo esta opción y el form sigue sirviendo para globales.
          this.config = updateFormConfigOptions(this.config, 'organismoId', [
            { id: '', name: 'Ninguno — etiqueta global' },
            ...organismos.map((o) => ({ id: o.id, name: o.nombre })),
          ]);

          if (etiqueta) {
            this.initialData = { slug: etiqueta.slug, organismoId: etiqueta.organismoId ?? '' };
          }
          this.cdr.markForCheck();
        },
        // Sin esto el formulario quedaba vacío y en silencio: parecía un alta,
        // y guardar habría pisado la etiqueta con lo que el usuario escribiera.
        error: (err: unknown) => {
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No pudimos cargar la etiqueta. Volvé a la lista e intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';
    const form: EtiquetaFormValue = {
      slug: String(data['slug'] ?? ''),
      organismoId: (data['organismoId'] as string) || null,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Etiqueta actualizada' : 'Etiqueta creada correctamente',
            'OK',
            // Variante del design system (fondo #1A1A2E) — Kitchen Sink §07.
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.router.navigate(['/dashboard/etiquetas/lista']);
        },
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_ETIQUETA, FALLBACK_ETIQUETA);
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/etiquetas/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación
   * de éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.dynamicForm?.form?.dirty;
  }
}
