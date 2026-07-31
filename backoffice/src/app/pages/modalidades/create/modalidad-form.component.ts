import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { ModalidadesFacade, ModalidadFormValue } from '@features/modalidades';

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
  styleUrls: ['./modalidad-form.component.scss'],
})
export class ModalidadFormComponent implements OnInit {
  config: FormConfig = getFormConfig('MODALIDAD');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: ModalidadesFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    if (rawId) {
      this.isEdit = true;
      this.editId = rawId;
      this.facade.getById(rawId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (modalidad) => {
            this.initialData = { nombre: modalidad.nombre };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    const form: ModalidadFormValue = { nombre: String(data['nombre'] ?? '') };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

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
