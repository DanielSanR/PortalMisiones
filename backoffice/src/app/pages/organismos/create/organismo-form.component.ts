import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { OrganismoService } from '../../../core/services/organismo.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-organismo-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  initialData: Record<string, any> | null = null;

  private editId: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private organismoService: OrganismoService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.params['id'];
    this.isEdit = !!rawId;
    this.editId = rawId ?? null;

    const organismos$ = this.organismoService.getAll();
    const editData$ = this.editId ? this.organismoService.getById(this.editId) : of(null);

    forkJoin({ organismos: organismos$, editData: editData$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ organismos, editData }) => {
          this.config = updateFormConfigOptions(this.config, 'parentId', [
            { id: '', name: 'Ninguno (raíz)' },
            ...organismos.data.map(o => ({ id: o.id, name: o.nombre })),
          ]);

          if (editData) {
            this.initialData = {
              nombre: editData.nombre,
              sigla: editData.sigla,
              sitioWeb: editData.sitioWeb,
              logoUrl: editData.logoUrl,
              parentId: editData.parentId || '',
            };
          }
          this.cdr.markForCheck();
        },
      });
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.organismoService.update(this.editId!, data)
      : this.organismoService.create(data);

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
