import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { TiposOrganismoFacade, TipoOrganismoFormValue } from '@features/tipos-organismo';

@Component({
  selector: 'app-tipo-organismo-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './tipo-organismo-form.component.html',
  styleUrls: ['./tipo-organismo-form.component.scss'],
})
export class TipoOrganismoFormComponent implements OnInit {
  config: FormConfig = getFormConfig('TIPO_ORGANISMO');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: TiposOrganismoFacade,
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
          next: (tipo) => {
            this.initialData = { nombre: tipo.nombre, descripcion: tipo.descripcion, activo: tipo.activo };
            this.cdr.markForCheck();
          },
        });
    }
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    const form: TipoOrganismoFormValue = {
      nombre: String(data['nombre'] ?? ''),
      descripcion: String(data['descripcion'] ?? ''),
      activo: data['activo'] !== false,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, form)
      : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Tipo actualizado' : 'Tipo creado',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/tipos-organismo/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/tipos-organismo/lista']);
  }
}
