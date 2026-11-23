import { UserRole } from '@core/enums/user-role.enum';

/**
 * Textos y reglas de las acciones de cuenta del menú de una fila de usuarios (activar, desactivar, eliminar,
 * cambiar contraseña). Funciones puras, al lado de la única pantalla que las usa (`usuarios-list`).
 */

/**
 * Roles cuya contraseña el backend no deja cambiar desde el panel (403 `4029` en
 * `PUT /api/user/{id}/change-password`): la acción no se ofrece en esas filas, cuando el rol se conoce.
 *
 * Desde el backend `586b670` (PPDT-5.1) un Administrador de Backoffice tampoco puede eliminar,
 * activar/desactivar ni cambiarles el email (mismo 403 `4029`). Como `GET /api/user` no trae el rol, esas
 * acciones no se pueden ocultar de antemano: se ofrecen y, si el backend las rechaza, el diálogo de cada
 * una cuenta el motivo con texto propio (`usuario-accion-error.ts`).
 */
const ROLES_CON_PASSWORD_PROTEGIDA: readonly UserRole[] = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE];

/**
 * ¿Se ofrece "Cambiar contraseña"? Con el rol desconocido (el backend todavía no lo informa, G-13) sí: si es
 * uno protegido, el diálogo muestra el 403 del backend con texto propio.
 */
export function ofreceCambioDePassword(rol: UserRole | null | undefined): boolean {
  return !(rol && ROLES_CON_PASSWORD_PROTEGIDA.includes(rol));
}

/** Lo que dice la confirmación de activar o desactivar una cuenta, y el aviso al terminar. */
export interface ConfirmacionDeEstado {
  title: string;
  message: string;
  danger: boolean;
  confirmText: string;
  busyText: string;
  exito: string;
}

/** Confirmación de pasar la cuenta de `nombre` a `activo`: cuenta la consecuencia real (desactivar no borra). */
export function confirmacionDeEstado(nombre: string, activo: boolean): ConfirmacionDeEstado {
  return activo
    ? {
        title: '¿Activar la cuenta?',
        message: `${nombre} volverá a poder ingresar al backoffice con los permisos de su rol.`,
        danger: false,
        confirmText: 'Sí, activar',
        busyText: 'Activando…',
        exito: 'Cuenta activada',
      }
    : {
        title: '¿Desactivar la cuenta?',
        message: `${nombre} dejará de poder ingresar al backoffice. La cuenta se conserva y podés volver a activarla cuando quieras.`,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        exito: 'Cuenta desactivada',
      };
}

/** Mensaje de la confirmación de borrado definitivo: no hay vuelta atrás, y se ofrece la alternativa de desactivar. */
export function mensajeDeEliminar(nombre: string): string {
  return `Se borrará ${nombre} con todos sus datos y no se puede deshacer. Si solo querés quitarle el acceso, desactivá la cuenta.`;
}
