import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { CategoriaService } from '../../../core/services/categoria.service';
import { Categoria, CategoriaCreate } from '../../../core/models/tramite.model';
import { FieldConfig, FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-categoria-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './categoria-form.component.html',
})
export class CategoriaFormComponent implements OnInit {
  config!: FormConfig;
  isEdit = false;
  saving = false;
  initialData: any = null;

  private editId: number | null = null;
  private parentId: number | null = null;

  constructor(
    private categoriaService: CategoriaService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.parentId = Number(this.route.snapshot.queryParams['parentId']) || null;

    // Cargar categorías raíz para el select de "categoría padre"
    this.categoriaService.getAll().subscribe({
      next: (response) => {
        const padreOptions = [
          { id: '', name: '— Ninguno (categoría raíz) —' },
          ...response.data.map(c => ({ id: c.id, name: c.nombre })),
        ];
        this.config = this.buildFormConfig(padreOptions);
        this.loadEditData();
      },
    });
  }

  private loadEditData(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.editId = Number(id);
      this.categoriaService.getById(this.editId).subscribe({
        next: (categoria) => {
          this.initialData = {
            nombre: categoria.nombre,
            descripcion: categoria.descripcion,
            parentId: categoria.parentId || '',
            icono: categoria.icono,
            color: categoria.color,
            orden: categoria.orden,
          };
        },
      });
    } else if (this.parentId) {
      this.initialData = { parentId: this.parentId };
    }
  }

  private buildFormConfig(padreOptions: { id: any; name: string }[]): FormConfig {
    return {
      fields: [
        { name: '_section_datos', label: 'Datos de la categoría', type: 'section-header' },
        {
          name: 'nombre', label: 'Nombre', type: 'text',
          placeholder: 'Ej: Automotor, transporte y tránsito',
          cssClass: 'colspan-half',
          validations: { required: true, maxLength: 100 },
        },
        {
          name: 'parentId', label: 'Categoría padre', type: 'select',
          placeholder: 'Seleccione categoría padre',
          cssClass: 'colspan-half',
          hint: 'Dejar vacío para crear una categoría raíz (nivel 1)',
          options: padreOptions,
        },
        {
          name: 'descripcion', label: 'Descripción', type: 'textarea',
          placeholder: 'Descripción breve de la categoría',
          cssClass: 'colspan-full',
        },
        {
          name: 'orden', label: 'Orden', type: 'number',
          placeholder: '1',
          cssClass: 'colspan-half',
          hint: 'Orden de aparición (menor = primero)',
        },
        { name: '_section_visual', label: 'Apariencia', type: 'section-header' },
        {
          name: 'icono', label: 'Ícono', type: 'icon-picker',
          placeholder: 'Seleccione un ícono',
          cssClass: 'colspan-full',
        },
        {
          name: 'color', label: 'Color', type: 'text',
          placeholder: '#1565C0',
          hint: 'Color hexadecimal',
          cssClass: 'colspan-half',
        },
      ],
      submitButtonText: 'Crear categoría',
      cancelButtonText: 'Cancelar',
    };
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

    request$.subscribe({
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
