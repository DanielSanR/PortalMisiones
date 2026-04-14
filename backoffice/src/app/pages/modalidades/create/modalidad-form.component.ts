import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { ModalidadService } from '../../../core/services/modalidad.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-modalidad-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  initialData: Record<string, any> | null = null;

  private editId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private modalidadService: ModalidadService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    if (rawId) {
      this.isEdit = true;
      this.editId = Number(rawId);
      this.modalidadService.getById(this.editId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (modalidad) => {
            this.initialData = {
              nombre: modalidad.nombre,
              descripcion: modalidad.descripcion,
              icono: modalidad.icono,
              color: modalidad.color,
            };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.modalidadService.update(this.editId!, data)
      : this.modalidadService.create(data);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Modalidad actualizada' : 'Modalidad creada',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/modalidades/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/modalidades/lista']);
  }
}
