import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
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
export class CategoriaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('CATEGORIA');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

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
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
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
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/categorias/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/categorias/lista']);
  }
}
