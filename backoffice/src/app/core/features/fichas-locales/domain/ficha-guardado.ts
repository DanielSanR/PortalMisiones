import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaBase, FichaFormData, FichaLocal, FichaLocalidadOpcion } from '../models/ficha-local.vm';

/**
 * Reglas puras del formulario y del guardado de una ficha: qué está ocupado, cuándo la ficha ya no es la
 * que el form leyó y cuándo un guardado tiene que completarse despublicando. Las aplica el facade.
 */

/**
 * Lo ya ocupado, para validar duplicados antes de guardar. Cuentan TODAS las fichas del alcance visible
 * (activas y desactivadas) menos la que se edita: los UNIQUE del backend (`V2.27`) no distinguen `active`.
 * Los slugs se comparan contra todas; las localidades, solo contra las de la adopción.
 */
export function fichasOcupadas(
  todas: FichaLocal[], fichaId: string | null, adopcionId: string | null,
): FichaFormData['ocupadas'] {
  const otras = todas.filter((f) => f.id !== fichaId);
  const deLaAdopcion = adopcionId ? otras.filter((f) => f.adopcionId === adopcionId) : [];
  const conFichaActiva = new Set(deLaAdopcion.filter((f) => f.activa).map((f) => f.localidadId));
  return {
    localidadIds: [...new Set(deLaAdopcion.map((f) => f.localidadId))],
    localidadIdsDesactivadas: [...new Set(deLaAdopcion
      .map((f) => f.localidadId)
      .filter((id) => !conFichaActiva.has(id)))],
    slugs: otras.map((f) => canonicalizarSlug(f.slug)),
  };
}

/** Opciones de localidad del form, ordenadas por nombre (es-AR, sin distinguir mayúsculas ni tildes). */
export function opcionesDeLocalidad(localidades: FichaLocalidadOpcion[]): FichaLocalidadOpcion[] {
  return localidades
    .map((l) => ({ id: l.id, nombre: l.nombre, departamentoNombre: l.departamentoNombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }));
}

/**
 * ¿La ficha del servidor (`actual`) ya no es la que el form leyó (`base`)?
 *
 * El PUT no viaja con versión, así que el backend solo rechaza dos escrituras simultáneas (`4091`); un
 * formulario abierto hace rato pisaría sin aviso lo que otro guardó. Para achicar ese riesgo el facade relee
 * la ficha justo antes del PUT y, si cambió, no guarda (`FichaCambiadaError` con la ficha actual; la pantalla
 * decide si recargar o volver a llamar con la base nueva para guardar a sabiendas). Es una mitigación, no un
 * candado: entre esa lectura y el PUT queda una ventana de milisegundos.
 *
 * `activa` se compara aparte de la versión: desactivar (`DELETE`) una ficha que no está publicada no cambia ni
 * la versión ni el estado, y el PUT (que lleva `active`) la reactivaría sin que nadie lo pidiera.
 */
export function cambioDesdeLaBase(actual: FichaBase, base: FichaBase): boolean {
  return actual.version !== base.version || actual.estado !== base.estado || actual.activa !== base.activa;
}

/**
 * ¿El guardado dejó la ficha `PUBLICADO` e inactiva? Es un estado contradictorio que hay que completar con
 * el `DELETE` ("Desactivar", que además la despublica): un PUT con `active=false` solo la deja inactiva. El
 * form no lo ofrece (bloquea el interruptor de una publicada activa), pero pasa igual si la publicaron
 * mientras se editaba, o al guardar cualquier cambio en una ficha que YA estaba publicada e inactiva.
 */
export function quedoPublicadaEInactiva(ficha: Pick<FichaLocal, 'estado' | 'activa'>): boolean {
  return ficha.estado === 'PUBLICADO' && !ficha.activa;
}

/**
 * La ficha tal como la deja "Desactivar" (`DELETE` lógico), con la regla del backend: `active=false` y, si
 * estaba publicada, `DESPUBLICADO`; cualquier otro estado se conserva.
 */
export function trasDesactivar<T extends Pick<FichaLocal, 'estado' | 'activa'>>(ficha: T): T {
  return { ...ficha, activa: false, estado: ficha.estado === 'PUBLICADO' ? 'DESPUBLICADO' : ficha.estado };
}
