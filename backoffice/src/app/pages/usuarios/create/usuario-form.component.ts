import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FieldConfig } from '@core/models/field.interface';
import { extractErrorMessage } from '@core/models/api-response.model';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { UsuariosFacade, UsuarioFormValue } from '@features/usuarios';
import { OrganismoOption } from '@features/organismos';
import { RolVM } from '@features/roles';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole, ROLE_TO_SPANISH } from '@core/enums/user-role.enum';
import { CONFLICTOS_USUARIO, FALLBACK_USUARIO } from '../usuario-save-error';

type Opcion = { id: string; name: string };

/** Campos que solo existen en el alta: la contraseña y el estado inicial de la cuenta. */
const SOLO_ALTA = ['password', '_section_estado', 'activo'];

/**
 * Alta y edición de usuario sobre `app-dynamic-form` (config `USUARIO`). Lo propio de la pantalla:
 * - "Organismo" aparece (y es obligatorio) solo si el rol elegido es de scope `organismo`. Se decide
 *   con el `scopeTipo` del rol en el catálogo `/api/role/allowed`, no comparando códigos: en el alta
 *   el valor del select es el UUID del rol.
 * - Edición con una fuente que no la soporta (backend real): se avisa en vez de mostrar el form.
 * - Alta con "Activar la cuenta" en OFF: el backend crea la cuenta activa, así que se desactiva en un
 *   segundo paso. Si ese paso falla, el usuario YA existe: se avisa y se vuelve a la lista, en vez de
 *   dejar un formulario que al reintentar chocaría con su propio email.
 */
