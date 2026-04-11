import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { OrganismoService } from '../../../core/services/organismo.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-organismo-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './organismo-form.component.html', 
})
export class OrganismoFormComponent implements OnInit {
  config: FormConfig = getFormConfig('ORGANISMO');
  isEdit = false;
  saving = false;
  initialData: any = null;

  private editId: string | null = null;

  constructor(
    private organismoService: OrganismoService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.organismoService.getAll().subscribe({
      next: (response) => {
        this.config = updateFormConfigOptions(this.config, 'parentId', [
          { id: '', name: 'Ninguno (raíz)' },
          ...response.data.map(o => ({ id: o.id, name: o.nombre })),
        ]);
      },
    });

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEdit = true;
      this.editId = id;
      this.organismoService.getById(id).subscribe({
        next: (org) => {
          this.initialData = {
            nombre: org.nombre,
            sigla: org.sigla,
            sitioWeb: org.sitioWeb,
            logoUrl: org.logoUrl,
            parentId: org.parentId || '',
          };
        },
      });
    }
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.organismoService.update(this.editId!, data)
      : this.organismoService.create(data);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Organismo actualizado' : 'Organismo creado',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/dashboard/organismos/lista']);
      },
      error: () => { this.saving = false; },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/organismos/lista']);
  }
}
