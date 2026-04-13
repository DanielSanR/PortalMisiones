import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { ModalidadService } from '../../../core/services/modalidad.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-modalidad-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './modalidad-form.component.html',
})
export class ModalidadFormComponent implements OnInit {
  config: FormConfig = getFormConfig('MODALIDAD');
  isEdit = false;
  saving = false;
  initialData: any = null;

  private editId: number | null = null;

  constructor(
    private modalidadService: ModalidadService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.editId = Number(id);
      this.modalidadService.getById(this.editId).subscribe({
        next: (modalidad) => {
          this.initialData = {
            nombre: modalidad.nombre,
            descripcion: modalidad.descripcion,
            icono: modalidad.icono,
            color: modalidad.color,
          };
        },
      });
    }
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.modalidadService.update(this.editId!, data)
      : this.modalidadService.create(data);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Modalidad actualizada' : 'Modalidad creada',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/dashboard/modalidades/lista']);
      },
      error: () => { this.saving = false; },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/modalidades/lista']);
  }
}