@Component({
  selector: 'app-usuario-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatSnackBarModule,
    LoadingComponent,
    FormErrorBannerComponent,
    DynamicFormComponent,
  ],
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.scss',
})
export class UsuarioFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Campos que se le entregan al formulario: la config `USUARIO` filtrada según modo y rol elegido. */
  fields: FieldConfig[] = [];
  initialData: Record<string, unknown> | null = null;
  isEdit = false;
  /** Edición pedida por URL con una fuente que no la soporta (backend sin endpoint): no se muestra el form. */
  edicionNoDisponible = false;
  saving = false;
  loading = true;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  /** La carga de organismos/roles falló: sin ellos el formulario no se puede completar. */
  loadError = '';

  readonly isSuperAdmin: boolean;
  readonly currentOrganismoId: string | null;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  private readonly baseFields: FieldConfig[] = getFormConfig('USUARIO').fields ?? [];
  // Roles para EDICIÓN (mock, por código de rol).
  private readonly rolesEdicion: Opcion[];
  /** Catálogo de roles asignables (`/api/role/allowed`): de acá sale el scope del rol elegido. */
  private rolesAllowed: RolVM[] = [];
  private organismos: OrganismoOption[] = [];
  /** Rol elegido ahora en el form: UUID en el alta, código en la edición (mock). */
  private rolActual = '';
  /**
   * Último organismo elegido (o el del usuario en edición). "Organismo" se quita del formulario con un
   * rol global y su control se destruye: al volver a un rol de organismo renace con este valor.
   */
  private ultimoOrganismoId = '';
  private editId: string | null = null;

  constructor(
    private facade: UsuariosFacade,
    private authTokenService: AuthTokenService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.isSuperAdmin = this.authTokenService.getUserRole() === UserRole.SUPERADMIN;
    this.currentOrganismoId = this.authTokenService.getUserOrganismoId();

    const opcion = (rol: UserRole): Opcion => ({ id: rol, name: ROLE_TO_SPANISH[rol] });
    this.rolesEdicion = this.isSuperAdmin
      ? [opcion(UserRole.SUPERADMIN), opcion(UserRole.ADMIN_ORGANIZATION), opcion(UserRole.AGENT)]
      : [opcion(UserRole.AGENT)];
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    void this.cargar();
  }

  /** Reintento del estado de error de carga. */
  reintentar(): void {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();

    // La lista no ofrece "Editar" en este caso; esto cubre la URL directa, para no dejar completar
    // un formulario que va a fallar al guardar.
    if (this.isEdit && !this.facade.edicionDisponible) {
      this.edicionNoDisponible = true;
      this.loadError = 'La edición de nombre, rol y organismo todavía no está disponible en el servidor.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      const { organismos, rolesAllowed, usuario } = await unaVez(this.facade.getFormData(this.editId), this.destroyRef);
      this.organismos = organismos;
      this.rolesAllowed = rolesAllowed;

      if (usuario) {
        // Llega antes de que exista el formulario: nace precargado y pristine, así que el guard
        // no pregunta al salir sin haber tocado nada y "Guardar" arranca deshabilitado.
        this.rolActual = usuario.rol ?? '';
        // El organismo no va en `initialData`: viaja como `value` del campo (ver `armarFields`), que
        // es lo que se usa cada vez que el control se vuelve a crear.
        this.ultimoOrganismoId = usuario.organismoId ?? '';
        this.initialData = {
          nombre:      usuario.nombre,
          apellido:    usuario.apellido,
          email:       usuario.email,
          rol:         this.rolActual,
        };
      }
      this.fields = this.armarFields();
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      // Antes era un `try/finally` sin `catch`: el formulario quedaba vacío y en
      // silencio, con el select de rol sin opciones, indistinguible de un alta normal.
      this.loadError = extractErrorMessage((err as { error?: unknown })?.error)
        || 'No pudimos cargar los datos del formulario. Revisá tu conexión e intentá de nuevo.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /** El usuario cambió algo: si fue el rol, "Organismo" aparece o desaparece. */
  onValueChanges(valor: Record<string, unknown>): void {
    // Solo mientras el campo existe: con un rol global no hay control y se conserva lo último elegido.
    if ('organismoId' in valor) this.ultimoOrganismoId = String(valor['organismoId'] ?? '');

    const rol = String(valor['rol'] ?? '');
    if (rol === this.rolActual) return;
    this.rolActual = rol;
    this.fields = this.armarFields();
  }

  /**
   * ¿El rol necesita organismo? Lo dice su `scopeTipo` en el catálogo. El rol se busca por UUID
   * (alta) o por código (edición mock); uno que no está en el catálogo —SUPERADMIN— es global.
   */
  private requiereOrganismo(rol: string): boolean {
    if (!rol) return false;
    return this.rolesAllowed.find((r) => r.id === rol || r.codigo === rol)?.scopeTipo === 'organismo';
  }

  /** La config `USUARIO` con lo que aplica a este modo y a este rol. Siempre objetos nuevos. */
  private armarFields(): FieldConfig[] {
    // CREATE → roles reales del backend (value = UUID). EDIT → roles por código (mock).
    const roles: Opcion[] = this.isEdit
      ? this.rolesEdicion
      : this.rolesAllowed.map((r) => ({ id: r.id, name: r.descripcion || r.codigo }));
    // Quien no es superadmin y tiene organismo solo puede crear usuarios en el suyo (el backend
    // lo pisa igual): se muestra elegido y bloqueado.
    const organismoFijo = !this.isEdit && !this.isSuperAdmin ? this.currentOrganismoId : null;

    return this.baseFields
      .filter((field) => !(this.isEdit && SOLO_ALTA.includes(field.name)))
      .filter((field) => field.name !== 'organismoId' || this.requiereOrganismo(this.rolActual))
      .map((field): FieldConfig => {
        switch (field.name) {
          case 'email':
            return this.isEdit ? { ...field, disabled: true, hint: 'El email no puede modificarse' } : { ...field };
          case 'rol':
            return { ...field, options: roles, optionsLoaded: true };
          case 'organismoId':
            return {
              ...field,
              options: this.organismos.map((o) => ({ id: o.id, name: o.nombre })),
              optionsLoaded: true,
              ...(organismoFijo ? { value: organismoFijo, disabled: true } : { value: this.ultimoOrganismoId }),
            };
          default:
            return { ...field };
        }
      });
  }

  async onSubmit(data: Record<string, unknown>): Promise<void> {
    this.saving = true;
    this.serverError = '';
    const rol = String(data['rol'] ?? '');
    // Solo un rol de scope `organismo` lleva organismo: el backend no rechaza un rol global con
    // organismo y dejaría la asignación atada a él. Dentro de ese caso, fallback para el
    // no-superadmin: el suyo (el backend lo pisa igual si es ADMIN_ORGANIZATION).
    const organismoId = this.requiereOrganismo(rol)
      ? String(data['organismoId'] ?? '') || (!this.isSuperAdmin ? this.currentOrganismoId : null) || null
      : null;
    const formValue: UsuarioFormValue = {
      nombre:      String(data['nombre'] ?? ''),
      apellido:    String(data['apellido'] ?? ''),
      email:       String(data['email'] ?? ''),
      password:    String(data['password'] ?? ''),
      rol,
      organismoId,
    };

    // `unaVez`: si la pantalla se destruye con el guardado en vuelo, el request se cancela y no hay
    // nada que mostrar ni a dónde navegar. Cualquier otro rechazo (también un stream que completa
    // vacío) es un fallo de guardado y tiene que liberar el formulario.
    let creadoId: string;
    try {
      if (this.isEdit) {
        await unaVez(this.facade.update(this.editId!, formValue), this.destroyRef);
        this.onSuccess('Usuario actualizado');
        return;
      }
      creadoId = (await unaVez(this.facade.create(formValue), this.destroyRef)).id;
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.saving = false;
      this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_USUARIO, FALLBACK_USUARIO);
      this.cdr.markForCheck();
      return;
    }

    // El backend crea el usuario con accountActive=true (§3). Con el toggle en ON ya está; en OFF se
    // desactiva en un segundo paso (PUT status-account). A partir de acá el alta YA ocurrió: un fallo
    // no es "no se pudo guardar" (reintentar daría 409 por el email), es una cuenta que quedó activa.
    if (data['activo'] !== true) {
      try {
        await unaVez(this.facade.setAccountStatus(creadoId, false), this.destroyRef);
      } catch (err: unknown) {
        if (esPantallaDestruida(err)) return;
        this.onSuccess('Usuario creado, pero no se pudo desactivar la cuenta. Desactivala desde la lista.', true);
        return;
      }
    }
    this.onSuccess('Usuario creado');
  }

  /** Aviso + vuelta a la lista. `conAdvertencia`: el alta quedó hecha pero a medias (más tiempo en pantalla). */
  private onSuccess(msg: string, conAdvertencia = false): void {
    // Variantes del design system (Kitchen Sink §07): éxito sobre #1A1A2E, advertencia aparte.
    this.snackBar.open(msg, 'OK', conAdvertencia
      ? { duration: 10000, panelClass: 'snackbar-warning' }
      : { duration: 3000, panelClass: 'snackbar-success' });
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/usuarios/lista']);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación
   * de éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && !!this.dynamicForm?.form?.dirty;
  }
}
