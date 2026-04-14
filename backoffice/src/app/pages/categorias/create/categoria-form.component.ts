import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { CategoriaService } from '../../../core/services/categoria.service';
import { CategoriaCreate } from '../../../core/models/tramite.model';
import { FormConfig } from '../../../core/models/field.interface';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';

@Component({
  selector: 'app-categoria-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './categoria-form.component.html',
})
export class CategoriaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('CATEGORIA');
  isEdit = false;
  saving = false;
  initialData: Record<string, any> | null = null;

  private editId: number | null = null;
  private parentId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private categoriaService: CategoriaService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.parentId = Number(this.route.snapshot.queryParams['parentId']) || null;
    const rawId = this.route.snapshot.params['id'];
    this.isEdit = !!rawId;
    this.editId = rawId ? Number(rawId) : null;

    const categorias$ = this.categoriaService.getAll();
    const editData$ = this.editId ? this.categoriaService.getById(this.editId) : of(null);
    // aca usamos fork por que etiquetas necesita datos padre ( cat raiz o cat nivel 1) 
    // entonces necesitamos cargar ambos datos antes de mostrar el formulario
    forkJoin({ categorias: categorias$, editData: editData$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categorias, editData }) => {
          const padreOptions = [
            { id: '', name: '— Ninguno (categoría raíz) —' },
            ...categorias.data.map(c => ({ id: c.id, name: c.nombre })),
          ];
          this.config = updateFormConfigOptions(this.config, 'parentId', padreOptions);

          if (editData) {
            this.initialData = {
              nombre: editData.nombre,
              descripcion: editData.descripcion,
              parentId: editData.parentId || '',
              icono: editData.icono,
              color: editData.color,
              orden: editData.orden,
            };
          } else if (this.parentId) {
            this.initialData = { parentId: this.parentId };
          }
          this.cdr.markForCheck();
        },
      });
  }
  onSubmit(data: any): void {
    this.saving = true;
    const payload: CategoriaCreate = {
      nombre: data.nombre,
      descripcion: data.descripcion || undefined,
      parentId: data.parentId || undefined,
      icono: data.icono || undefined,
      color: data.color || undefined,
      orden: data.orden ? Number(data.orden) : undefined,
    };

    const request$ = this.isEdit
      ? this.categoriaService.update(this.editId!, payload)
      : this.categoriaService.create(payload);

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
        error: () => { this.saving = false; },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/categorias/lista']);
  }
}
