import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { DestinatariosFacade, DestinatarioFormValue } from '@features/destinatarios';

@Component({
  selector: 'app-destinatario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './destinatario-form.component.html',
  styleUrls: ['./destinatario-form.component.scss'],
})
export class DestinatarioFormComponent implements OnInit {
  config: FormConfig = getFormConfig('DESTINATARIO');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: DestinatariosFacade,
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
          next: (destinatario) => {
            this.initialData = { nombre: destinatario.nombre };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    const form: DestinatarioFormValue = { nombre: String(data['nombre'] ?? '') };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Destinatario actualizado' : 'Destinatario creado',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/destinatarios/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/destinatarios/lista']);
  }
}
