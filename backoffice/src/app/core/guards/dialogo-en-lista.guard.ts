import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthTokenService } from '../services/auth-token.service';
import { AccessRule } from '../models/access-rule.model';
import { evaluateAccess } from '../utils/authorization.utils';
import { environment } from '@env/environment';

/**
 * Entidades cuyo alta y edición van en DIÁLOGO sobre su lista (ver DESIGN.md, "Alta y edición:
 * ¿diálogo o página?"). Sus rutas `<x>/nuevo` y `<x>/editar/:id` no tienen pantalla: quedan como
 * puerta de entrada (enlaces directos, paleta de comandos) y redirigen a la lista con el pedido en
 * query params, que la lista atiende con `DialogoEnLista` (`@shared/utils/dialogo-en-lista`).
 */

/** Query param con el que una lista abre su diálogo de alta o edición. */
export const PARAM_DIALOGO = 'dialogo';
/** Params que acompañan al pedido y se limpian con él. */
export const PARAMS_DEL_DIALOGO = [PARAM_DIALOGO, 'id', 'parentId'] as const;

export type ModoDialogo = 'nuevo' | 'editar';

/**
 * Guard de `<x>/nuevo` y `<x>/editar/:id`: redirige a la lista pidiendo el diálogo. Como el destino
 * es la MISMA ruta de la lista, si el usuario ya está ahí el componente se reutiliza y no pierde
 * búsqueda, filtros ni página. Va después de `accessGuard`, que ya validó el permiso de la ruta.
 */
export function redirigirAlDialogo(lista: string, modo: ModoDialogo): CanActivateFn {
  return (route) =>
    inject(Router).createUrlTree([lista], {
      queryParams: {
        [PARAM_DIALOGO]: modo,
        id: route.params['id'] ?? null,
        parentId: route.queryParamMap.get('parentId'),
      },
    });
}

/**
 * Guard de la LISTA: su ruta suele admitir a quien tenga cualquiera de los permisos de la entidad,
 * así que `?dialogo=nuevo` escrito a mano saltearía el permiso puntual que sí validan `<x>/nuevo` y
 * `<x>/editar/:id`. Si el usuario no tiene el permiso del modo pedido, entra a la lista sin el
 * pedido de diálogo (el resto de los query params se conserva).
 *
 * Cada modo lleva el permiso atómico que exige o, si la entidad no se autoriza por permiso (Permisos
 * va por rol), la misma `AccessRule` de su ruta `<x>/nuevo` / `<x>/editar/:id`.
 *
 * La ruta tiene que llevar `runGuardsAndResolvers: 'paramsOrQueryParamsChange'` para que también
 * corra cuando ya se está en la lista y solo cambian los params.
 */
export function validarDialogoDeLista(permisos: Record<ModoDialogo, string | AccessRule>): CanActivateFn {
  return (route, state) => {
    const modo = route.queryParamMap.get(PARAM_DIALOGO);
    if ((modo !== 'nuevo' && modo !== 'editar') || environment.bypassAuthGuards) return true;

    const tokenService = inject(AuthTokenService);
    const ctx = { permissions: tokenService.getPermissions(), roles: tokenService.getUserRoles() };
    const requerido = permisos[modo];
    if (evaluateAccess(ctx, typeof requerido === 'string' ? { permissions: [requerido] } : requerido)) return true;

    const destino = inject(Router).parseUrl(state.url);
    const queryParams = { ...destino.queryParams };
    for (const clave of PARAMS_DEL_DIALOGO) delete queryParams[clave];
    destino.queryParams = queryParams;
    return destino;
  };
}
