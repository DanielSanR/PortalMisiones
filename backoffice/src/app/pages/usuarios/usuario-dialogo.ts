import { Observable, catchError, defaultIfEmpty, forkJoin, from, map, of, switchMap, throwError } from 'rxjs';
import { FieldConfig } from '@core/models/field.interface';
import { extractErrorMessage } from '@core/models/api-response.model';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { UserRole, ROLE_TO_SPANISH } from '@core/enums/user-role.enum';
import { UsuariosFacade, UsuarioFormValue, UsuarioVM } from '@features/usuarios';
import { OrganismoOption } from '@features/organismos';
import { RolVM } from '@features/roles';
import { FormDialogData, FormDialogErrorCarga } from '@shared/components/form-dialog';
import { CONFLICTOS_USUARIO, FALLBACK_USUARIO } from './usuario-save-error';

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

/** Quién abre el diálogo: de eso depende qué roles y organismo se le ofrecen. */
export interface SesionDeUsuarioDialogo {
  esSuperAdmin: boolean;
  organismoId: string | null;
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
    texto: extractErrorMessage((err as { error?: unknown })?.error)
      || 'No pudimos cargar los datos del formulario. Revisá tu conexión e intentá de nuevo.',
    reintentable: true,
  };
}

/**
 * Configuración del diálogo de alta/edición de usuario (`FormDialogComponent`), sobre `app-dynamic-form`
 * (config `USUARIO`). `usuarioId` null = alta. Lo propio de usuarios:
 * - "Organismo" aparece (y es obligatorio) solo si el rol elegido es de scope `organismo`, según el
 *   `scopeTipo` del catálogo `/api/role/allowed` (en el alta el valor del select es el UUID del rol).
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
    // Quien no es superadmin y tiene organismo solo puede crear usuarios en el suyo (el backend lo pisa
    // igual): se muestra elegido y bloqueado.
    const organismoFijo = !esEdicion && !sesion.esSuperAdmin ? sesion.organismoId : null;

    return baseFields
      .filter((field) => !(esEdicion && SOLO_ALTA.includes(field.name)))
      .filter((field) => field.name !== 'organismoId' || requiereOrganismo(rolActual))
      .map((field): FieldConfig => {
        switch (field.name) {
          case 'email':
            return esEdicion ? { ...field, disabled: true, hint: 'El email no puede modificarse' } : { ...field };
          case 'rol':
            return { ...field, options: roles, optionsLoaded: true };
          case 'organismoId':
            return {
              ...field,
              options: organismos.map((o) => ({ id: o.id, name: o.nombre })),
              optionsLoaded: true,
              ...(organismoFijo ? { value: organismoFijo, disabled: true } : { value: ultimoOrganismoId }),
            };
          default:
            return { ...field };
        }
      });
  };

  const aFormValue = (data: Record<string, unknown>): UsuarioFormValue => {
    const rol = String(data['rol'] ?? '');
    // Solo un rol de scope `organismo` lleva organismo: el backend no rechaza un rol global con
    // organismo y dejaría la asignación atada a él. Dentro de ese caso, fallback para el
    // no-superadmin: el suyo (el backend lo pisa igual si es ADMIN_ORGANIZATION).
    const organismoId = requiereOrganismo(rol)
      ? String(data['organismoId'] ?? '') || (!sesion.esSuperAdmin ? sesion.organismoId : null) || null
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

      // La config del formulario se baja recién al abrir el diálogo: así no viaja en el chunk de la lista.
      return forkJoin({
        config: from(import('@shared/components/dynamic-form/dynamic-form.config')),
        datos: facade.getFormData(usuarioId),
      }).pipe(map(({ config, datos }) => {
        baseFields = config.getFormConfig('USUARIO').fields ?? [];
        organismos = datos.organismos;
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

    errorDeGuardado: (err, form) => aplicarErrorDeGuardado(err, form, CONFLICTOS_USUARIO, FALLBACK_USUARIO),
  };
}
