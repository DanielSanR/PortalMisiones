import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '@core/models/field.interface';
import { extractErrorMessage } from '@core/models/api-response.model';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { PermisosFacade, PermisoFormValue } from '@features/permisos';
import { CONFLICTOS_PERMISO, FALLBACK_PERMISO } from '../permiso-save-error';

@Component({
  selector: 'app-permiso-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
    DynamicFormComponent,
  ],
  templateUrl: './permiso-form.component.html',
  styleUrl: './permiso-form.component.scss',
})
export class PermisoFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly config: FormConfig = getFormConfig('PERMISO');
  isEdit = false;
  saving = false;
  loading = true;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  /**
   * La carga del permiso falló. El formulario no se dibuja: vacío parecería un alta, y guardar
   * habría pisado el permiso con lo que el usuario escribiera.
   */
  loadError = '';
  initialData: Record<string, unknown> | null = null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private editId: string | null = null;

  constructor(
    private facade: PermisosFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    void this.cargar();
  }

  /**
   * Lee el permiso en edición (también es el "Reintentar" del estado de error). En alta no hay nada que leer.
   * `unaVez`: si la pantalla se destruye antes, el request se cancela y no hay nada que mostrar;
   * cualquier otro rechazo apaga `loading` y deja el motivo.
   */
  async cargar(): Promise<void> {
    this.loadError = '';
    if (!this.editId) {
      this.loading = false;
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    try {
      const permiso = await unaVez(this.facade.getById(this.editId), this.destroyRef);
      // Llega antes de que exista el formulario: nace precargado y pristine, así que en
      // edición "Guardar" queda deshabilitado hasta que haya un cambio real (`requireChanges`).
      this.initialData = { codigo: permiso.codigo, descripcion: permiso.descripcion };
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.loadError = extractErrorMessage((err as { error?: unknown })?.error)
        || 'Volvé a la lista e intentá de nuevo. Si sigue, avisá a Soporte.';
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  async onSubmit(data: Record<string, unknown>): Promise<void> {
    this.saving = true;
    this.serverError = '';
    const formValue: PermisoFormValue = {
      codigo: String(data['codigo'] ?? ''),
      descripcion: String(data['descripcion'] ?? ''),
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    try {
      await unaVez(request$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.saving = false;
      this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_PERMISO, FALLBACK_PERMISO);
      this.cdr.markForCheck();
      return;
    }
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(this.isEdit ? 'Permiso actualizado' : 'Permiso creado', 'OK',
      { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de
   * éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.dynamicForm?.form?.dirty;
  }
}
