import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { extractErrorMessage } from '../../../core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { CategoriasFacade, CategoriaFormValue } from '@features/categorias';

@Component({
  selector: 'app-categoria-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './categoria-form.component.html',
  styleUrls: ['./categoria-form.component.scss'],
})
export class CategoriaFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  config: FormConfig = getFormConfig('CATEGORIA');
  isEdit = false;
  saving = false;
  /** Motivo del último fallo (carga o guardado), para mostrarlo dentro del formulario. */
  serverError = '';
  initialData: Record<string, unknown> | null = null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private editId: string | null = null;
  private parentId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: CategoriasFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.parentId = this.route.snapshot.queryParams['parentId'] ?? null;
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    const editData$ = this.editId ? this.facade.getById(this.editId) : of(null);

    // Se cargan las categorías (opciones de padre) + la categoría en edición antes de mostrar el form.
    forkJoin({ categorias: this.facade.loadCategorias(), editData: editData$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categorias, editData }) => {
          const padreOptions = [
            { id: '', name: '— Ninguno (categoría raíz) —' },
            ...categorias
              .filter((c) => c.id !== this.editId) // evita auto-referencia como padre
              .map((c) => ({ id: c.id, name: c.nombre })),
          ];
          this.config = updateFormConfigOptions(this.config, 'parentId', padreOptions);

          if (editData) {
            this.initialData = {
              nombre: editData.nombre,
              slug: editData.slug,
              parentId: editData.parentId ?? '',
            };
          } else if (this.parentId) {
            this.initialData = { parentId: this.parentId };
          }
          this.cdr.markForCheck();
        },
        // Sin esto el formulario quedaba vacío y en silencio: parecía un alta, y guardar
        // habría pisado la categoría con lo que el usuario escribiera. Además, si lo que
        // falló fue el listado, el select de padre quedaría sin opciones sin explicar por qué.
        error: (err: unknown) => {
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No pudimos cargar la categoría. Volvé a la lista e intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';
    const form: CategoriaFormValue = {
      nombre: String(data['nombre'] ?? ''),
      slug: String(data['slug'] ?? ''),
      parentId: (data['parentId'] as string) || null,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Categoría actualizada' : 'Categoría creada',
            'OK',
            // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.router.navigate(['/dashboard/categorias/lista']);
        },
        // Antes solo apagaba `saving`: el botón volvía a su estado normal y no aparecía
        // nada, así que un guardado fallido (slug duplicado, ciclo de padre) era
        // indistinguible de uno bueno.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar la categoría. Intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/categorias/lista']);
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
