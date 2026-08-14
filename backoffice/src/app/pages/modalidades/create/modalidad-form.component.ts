import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { extractErrorMessage } from '../../../core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { ModalidadesFacade, ModalidadFormValue } from '@features/modalidades';

@Component({
  selector: 'app-modalidad-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './modalidad-form.component.html',
  styleUrls: ['./modalidad-form.component.scss'],
})
export class ModalidadFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  config: FormConfig = getFormConfig('MODALIDAD');
  isEdit = false;
  saving = false;
  /** Motivo del último fallo de guardado (o de carga), para mostrarlo dentro del formulario. */
  serverError = '';
  initialData: Record<string, unknown> | null = null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: ModalidadesFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    if (!rawId) return;

    this.isEdit = true;
    this.editId = rawId;
    this.facade.getById(rawId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (modalidad) => {
          this.initialData = { nombre: modalidad.nombre };
          this.cdr.markForCheck();
        },
        // Sin esto el formulario quedaba vacío y en silencio: parecía un alta,
        // y guardar habría pisado la modalidad con lo que el usuario escribiera.
        error: (err: unknown) => {
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No pudimos cargar la modalidad. Volvé a la lista e intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';
    const form: ModalidadFormValue = { nombre: String(data['nombre'] ?? '') };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Modalidad actualizada' : 'Modalidad creada correctamente',
            'OK',
            // Variante del design system (fondo #1A1A2E) — Kitchen Sink §07.
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.router.navigate(['/dashboard/modalidades/lista']);
        },
        // Antes solo apagaba `saving`: el botón volvía a su estado normal y no
        // aparecía nada, así que un guardado fallido era indistinguible de uno bueno.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar la modalidad. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/modalidades/lista']);
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
