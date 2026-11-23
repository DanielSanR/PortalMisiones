import { Observable, catchError, defaultIfEmpty, map, of, switchMap, throwError } from 'rxjs';
import { FieldConfig } from '@core/models/field.interface';
import { textoDeErrorHttp } from '@core/utils/http-error-text.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { UserRole, ROLE_TO_SPANISH } from '@core/enums/user-role.enum';
import { UsuariosFacade, UsuarioFormValue, UsuarioOrganismoFijo, UsuarioVM } from '@features/usuarios';
import { OrganismoOption } from '@features/organismos';
import { RolVM } from '@features/roles';
import { FormDialogData, FormDialogErrorCarga } from '@shared/components/form-dialog';
import { CONFLICTOS_EDICION_USUARIO, FALLBACK_USUARIO, conflictosDeAltaUsuario } from './usuario-save-error';

type Opcion = { id: string; name: string };

/** Lo que devuelve el diálogo al guardar (`afterClosed()`); `undefined` si se cerró sin guardar. */
export interface UsuarioGuardado {
  usuario: UsuarioVM;
  /**
   * Solo en un alta con "Activar la cuenta" en OFF: el usuario YA existe pero no se pudo dejar la cuenta
   * inactiva (el backend la crea activa). La lista lo avisa aparte del éxito.
   */
  desactivacionFallida: boolean;
}

/**
 * Quién abre el diálogo: de eso depende qué roles se le ofrecen en la edición. El organismo de la sesión
 * ya no viaja acá: lo entrega el facade junto con los datos del form (`UsuarioFormData.organismoFijo`).
 */
export interface SesionDeUsuarioDialogo {
  esSuperAdmin: boolean;
}

/**
 * Campos base del formulario de usuario, nuevos en cada llamada (`armarFields` los adapta sin tocar una copia
 * compartida). Backend real (`CreateUserRequest`): email 5–50, password 8–20, role (UUID), organizationId? y
 * profileDto {firstName, lastName}. `armarFields` quita lo que no aplica: contraseña y estado en edición, y
 * `organismoId` cuando el rol elegido no es de scope `organismo`.
 */
function camposBaseDeUsuario(): FieldConfig[] {
  return [
  { name: '_section_datos', label: 'Datos personales', type: 'section-header' },
  {
    name: 'nombre',
    label: 'Nombre',
    type: 'text',
    placeholder: 'Ej: María',
    cssClass: 'colspan-half',
    validations: { required: true, maxLength: 100 },
  },
  {
    name: 'apellido',
    label: 'Apellido',
    type: 'text',
    placeholder: 'Ej: González',
    cssClass: 'colspan-half',
    validations: { required: true, maxLength: 100 },
  },

  { name: '_section_acceso', label: 'Acceso', type: 'section-header' },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'usuario@misiones.gob.ar',
    cssClass: 'colspan-half',
    validations: { required: true, email: true, maxLength: 50 },
  },
  {
    name: 'password',
    label: 'Contraseña',
    type: 'password',
    placeholder: 'Entre 8 y 20 caracteres',
    cssClass: 'colspan-half',
    validations: { required: true, minLength: 8, maxLength: 20 },
  },

  { name: '_section_rol', label: 'Rol y ubicación', type: 'section-header' },
  {
    name: 'rol',
    label: 'Rol',
    type: 'select',
    placeholder: 'Seleccioná un rol',
    hint: 'Define qué puede ver y hacer dentro del backoffice',
    // Ancho completo: Organismo solo aparece con algunos roles, y a media fila Rol quedaba con un hueco al lado.
    cssClass: 'colspan-full',
    validations: { required: true },
    options: [],
    emptyOptionsMessage: 'No hay roles que puedas asignar.',
  },
  {
    name: 'organismoId',
    label: 'Organismo',
    type: 'select',
    placeholder: 'Seleccioná un organismo',
    hint: 'Obligatorio para este rol: sus permisos valen dentro de un organismo',
    cssClass: 'colspan-full',
    validations: { required: true },
    options: [],
    emptyOptionsMessage: 'No hay organismos activos. Creá uno primero en Organismos.',
  },

  { name: '_section_estado', label: 'Estado', type: 'section-header' },
  {
    name: 'activo',
    label: 'Activar la cuenta al crear',
    type: 'checkbox',
    value: false,
  },
  ];
}

/** Campos que solo existen en el alta: la contraseña y el estado inicial de la cuenta. */
const SOLO_ALTA = ['password', '_section_estado', 'activo'];

const EDICION_NO_DISPONIBLE_TEXTO = 'La edición de nombre, rol y organismo todavía no está disponible en el servidor.';
/** Marca interna de "no hay formulario que mostrar": `errorDeCarga` la distingue de un fallo de red. */
const EDICION_NO_DISPONIBLE = Symbol('edicion-no-disponible');

