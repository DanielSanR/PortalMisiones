import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { EtiquetaService } from '../../../core/services/etiqueta.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-etiqueta-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './etiqueta-form.component.html',
})
export class EtiquetaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('ETIQUETA');
  isEdit = false;
  saving = false;
  initialData: any = null;

  private editId: number | null = null;

  constructor(
    private etiquetaService: EtiquetaService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.editId = Number(id);
      this.etiquetaService.getById(this.editId).subscribe({
        next: (etiqueta) => {
          this.initialData = {
            nombre: etiqueta.nombre,
            categoria: etiqueta.categoria,
            icono: etiqueta.icono,
            color: etiqueta.color,
          };
        },
      });
    }
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.etiquetaService.update(this.editId!, data)
      : this.etiquetaService.create(data);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Etiqueta actualizada' : 'Etiqueta creada',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/dashboard/etiquetas/lista']);
      },
      error: () => { this.saving = false; },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/etiquetas/lista']);
  }
}
