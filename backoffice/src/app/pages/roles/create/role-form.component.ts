import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Observable, combineLatest, defer, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FormActionsComponent } from '../../../shared/components/form-actions/form-actions.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { FormErrorMessageDirective } from '../../../shared/components/dynamic-form-field/FormErrorMessage.directive';
import { getControlErrorMessage, resumenDeErrores } from '../../../shared/components/dynamic-form-field/form-error-messages.util';
import { ListSearchComponent } from '../../../shared/components/list-search/list-search.component';
import { FieldConfig } from '@core/models/field.interface';
import { buildPermisoGroups, PermisoChipVM } from '@core/utils/permiso-groups.util';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { RolesFacade, RolFormValue, RoleScopeType } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { CONFLICTOS_ROL, FALLBACK_ROL } from '../role-save-error';

/** Largo máximo de `code` y `description` en el backend. */
const MAX_CODIGO = 100;
const MAX_DESCRIPCION = 255;

const RUTA_LISTA_ROLES = '/dashboard/roles/lista';

/** Ayuda del select de alcance, según el valor elegido. */
const AYUDA_ALCANCE: Record<RoleScopeType, string> = {
  global: 'Vale para todo el backoffice.',
  organismo: 'Vale solo dentro del organismo del usuario.',
};

type CampoConResumen = 'codigo' | 'descripcion' | 'scopeTipo';

/**
 * Los campos que validan, descritos como los de `app-dynamic-form`: el mensaje de cada error sale de
 * `form-error-messages.util` (un solo lugar para el `<mat-error>` del campo y el banner resumen).
 */
const CAMPOS: Record<CampoConResumen, FieldConfig> = {
  codigo: { name: 'codigo', label: 'Código', type: 'text', validations: { maxLength: MAX_CODIGO } },
  descripcion: { name: 'descripcion', label: 'Descripción', type: 'text', validations: { maxLength: MAX_DESCRIPCION } },
  scopeTipo: { name: 'scopeTipo', label: 'Alcance', type: 'select' },
};

type CampoDelForm = keyof RoleFormComponent['form']['controls'];

/** Un grupo de permisos tal como lo dibuja el panel: chips ya filtrados por la búsqueda. */
export interface GrupoPermisosVista {
  key: string;
  label: string;
  granted: number;
  total: number;
  /** Todos los permisos visibles del grupo están otorgados: el botón pasa a "Quitar". */
  todos: boolean;
  /** Ids de los permisos visibles: lo que alterna "Marcar todos" (con búsqueda, solo los que coinciden). */
  ids: string[];
  /** Solo los que coinciden con la búsqueda, en el orden del catálogo. */
  items: PermisoChipVM[];
  /** Texto del botón del grupo ("Marcar todos", o "Marcar los 3 visibles" con búsqueda). */
  etiquetaTodos: string;
  /** `aria-label` del botón del grupo, con el nombre del grupo. */
  ariaTodos: string;
}

/** Textos del botón "Marcar/Quitar" de un grupo: con búsqueda activa dicen que actúan solo sobre los visibles. */
function etiquetasDeGrupo(todos: boolean, filtrado: boolean, visibles: number, grupo: string):
  Pick<GrupoPermisosVista, 'etiquetaTodos' | 'ariaTodos'> {
  const accion = todos ? 'Quitar' : 'Marcar';
  if (!filtrado) {
    return { etiquetaTodos: `${accion} todos`, ariaTodos: `${accion} todos los permisos de ${grupo}` };
  }
  return visibles === 1
    ? { etiquetaTodos: `${accion} el visible`, ariaTodos: `${accion} el permiso visible de ${grupo}` }
    : {
      etiquetaTodos: `${accion} los ${visibles} visibles`,
      ariaTodos: `${accion} los ${visibles} permisos visibles de ${grupo}`,
    };
}

/** Lo que el membrete, el panel de permisos y el pie derivan del form en vivo. */
export interface VistaRol {
  titulo: string;
  codigo: string;
  codigoLongitud: number;
  activo: boolean;
  alcance: string;
  alcanceAyuda: string;
  /** Permisos otorgados y total del catálogo. */
  otorgados: number;
  total: number;
  grupos: GrupoPermisosVista[];
  /** Hay búsqueda y ningún permiso coincide. */
  sinCoincidencias: boolean;
}

/**
 * Mayúsculas y sin espacios (cada hueco pasa a `_`): el formato de los códigos de rol. El largo puede
 * crecer: `toUpperCase` pasa `ß` a `SS`.
 */
export function normalizarCodigoRol(valor: string): string {
  return valor.toUpperCase().replace(/\s/g, '_');
}

/**
 * El código tal como viaja al backend y se ve en el membrete: normalizado y sin `_` en los extremos
 * (escribir "editor " deja un `_` de relleno que no es parte del código).
 */