function errorDeCarga(err: unknown): FormDialogErrorCarga {
  if (err === EDICION_NO_DISPONIBLE) {
    return {
      titulo: 'Edición no disponible',
      texto: EDICION_NO_DISPONIBLE_TEXTO,
      ayuda: 'Desde la lista podés cambiar el email, la contraseña o el estado de la cuenta.',
      reintentable: false,
    };
  }
  return {
    titulo: 'No pudimos cargar el formulario',
    // Sin esto el formulario quedaría vacío y en silencio, indistinguible de un alta normal.
    texto: textoDeErrorHttp(err, 'No pudimos cargar los datos del formulario. Intentá de nuevo.', { contexto: 'accion' }),
    reintentable: true,
  };
}

/**
 * Configuración del diálogo de alta/edición de usuario (`FormDialogComponent`), sobre `app-dynamic-form`
 * (config `USUARIO`). `usuarioId` null = alta. Lo propio de usuarios:
 * - "Organismo" aparece (y es obligatorio) solo si el rol elegido es de scope `organismo`, según el
 *   `scopeTipo` del catálogo `/api/role/allowed` (en el alta el valor del select es el UUID del rol).
 * - Si quien crea tiene alcance de organismo (`/api/auth/me`, G-2), "Organismo" viene con el suyo como dato
 *   de solo lectura (`FieldConfig.readonly`: enfocable, con el motivo asociado); la opción sale de la sesión,
 *   sin `GET /api/organism`.
 * - Edición con una fuente que no la soporta (backend real): se avisa en vez de mostrar el form.
 * - Alta con "Activar la cuenta" en OFF: el backend crea la cuenta activa, así que se desactiva en un
 *   segundo paso. Si ese paso falla, el usuario YA existe: se devuelve `desactivacionFallida` en vez de
 *   dejar un formulario que al reintentar chocaría con su propio email.
 */
