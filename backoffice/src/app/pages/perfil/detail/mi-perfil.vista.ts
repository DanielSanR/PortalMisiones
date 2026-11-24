import { AuthUser } from '@core/models/auth.model';
import { etiquetaDeOrganismo, inicialesDe, nombreVisible, organismoDeSesion } from '@core/utils/session.utils';
import { MembreteDato } from '@shared/components/membrete/membrete.component';
import { PermisoGroupVM, gruposDeCodigos } from '@shared/utils/permiso-groups.util';

/** Lo que muestra "Mi perfil": todo sale de la sesión, sin pedir nada al backend. */
export interface VistaDePerfil {
  nombre: string;
  iniciales: string;
  email: string;
  rol: string;
  alcance: 'Global' | 'Por organismo';
  alcanceAyuda: string;
  /** "Nombre (SIGLA)"; `null` en una sesión global o si el backend no informa el organismo. */
  organismo: string | null;
  grupos: PermisoGroupVM[];
  /** "1 permiso" / "N permisos" (los códigos repetidos cuentan una vez). */
  totalPermisos: string;
  /** Línea meta del membrete: correo · rol · alcance. */
  membrete: MembreteDato[];
}

const AYUDA_POR_ORGANISMO = 'Ves y editás solo lo de tu organismo.';
const AYUDA_GLOBAL = 'Ves y editás todo el backoffice.';

/**
 * Vista de "Mi perfil" a partir de la sesión y del rol legible (`getUserRoleLabel`).
 * Es "Por organismo" si la sesión trae un organismo o el backend dice `scope: organismo`; sin `scope` ni organismo
 * (backend anterior a G-2) se toma como global, igual que el resto de la app.
 */
export function vistaDePerfil(user: AuthUser, rol: string): VistaDePerfil {
  const organismoPropio = organismoDeSesion(user);
  const porOrganismo = !!organismoPropio || user.scope === 'organismo';
  const organismo = organismoPropio ? etiquetaDeOrganismo(organismoPropio) : null;
  const grupos = gruposDeCodigos(user.permissions ?? []);
  const total = grupos.reduce((suma, grupo) => suma + grupo.total, 0);
  return {
    nombre: nombreVisible(user),
    iniciales: inicialesDe(user),
    email: user.email,
    rol,
    alcance: porOrganismo ? 'Por organismo' : 'Global',
    alcanceAyuda: porOrganismo ? AYUDA_POR_ORGANISMO : AYUDA_GLOBAL,
    organismo,
    grupos,
    totalPermisos: total === 1 ? '1 permiso' : `${total} permisos`,
    membrete: [
      { texto: user.email, icono: 'envelope-simple' },
      { texto: rol, icono: 'shield-star' },
      porOrganismo
        ? { texto: organismo ?? 'Por organismo', icono: 'buildings' }
        : { texto: 'Alcance global', icono: 'globe-simple' },
    ],
  };
}
