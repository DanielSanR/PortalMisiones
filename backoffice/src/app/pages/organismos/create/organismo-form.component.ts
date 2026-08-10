import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { OrganismosFacade, OrganismoFormValue } from '@features/organismos';

@Component({
  selector: 'app-organismo-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSnackBarModule,
    DynamicFormComponent,
  ],
  templateUrl: './organismo-form.component.html',
  styleUrls: ['./organismo-form.component.scss'],
})
export class OrganismoFormComponent implements OnInit {
  config: FormConfig = getFormConfig('ORGANISMO');
  isEdit = false;
  saving = false;
  initialData: Record<string, unknown> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private facade: OrganismosFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    this.facade.getFormData(this.editId ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tipos, localidades, organismos, organismo }) => {
          this.config = updateFormConfigOptions(this.config, 'typeId',
            tipos.map((t) => ({ id: t.id, name: t.nombre })));
          this.config = updateFormConfigOptions(this.config, 'parentId', [
            { id: '', name: 'Ninguno (raíz)' },
            ...organismos
              .filter((o) => o.id !== this.editId) // evita auto-referencia como padre
              .map((o) => ({ id: o.id, name: o.nombre })),
          ]);
          this.config = updateFormConfigOptions(this.config, 'baseLocationId', [
            { id: '', name: 'Sin localidad' },
            ...localidades.map((l) => ({ id: l.id, name: l.nombre })),
          ]);

          if (organismo) {
            this.initialData = {
              nombre: organismo.nombre,
              acronym: organismo.acronym,
              typeId: organismo.typeId,
              parentId: organismo.parentId ?? '',
              baseLocationId: organismo.baseLocationId ?? '',
              activo: organismo.activo,
            };
          }
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    const form: OrganismoFormValue = {
      typeId: String(data['typeId'] ?? ''),
      parentId: (data['parentId'] as string) || null,
      baseLocationId: (data['baseLocationId'] as string) || null,
      nombre: String(data['nombre'] ?? ''),
      acronym: String(data['acronym'] ?? ''),
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
            this.isEdit ? 'Organismo actualizado' : 'Organismo creado',
            'OK',
            { duration: 3000 },
          );
          this.router.navigate(['/dashboard/organismos/lista']);
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/organismos/lista']);
  }
}