export function dialogoDeUsuario(
  facade: UsuariosFacade,
  usuarioId: string | null,
  sesion: SesionDeUsuarioDialogo,
): FormDialogData<UsuarioGuardado> {
  const esEdicion = usuarioId !== null;
  /** La config `USUARIO` del motor de formularios; se completa en `cargar` (import diferido). */
  let baseFields: FieldConfig[] = [];
  const opcion = (rol: UserRole): Opcion => ({ id: rol, name: ROLE_TO_SPANISH[rol] });
  // Roles para EDICIÓN (mock, por código de rol).
  const rolesEdicion: Opcion[] = sesion.esSuperAdmin
    ? [opcion(UserRole.SUPERADMIN), opcion(UserRole.ADMIN_ORGANIZATION), opcion(UserRole.AGENT)]
    : [opcion(UserRole.AGENT)];

  /** Catálogo de roles asignables: de acá sale el scope del rol elegido. */
  let rolesAllowed: RolVM[] = [];
  let organismos: OrganismoOption[] = [];
  /** Organismo impuesto por la sesión de quien crea (solo en el alta); `null` = lo elige. */
  let organismoFijo: UsuarioOrganismoFijo | null = null;
  /** Rol elegido ahora en el form: UUID en el alta, código en la edición (mock). */
  let rolActual = '';
  /**
   * Último organismo elegido (o el del usuario en edición). "Organismo" se quita del formulario con un
   * rol global y su control se destruye: al volver a un rol de organismo renace con este valor.
   */
  let ultimoOrganismoId = '';

  /** ¿El rol necesita organismo? Por UUID (alta) o por código (edición mock); uno fuera del catálogo es global. */
  const requiereOrganismo = (rol: string): boolean =>
    !!rol && rolesAllowed.find((r) => r.id === rol || r.codigo === rol)?.scopeTipo === 'organismo';

  /** La config `USUARIO` con lo que aplica a este modo y a este rol. Siempre objetos nuevos. */
  const armarFields = (): FieldConfig[] => {
    const roles: Opcion[] = esEdicion
      ? rolesEdicion
      : rolesAllowed.map((r) => ({ id: r.id, name: r.descripcion || r.codigo }));
    return baseFields
      .filter((field) => !(esEdicion && SOLO_ALTA.includes(field.name)))
      .filter((field) => field.name !== 'organismoId' || requiereOrganismo(rolActual))
      .map((field): FieldConfig => {
        switch (field.name) {
          case 'email':
            return esEdicion ? { ...field, readonly: true, hint: 'El email no puede modificarse' } : { ...field };
          case 'rol':
            return { ...field, options: roles, optionsLoaded: true };
          case 'organismoId':
            return {
              ...field,
              options: organismos.map((o) => ({ id: o.id, name: o.nombre })),
              optionsLoaded: true,
              // Quien pertenece a un organismo solo crea usuarios en el suyo (el backend lo pisa igual):
              // se muestra como dato de solo lectura (enfocable, no un select deshabilitado), con el motivo.
              ...(organismoFijo
                ? { value: organismoFijo.id, readonly: true, hint: organismoFijo.motivo }
                : { value: ultimoOrganismoId }),
            };
          default:
            return { ...field };
        }
      });
  };

  const aFormValue = (data: Record<string, unknown>): UsuarioFormValue => {
    const rol = String(data['rol'] ?? '');
    // Solo un rol de scope `organismo` lleva organismo: el backend no rechaza un rol global con
    // organismo y dejaría la asignación atada a él. Dentro de ese caso, con una sesión de organismo
    // viaja siempre el suyo (el campo es de solo lectura; el backend lo pisa igual si es ADMIN_ORGANIZATION).
    const organismoId = requiereOrganismo(rol)
      ? organismoFijo?.id || String(data['organismoId'] ?? '') || null
      : null;
    return {
      nombre:   String(data['nombre'] ?? ''),
      apellido: String(data['apellido'] ?? ''),
      email:    String(data['email'] ?? ''),
      password: String(data['password'] ?? ''),
      rol,
      organismoId,
    };
  };

  /**
   * El backend crea el usuario con accountActive=true. Con el toggle en ON ya está; en OFF se desactiva
   * en un segundo paso. A partir de acá el alta YA ocurrió: un fallo no es "no se pudo guardar"
   * (reintentar daría 409 por el email), es una cuenta que quedó activa.
   */
  const crear = (data: Record<string, unknown>): Observable<UsuarioGuardado> =>
    facade.create(aFormValue(data)).pipe(
      switchMap((usuario) => data['activo'] === true
        ? of({ usuario, desactivacionFallida: false })
        : facade.setAccountStatus(usuario.id, false).pipe(
            map(() => false),
            defaultIfEmpty(true),
            catchError(() => of(true)),
            map((desactivacionFallida) => ({ usuario, desactivacionFallida })),
          )),
    );

  return {
    titulo: esEdicion ? 'Editar usuario' : 'Nuevo usuario',
    subtitulo: esEdicion ? 'Modificá los datos y el acceso de la cuenta.' : 'Creá una cuenta con su rol y su acceso al backoffice.',
    textoGuardar: esEdicion ? 'Guardar cambios' : 'Crear usuario',
    textoGuardando: 'Guardando…',
    requiereCambios: esEdicion,
    mensajeDescartar: esEdicion
      ? 'Hay cambios sin guardar en este usuario. Si cerrás ahora se pierden.'
      : 'Hay datos sin guardar. Si cerrás ahora no se crea el usuario.',
    formId: 'usuario-dialog-form',

    cargar: () => {
      // La lista no ofrece "Editar" en este caso; esto cubre la URL directa, para no dejar completar
      // un formulario que va a fallar al guardar.
      if (esEdicion && !facade.edicionDisponible) return throwError(() => EDICION_NO_DISPONIBLE);

      return facade.getFormData(usuarioId).pipe(map((datos) => {
        baseFields = camposBaseDeUsuario();
        organismos = datos.organismos;
        organismoFijo = esEdicion ? null : datos.organismoFijo;
        rolesAllowed = datos.rolesAllowed;
        const usuario = datos.usuario;
        rolActual = usuario?.rol ?? '';
        // El organismo no va en `initialData`: viaja como `value` del campo, que es lo que se usa cada
        // vez que el control se vuelve a crear.
        ultimoOrganismoId = usuario?.organismoId ?? '';
        return {
          fields: armarFields(),
          // Llega antes de que exista el formulario: nace precargado y pristine.
          initialData: usuario
            ? { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: rolActual }
            : null,
        };
      }));
    },
    errorDeCarga,

    alCambiar: (valor) => {
      // Solo mientras el campo existe: con un rol global no hay control y se conserva lo último elegido.
      if ('organismoId' in valor) ultimoOrganismoId = String(valor['organismoId'] ?? '');
      const rol = String(valor['rol'] ?? '');
      if (rol === rolActual) return null;
      rolActual = rol;
      return armarFields();
    },

    guardar: (valor) => usuarioId !== null
      ? facade.update(usuarioId, aFormValue(valor)).pipe(map((usuario) => ({ usuario, desactivacionFallida: false })))
      : crear(valor),

    // Alta y edición no comparten los textos del 403: el backend reusa el `details` "…para crear usuarios".
    errorDeGuardado: (err, form) => aplicarErrorDeGuardado(
      err, form, esEdicion ? CONFLICTOS_EDICION_USUARIO : conflictosDeAltaUsuario(organismoFijo !== null), FALLBACK_USUARIO,
    ),
  };
}
