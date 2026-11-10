import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '@core/models/field.interface';
import { buildPermisoGroups, PermisoGroupVM } from '@core/utils/permiso-groups.util';
import { extractErrorMessage } from '@core/models/api-response.model';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { RolesFacade, RolFormValue, RoleScopeType } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { CONFLICTOS_ROL, FALLBACK_ROL } from '../role-save-error';

/** Campo `custom` de la config `ROL` que guarda los ids de los permisos otorgados. */
const CAMPO_PERMISOS = 'permissionsIds';

/**
 * Alta y edición de rol sobre `app-dynamic-form` (config `ROL`). Los campos simples los dibuja el
 * formulario; la grilla de permisos es propia de esta pantalla: va proyectada dentro del formulario
 * y escribe en el control `permissionsIds` del mismo `FormGroup`, para que otorgar o quitar un
 * permiso cuente como cambio (botón "Guardar" y aviso de cambios sin guardar).
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
    DynamicFormComponent,
  ],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly config: FormConfig = getFormConfig('ROL');
  isEdit = false;
  saving = false;
  loading = true;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  /**
   * La carga de datos falló. El formulario no se dibuja: con el catálogo de permisos vacío o el
   * rol sin leer, guardar habría pisado el rol con lo que hubiera en pantalla.
   */
  loadError = '';
  initialData: Record<string, unknown> | null = null;

  /** Ids de los permisos otorgados ahora: espejo del control `permissionsIds`, para pintar la grilla. */
  seleccion: string[] = [];
  /** Permisos agrupados por recurso para el multi-select de badges (mismo look que el detalle de Roles). */
  permisoGroups: PermisoGroupVM[] = [];

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private permisosDisponibles: PermisoVM[] = [];
  private editId: string | null = null;

  constructor(
    private facade: RolesFacade,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    void this.cargar();
  }

  /**
   * Permisos disponibles + rol en edición, en una sola llamada (también es el "Reintentar" del
   * estado de error). Con `catch`: un fallo de la API no puede dejar el formulario vacío y en silencio.
   * `unaVez`: si la pantalla se destruye antes, el request se cancela y no hay nada que mostrar;
   * cualquier otro rechazo apaga `loading` y deja el motivo.
   */
  async cargar(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();

    try {
      const { permisos, rol } = await unaVez(this.facade.getFormData(this.editId), this.destroyRef);
      this.permisosDisponibles = permisos;
      if (rol) {
        this.seleccion = rol.permisos.map((p) => p.id);
        // Llega antes de que exista el formulario: nace precargado y pristine, así que en
        // edición "Guardar" arranca deshabilitado.
        this.initialData = {
          codigo:               rol.codigo,
          descripcion:          rol.descripcion,
          scopeTipo:            rol.scopeTipo,
          asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
          asignablePorBackoffice: rol.asignablePorBackoffice,
          // El estado real del rol: fijarlo en `true` reactivaba en silencio un rol dado de baja.
          active:               rol.activo,
          [CAMPO_PERMISOS]:     this.seleccion,
        };
      }
      this.refreshPermisoGroups();
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.loadError = extractErrorMessage((err as { error?: unknown })?.error)
        || (this.isEdit
          ? 'No pudimos cargar el rol ni sus permisos. Intentá de nuevo.'
          : 'No pudimos cargar el catálogo de permisos. Intentá de nuevo.');
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  /** Recalcula los grupos de badges de permisos contra la selección actual. */
  private refreshPermisoGroups(): void {
    this.permisoGroups = buildPermisoGroups(this.permisosDisponibles, new Set(this.seleccion));
  }

  /** Togglea un permiso (otorgado ↔ no otorgado) desde el multi-select de badges. */
  togglePermiso(permisoId: string): void {
    const control = this.dynamicForm?.form.get(CAMPO_PERMISOS);
    if (!control) return;

    this.seleccion = this.seleccion.includes(permisoId)
      ? this.seleccion.filter((id) => id !== permisoId)
      : [...this.seleccion, permisoId];
    control.setValue(this.seleccion);
    // `setValue` no ensucia el control: sin esto ni "Guardar" ni el guard verían el cambio.
    control.markAsDirty();
    this.refreshPermisoGroups();
  }

  async onSubmit(data: Record<string, unknown>): Promise<void> {
    this.saving = true;
    this.serverError = '';
    const formValue: RolFormValue = {
      codigo:               String(data['codigo'] ?? ''),
      descripcion:          String(data['descripcion'] ?? ''),
      scopeTipo:            data['scopeTipo'] as RoleScopeType,
      asignablePorOrgAdmin: data['asignablePorOrgAdmin'] === true,
      asignablePorBackoffice: data['asignablePorBackoffice'] === true,
      active:               data['active'] === true,
      permissionsIds:       (data[CAMPO_PERMISOS] as string[] | undefined) ?? [],
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    try {
      await unaVez(request$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.saving = false;
      this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_ROL, FALLBACK_ROL);
      this.cdr.markForCheck();
      return;
    }
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(this.isEdit ? 'Rol actualizado' : 'Rol creado correctamente', 'OK',
      { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/roles/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/roles/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de éxito
   * ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.dynamicForm?.form?.dirty;
  }
}
