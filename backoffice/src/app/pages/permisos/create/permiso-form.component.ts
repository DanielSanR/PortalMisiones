import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { PermisosFacade, PermisoFormValue } from '@features/permisos';

@Component({
  selector: 'app-permiso-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    PageHeaderComponent,
    LoadingComponent,
  ],
  templateUrl: './permiso-form.component.html',
  styleUrl: './permiso-form.component.scss',
})
export class PermisoFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  isEdit = false;
  saving = false;
  loading = true;

  private editId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private facade: PermisosFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.buildForm();

    if (this.isEdit && this.editId) {
      try {
        const permiso = await firstValueFrom(this.facade.getById(this.editId));
        this.form.patchValue({
          codigo: permiso.codigo,
          descripcion: permiso.descripcion,
        });
      } finally {
        this.loading = false;
        this.cdr.markForCheck();
      }
    } else {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      codigo:      ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.form.getRawValue();
    const formValue: PermisoFormValue = {
      codigo: raw.codigo,
      descripcion: raw.descripcion,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onSuccess(this.isEdit ? 'Permiso actualizado' : 'Permiso creado'),
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  private onSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000 });
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/permisos/lista']);
  }

  fieldError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
