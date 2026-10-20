import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { extractErrorMessage } from '../../../core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { DestinatariosFacade, DestinatarioFormValue } from '@features/destinatarios';

@Component({
  selector: 'app-destinatario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './destinatario-form.component.html',
  styleUrls: ['./destinatario-form.component.scss'],
})
export class DestinatarioFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  config: FormConfig = getFormConfig('DESTINATARIO');
  isEdit = false;
  saving = false;
  /** Motivo del último fallo (al cargar o al guardar), para mostrarlo dentro del formulario. */
  serverError = '';
  initialData: Record<string, unknown> | null = null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: DestinatariosFacade,
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
        next: (destinatario) => {
          this.initialData = { nombre: destinatario.nombre };
          this.cdr.markForCheck();
        },
        // Sin esto el formulario quedaba vacío y en silencio: parecía un alta,
        // y guardar habría pisado el destinatario con lo que el usuario escribiera.
        error: (err: unknown) => {
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No pudimos cargar el destinatario. Volvé a la lista e intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';
    const form: DestinatarioFormValue = { nombre: String(data['nombre'] ?? '') };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Destinatario actualizado' : 'Destinatario creado correctamente',
            'OK',
            // Variante del design system (fondo #1A1A2E) — Kitchen Sink §07.
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.router.navigate(['/dashboard/destinatarios/lista']);
        },
        // Antes solo apagaba `saving`: el botón volvía a su estado normal y no
        // aparecía nada, así que un guardado fallido era indistinguible de uno bueno.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el destinatario. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/destinatarios/lista']);
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
