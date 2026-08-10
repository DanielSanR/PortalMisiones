import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { EtiquetasFacade, EtiquetaFormValue } from '@features/etiquetas';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-etiqueta-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './etiqueta-form.component.html',
})
export class EtiquetaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('ETIQUETA');
  isEdit = false;
  saving = false;
  initialData: Record<string, any> | null = null;

  private editId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: EtiquetasFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    if (rawId) {
      this.isEdit = true;
      this.editId = Number(rawId);
      this.facade.getById(this.editId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (etiqueta) => {
            this.initialData = {
              nombre: etiqueta.nombre,
              icono: etiqueta.icono,
              color: etiqueta.color,
            };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: EtiquetaFormValue): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, data)
      : this.facade.create(data);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Etiqueta actualizada' : 'Etiqueta creada',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/etiquetas/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/etiquetas/lista']);
  }
}
