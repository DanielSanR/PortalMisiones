import { API_CODES } from '@core/constants/api-codes.constants';
import { UserRole } from '@core/enums/user-role.enum';
import { extractErrorCode } from '@core/models/api-response.model';

/** Acciones sobre la cuenta de OTRO usuario que el backend puede rechazar con 403 `4029`. */
export type AccionDeCuenta = 'email' | 'password' | 'activar' | 'desactivar' | 'eliminar';

/** Cómo se nombra cada acción dentro de la frase "No podés … esta cuenta". */
const VERBO: Record<AccionDeCuenta, string> = {
  email: 'cambiar el email de',
  password: 'cambiar la contraseña de',
  activar: 'activar',
  desactivar: 'desactivar',
  eliminar: 'eliminar',
};

const CUENTA_PRIVILEGIADA = 'es de un Super Administrador o de un Administrador de Backoffice';

/** ¿El backend rechazó la acción por permisos de gestión de usuarios? (403 `4029`). */
export function esAccionDenegada(err: unknown): boolean {
  return extractErrorCode((err as { error?: unknown } | null)?.error) === API_CODES.NO_PERMISSION;
}

/**
 * Texto propio para el 403 `4029` de una acción de cuenta (backend `dev` @ `586b670`, PPDT-5.1). El
 * listado `GET /api/user` no trae el rol de cada fila, así que la acción no se puede ocultar de antemano;
 * lo que sí se sabe es quién opera, y con eso alcanza para decir el motivo:
 *
 * - Contraseña (`UserController.changeUserPassword`): rechaza SIEMPRE que la cuenta sea de un Super
 *   Administrador o de un Administrador de Backoffice, opere quien opere.
 * - Administrador de Backoffice (`UserService.validateUserAccess`): no puede eliminar, activar/desactivar
 *   ni cambiar el email de esas mismas cuentas privilegiadas. Es su único motivo de `4029`.
 * - Administrador de Organismo: solo gestiona cuentas de su organismo, y no elimina ninguna.
 * - Cualquier otro rol con el permiso atómico: el backend no le deja gestionar cuentas ajenas.
 *
 * Nunca se muestra el `message` del backend ("El usuario no tiene permisos para realizar esta acción."),
 * que no dice sobre qué cuenta ni por qué.
 */
export function mensajeDeAccionDenegada(accion: AccionDeCuenta, operador: UserRole | null): string {
  const noPodes = `No podés ${VERBO[accion]} esta cuenta`;
  if (accion === 'password') {
    return `${noPodes}: ${CUENTA_PRIVILEGIADA}, y su contraseña no se cambia desde el panel.`;
  }
  switch (operador) {
    case UserRole.ADMIN_BACKOFFICE:
      return `${noPodes}: ${CUENTA_PRIVILEGIADA}, y solo un Super Administrador puede gestionarlas.`;
    case UserRole.ADMIN_ORGANIZATION:
      return accion === 'eliminar'
        ? `${noPodes}: un Administrador de Organismo no elimina usuarios. Si solo querés quitarle el acceso, desactivala.`
        : `${noPodes}: solo podés gestionar las cuentas de tu organismo.`;
    default:
      return `${noPodes}: tu rol no permite gestionar cuentas de otros usuarios.`;
  }
}

/** El texto propio si el rechazo fue un `4029`; si no, `null` (cada pantalla sigue con su manejo habitual). */
export function errorDeAccionDeCuenta(err: unknown, accion: AccionDeCuenta, operador: UserRole | null): string | null {
  return esAccionDenegada(err) ? mensajeDeAccionDenegada(accion, operador) : null;
}
