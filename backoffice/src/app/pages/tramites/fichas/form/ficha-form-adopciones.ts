import { Observable, catchError, of } from 'rxjs';
import { TreeFieldConfig } from '@core/models/field.interface';
import { FichaAdopcionResumen, FichaFormData } from '@features/fichas-locales';
import { esFichaInexistente } from '../ficha-save-error';
import { motivoNoElegible } from '../ficha-textos';
import { FichaForm } from './ficha-form-campos';

/**
 * El trámite del organismo de un alta sin `?adopcion=` (desde "Nueva ficha" de la lista): es el primer campo, con
 * buscador, y recién al elegirlo se leen sus localidades ocupadas y se habilita la localidad. Solo se pueden elegir
 * los VIGENTES (habilitado, ya empezó a regir y no venció): el backend responde 404 al crear una ficha de uno que
 * no lo está. Los habilitados que todavía no rigen o ya vencieron se muestran igual, no elegibles y con el motivo.
 */

/**
 * Un trámite del organismo como opción del buscador: título del trámite y, debajo, el organismo. Si no está vigente
 * se muestra igual, no elegible y con el motivo (esconderlo dejaría al usuario buscando algo que "debería estar").
 */
function aNodo(adopcion: FichaAdopcionResumen): TreeFieldConfig['nodes'][number] {
  return {
    disabledReason: motivoNoElegible(adopcion) ?? undefined,
    id: adopcion.id,
    label: adopcion.plantillaTitulo ?? 'Trámite sin nombre disponible',
    meta: adopcion.organismoNombre ?? undefined,
    parentId: null,
    keywords: [adopcion.organismoNombre, adopcion.plantillaSlug].filter(Boolean).join(' '),
  };
}

/** El buscador del trámite del organismo, con lo que ofrecen `adopciones` (`null` = todavía no se leyeron). */
export function arbolDeAdopciones(adopciones: FichaAdopcionResumen[] | null): TreeFieldConfig {
  return {
    nodes: (adopciones ?? []).map(aNodo),
    loaded: adopciones !== null,
    emptyLabel: 'Elegí un trámite del organismo',
    searchLabel: 'Buscar trámite u organismo',
  };
}

/** Hay trámites del organismo, pero ninguno vigente hoy: no hay qué elegir. */
export function sinVigentes(adopciones: FichaAdopcionResumen[]): boolean {
  return adopciones.length > 0 && !adopciones.some((a) => a.vigente);
}

/** Lo que devuelve leer el trámite elegido: sus datos, `null` (sin trámite), o por qué no se pudo. */
export type LecturaAdopcion = FichaFormData | 'inexistente' | 'fallo' | null;

/** Lee el trámite elegido (`leer` es `getFormData` del facade). Nunca falla: el motivo viaja como valor. */
export function leerAdopcion(id: string, leer: (id: string) => Observable<FichaFormData>): Observable<LecturaAdopcion> {
  if (!id) return of<LecturaAdopcion>(null);
  return leer(id).pipe(
    catchError((err: unknown) => of<LecturaAdopcion>(esFichaInexistente(err) ? 'inexistente' : 'fallo')),
  );
}

/** En qué quedó la lectura del trámite elegido. Todo en `false` = leído y vigente, o sin elegir. */
export interface EleccionDeAdopcion {
  /** Leyendo la localidad y lo ocupado del trámite recién elegido. */
  cargando: boolean;
  /** No se pudo leer el trámite elegido (conexión u otro fallo): reintentar puede servir. */
  fallo: boolean;
  /** El trámite elegido ya no existe o no está disponible (404): reintentar no sirve, hay que elegir otro. */
  inexistente: boolean;
  /** El trámite elegido se leyó, pero dejó de estar vigente desde que se armó la lista: hay que elegir otro. */
  noVigente: boolean;
}

export const SIN_ELECCION: EleccionDeAdopcion = { cargando: false, fallo: false, inexistente: false, noVigente: false };

function esLecturaUtil(lectura: LecturaAdopcion): lectura is FichaFormData {
  return !!lectura && lectura !== 'inexistente' && lectura !== 'fallo';
}

/** Resultado de leer el trámite `id`: sus datos (si se leyeron) y cómo queda la elección. */
export function eleccionTrasLeer(
  lectura: LecturaAdopcion, id: string,
): { datos: FichaFormData | null; eleccion: EleccionDeAdopcion } {
  if (!id) return { datos: null, eleccion: SIN_ELECCION };
  if (!esLecturaUtil(lectura)) {
    const inexistente = lectura === 'inexistente';
    return { datos: null, eleccion: { ...SIN_ELECCION, inexistente, fallo: !inexistente } };
  }
  // La lista se armó al abrir el form: si desde entonces dejó de estar vigente, no se sigue (el alta daría 404).
  return { datos: lectura, eleccion: { ...SIN_ELECCION, noVigente: !!lectura.adopcion && !lectura.adopcion.vigente } };
}

/**
 * Por qué no se puede guardar todavía aunque el formulario sea válido (la localidad deshabilitada queda fuera
 * de la validación): el trámite elegido se está leyendo o no se pudo leer. `null` = no dice nada.
 */
export function motivoSinAdopcion(eleccion: EleccionDeAdopcion): string | null {
  if (eleccion.cargando) return 'se está leyendo, esperá un momento para guardar';
  if (eleccion.inexistente) return 'ya no está disponible: elegí otro';
  if (eleccion.noVigente) return 'ya no está vigente: elegí otro';
  if (eleccion.fallo) return 'no se pudo leer: reintentá o elegí otro';
  return null;
}

/** Lo leído del trámite anterior (nombres, localidades ocupadas) ya no vale: quedan solo los catálogos. */
export function sinTramite(datos: FichaFormData): FichaFormData {
  return { ...datos, adopcion: null, ocupadas: { ...datos.ocupadas, localidadIds: [], localidadIdsDesactivadas: [] } };
}

/**
 * Cambió el trámite elegido: la localidad queda vacía y bloqueada hasta que llegue la lectura del nuevo, y el slug
 * sugerido (si todavía sigue a la localidad: `slugManual` en `false`) se vacía con ella.
 */
export function soltarLocalidad(form: FichaForm, slugManual: boolean): void {
  const localidad = form.controls.localidadId;
  localidad.disable({ emitEvent: false });
  localidad.setValue('', { emitEvent: false });
  // La localidad vacía no es un error del usuario: no debe reaparecer en rojo con el estado del trámite anterior.
  localidad.markAsUntouched();
  localidad.markAsPristine();
  if (!slugManual) form.controls.slug.setValue('', { emitEvent: false });
}