export function codigoRolFinal(valor: string): string {
  return normalizarCodigoRol(valor).replace(/^_+|_+$/g, '');
}

/** Un código que queda vacío tras limpiarlo (solo espacios o guiones bajos) cuenta como no escrito. */
const codigoRolObligatorio: ValidatorFn = (control) => (codigoRolFinal(control.value ?? '') ? null : { required: true });

/** Minúsculas y sin tildes, para que "publicacion" encuentre "Publicación". */
function paraBuscar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Alta y edición de rol. Formulario reactivo propio (no `app-dynamic-form`): una sola tarjeta con dos
 * paneles (datos | permisos) y el pie de guardar compartido, igual que Plantilla provincial. Los
 * permisos son el control `permissionsIds` del mismo `FormGroup`: otorgar o quitar uno ensucia el form
 * (botón "Guardar" y aviso de cambios sin guardar).
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    FormActionsComponent,
    FormErrorBannerComponent,
    FormErrorMessageDirective,
    ListSearchComponent,
    LoadingComponent,
  ],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly facade = inject(RolesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly maxCodigo = MAX_CODIGO;
  readonly maxDescripcion = MAX_DESCRIPCION;
  readonly campos = CAMPOS;

  readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [codigoRolObligatorio, Validators.maxLength(MAX_CODIGO)] }),
    descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(MAX_DESCRIPCION)] }),
    scopeTipo: new FormControl<RoleScopeType>('global', { nonNullable: true, validators: Validators.required }),
    asignablePorOrgAdmin: new FormControl(false, { nonNullable: true }),
    asignablePorBackoffice: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    permissionsIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  /** Buscador del panel de permisos. Fuera del `FormGroup`: escribir ahí no es un cambio del rol. */
  readonly busqueda = new FormControl('', { nonNullable: true });

  isEdit = false;
  saving = false;
  loading = true;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  /**
   * La carga de datos falló. El formulario no se dibuja: con el catálogo de permisos vacío o el
   * rol sin leer, guardar habría pisado el rol con lo que hubiera en pantalla.
   */
  loadError = '';

  private permisosDisponibles: PermisoVM[] = [];
  private editId: string | null = null;

  /** El form y la búsqueda en vivo, resumidos para la pantalla: membrete, panel de permisos y pie. */
  readonly vista$: Observable<VistaRol> = defer(() =>
    combineLatest([
      this.form.valueChanges.pipe(startWith(null)),
      this.busqueda.valueChanges.pipe(startWith('')),
    ]).pipe(map(() => this.armarVista())),
  );

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;

    // El banner "No se pudo guardar" habla del intento anterior: al corregir el código (el campo que
    // el backend rechaza) deja de ser cierto, igual que el error del propio campo.
    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.serverError) return;
        this.serverError = '';
        this.cdr.markForCheck();
      });

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
        // Llega antes de que se dibuje el formulario: `reset` lo deja precargado y pristine, así que
        // en edición "Guardar" arranca deshabilitado.
        this.form.reset({
          codigo: rol.codigo,
          descripcion: rol.descripcion,
          scopeTipo: rol.scopeTipo,
          asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
          asignablePorBackoffice: rol.asignablePorBackoffice,
          // El estado real del rol: fijarlo en `true` reactivaba en silencio un rol dado de baja.
          active: rol.activo,
          permissionsIds: rol.permisos.map((p) => p.id),
        });
      }
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.loadError = textoDeErrorHttp(
        err,
        this.isEdit
          ? 'No pudimos cargar el rol ni sus permisos. Intentá de nuevo.'
          : 'No pudimos cargar el catálogo de permisos. Intentá de nuevo.',
        { contexto: 'accion' },
      );
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  /**
   * Pasa el código a mayúsculas y sin espacios mientras se escribe, dejando el cursor junto al mismo
   * carácter (si el texto crece, p. ej. `ß` → `SS`, el cursor avanza lo mismo). No toca el valor
   * mientras un IME compone: se normaliza al terminar (`compositionend`, que no trae `isComposing`).
   * El `dirty` lo pone el propio `input` (value accessor).
   */
  normalizarCodigo(evento: Event): void {
    if ((evento as InputEvent).isComposing) return;
    const input = evento.target as HTMLInputElement;
    const normalizado = normalizarCodigoRol(input.value);
    if (normalizado === input.value) return;
    const cursor = normalizarCodigoRol(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    input.value = normalizado;
    input.setSelectionRange(cursor, cursor);
    this.form.controls.codigo.setValue(normalizado);
  }

  /** Otorga o quita un permiso (el orden de los chips no cambia: sale del catálogo). */
  alternarPermiso(permisoId: string): void {
    const actual = this.form.controls.permissionsIds.value;
    this.setPermisos(actual.includes(permisoId) ? actual.filter((id) => id !== permisoId) : [...actual, permisoId]);
  }

  /** "Marcar todos" / "Quitar todos" del grupo; con búsqueda activa, solo los permisos visibles. */
  alternarGrupo(grupo: GrupoPermisosVista): void {
    const actual = this.form.controls.permissionsIds.value;
    this.setPermisos(grupo.todos
      ? actual.filter((id) => !grupo.ids.includes(id))
      : [...actual, ...grupo.ids.filter((id) => !actual.includes(id))]);
  }

  /** `setValue` no ensucia el control: sin `markAsDirty` ni "Guardar" ni el guard verían el cambio. */
  private setPermisos(ids: string[]): void {
    const control = this.form.controls.permissionsIds;
    control.setValue(ids);
    control.markAsDirty();
  }

  /** En edición, "Guardar" queda deshabilitado hasta que haya algo que guardar. */
  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  async onSubmit(): Promise<void> {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    const valor = this.form.getRawValue();
    const formValue: RolFormValue = {
      codigo: codigoRolFinal(valor.codigo),
      descripcion: valor.descripcion,
      scopeTipo: valor.scopeTipo,
      asignablePorOrgAdmin: valor.asignablePorOrgAdmin,
      asignablePorBackoffice: valor.asignablePorBackoffice,
      active: valor.active,
      permissionsIds: valor.permissionsIds,
    };

    const request$ = this.isEdit
      ? this.facade.update(this.editId!, formValue)
      : this.facade.create(formValue);

    try {
      await unaVez(request$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.saving = false;
      this.serverError = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_ROL, FALLBACK_ROL);
      this.cdr.markForCheck();
      return;
    }
    // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
    this.snackBar.open(this.isEdit ? 'Rol actualizado' : 'Rol creado correctamente', 'OK',
      { duration: 3000, panelClass: 'snackbar-success' });
    // Si la navegación no ocurre, una edición vuelve a quedar disponible; un alta NO (el rol ya se creó:
    // habilitar "Crear" de nuevo lo duplicaría) y se le dice al usuario dónde encontrarlo.
    let navego: boolean | undefined;
    try {
      navego = await this.router.navigate([RUTA_LISTA_ROLES]);
    } catch {
      navego = false;
    }
    if (navego !== false) return;
    if (this.isEdit) {
      this.saving = false;
      this.form.markAsPristine();
    } else {
      this.snackBar.open('El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.', 'OK', {
        duration: 8000, panelClass: 'snackbar-warning',
      });
    }
    this.cdr.markForCheck();
  }

  goBack(): void {
    this.router.navigate([RUTA_LISTA_ROLES]);
  }

  campoInvalido(nombre: CampoDelForm): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    return resumenDeErrores(this.form, Object.values(CAMPOS), (control, campo) => getControlErrorMessage(control, campo));
  }

  private armarVista(): VistaRol {
    const v = this.form.getRawValue();
    const otorgadosIds = new Set(v.permissionsIds);
    const buscado = paraBuscar(this.busqueda.value);

    const todos = buildPermisoGroups(this.permisosDisponibles, otorgadosIds);
    const grupos: GrupoPermisosVista[] = todos
      .map((g): GrupoPermisosVista => {
        // Si coincide el nombre del grupo, se muestran todos sus permisos.
        const items = !buscado || paraBuscar(g.label).includes(buscado)
          ? g.items
          // También por código (`READ_USER`, o "user"): es como figura el permiso en el backend y en los logs.
          : g.items.filter((i) => paraBuscar(i.label).includes(buscado) || paraBuscar(i.codigo).includes(buscado));
        const todos = items.length > 0 && items.every((i) => i.granted);
        return {
          key: g.key,
          label: g.label,
          granted: g.granted,
          total: g.total,
          todos,
          ids: items.map((i) => i.id),
          items,
          ...etiquetasDeGrupo(todos, !!buscado, items.length, g.label),
        };
      })
      .filter((g) => g.items.length > 0);

    return {
      titulo: v.descripcion.trim(),
      codigo: codigoRolFinal(v.codigo),
      codigoLongitud: v.codigo.length,
      activo: v.active,
      alcance: v.scopeTipo === 'global' ? 'Alcance global' : 'Por organismo',
      alcanceAyuda: AYUDA_ALCANCE[v.scopeTipo] ?? '',
      otorgados: todos.reduce((n, g) => n + g.granted, 0),
      total: this.permisosDisponibles.length,
      grupos,
      sinCoincidencias: !!buscado && grupos.length === 0,
    };
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de éxito
   * ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && this.form.dirty;
  }
}
