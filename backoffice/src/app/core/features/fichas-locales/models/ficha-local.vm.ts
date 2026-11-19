import { EstadoPublicacion } from '@core/models/estado-publicacion.model';

export type EstadoFicha = EstadoPublicacion;

/** Ficha por localidad tal como la devuelve la fuente: contenido completo, sin nombres. */
export interface FichaLocal {
  id: string;
  slug: string;
  estado: EstadoFicha;
  /** `false` = desactivada (`DELETE` lógico). El backend la sigue listando. */
  activa: boolean;
  /** `currentVersionNumber`: cada alta, edición o transición genera una versión nueva. */
  version: number;
  /** Adopción ("trámite del organismo") de la que cuelga. */
  adopcionId: string;
  localidadId: string;
  url: string | null;
  requisitos: string | null;
  costos: string | null;
  /**
   * COMPATIBILIDAD TEMPORAL (backend anterior a `586b670`): `true` si el servidor respondió la ficha sin su
   * contenido (sin adopción ni localidad: el response viejo de 5 campos). En ese caso `adopcionId` y
   * `localidadId` vienen vacíos y la ficha NO se puede editar: un PUT (reemplazo total) armado sobre esto
   * borraría el contenido guardado. Quitar cuando ningún entorno corra un backend anterior.
   */
  sinContenido?: boolean;
}

/**
 * ViewModel de la ficha (PLAN_TRAMITES_API.md §3), con los nombres que resuelve el facade (el backend
 * solo devuelve ids). Un nombre en `null` = no se pudo resolver (sin permiso de lectura, o id que ya no está).
 */
export interface FichaLocalVM extends FichaLocal {
  plantillaId: string | null;
  plantillaTitulo: string | null;
  organismoId: string | null;
  organismoNombre: string | null;
  localidadNombre: string | null;
  /**
   * Por qué la adopción de la ficha NO está vigente ahora (`null`/ausente = vigente, o no se pudo saber: sin
   * `READ_ADOPTION` o no se pudo leer). La API pública solo muestra fichas de una adopción vigente, así que
   * una ficha `PUBLICADO` con esto en no-`null` no se ve en el portal. Es una foto: en la lectura de una ficha
   * (`getDetalle`, form) y al cargar el listado se calcula con datos recién leídos; en el resto, con lo último que
   * leyó el facade. Sirve para avisar, no para autorizar.
   */
  adopcionNoVigente?: MotivoNoVigente | null;
}

/** Valor del formulario. NO lleva estado: guardar nunca cambia el estado de publicación (eso es del workflow). */
export interface FichaLocalFormValue {
  adopcionId: string;
  localidadId: string;
  slug: string;
  url: string;
  requisitos: string;
  costos: string;
  activa: boolean;
  /**
   * Edición sin tocar el slug: viaja TAL CUAL se leyó, sin re-canonicalizar. Una ficha con un slug heredado
   * no canónico no debe cambiar su dirección pública por guardar otro campo.
   */
  conservarSlug?: boolean;
}

/** Lo que el form leyó de la ficha: el facade lo compara con lo que hay en el servidor antes de pisarla. */
export interface FichaBase {
  version: number;
  estado: EstadoFicha;
  /**
   * Desactivar (`DELETE`) no suma versión y solo cambia el estado de una PUBLICADA: sin comparar esto, que otro
   * desactive una ficha en BORRADOR, EN_REVISION o DESPUBLICADO sería invisible y el PUT la reactivaría.
   */
  activa: boolean;
}

/** Resultado de guardar la edición de una ficha. */
export interface FichaGuardada {
  ficha: FichaLocalVM;
  /**
   * El guardado además la DESPUBLICÓ: quedó `PUBLICADO` e inactiva tras el PUT y se completó con el `DELETE`
   * (ver `FichasLocalesFacade.update`). La pantalla tiene que decirlo: "Guardar" normalmente no cambia el estado.
   */
  despublicada: boolean;
}

/** Opción de localidad del form. */
export interface FichaLocalidadOpcion {
  id: string;
  nombre: string;
  departamentoNombre: string;
}

/**
 * Por qué una adopción no está vigente ahora, con la regla del backend (`OrganismProcedure.isEffectiveAt`):
 * habilitada, `desde <= ahora` y `hasta` nulo o futuro.
 */
export type MotivoNoVigente = 'deshabilitada' | 'programada' | 'vencida';

/** La adopción de la ficha, con lo que el form muestra y lo que usa para sugerir el slug (P-5). */
export interface FichaAdopcionResumen {
  id: string;
  plantillaTitulo: string | null;
  /** `slugBase` de la plantilla: base del slug sugerido. `null` si no se pudo leer. */
  plantillaSlug: string | null;
  organismoNombre: string | null;
  habilitada: boolean;
  /**
   * ¿Está vigente al momento de leerla? El backend solo acepta crear o editar fichas de una adopción
   * vigente (si no, 404). Es una foto: el backend vuelve a decidir al guardar.
   */
  vigente: boolean;
  /** `null` si está vigente. */
  motivoNoVigente: MotivoNoVigente | null;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

/** Lo que necesita el formulario de ficha, resuelto en una sola llamada por el facade. */
export interface FichaFormData {
  /** `null` en alta. */
  ficha: FichaLocalVM | null;
  /** `null` si no se pudo leer (sin `READ_ADOPTION`, o falló su lectura en edición). */
  adopcion: FichaAdopcionResumen | null;
  localidades: FichaLocalidadOpcion[];
  /**
   * Para validar duplicados en el cliente antes de guardar. Cuentan TODAS las fichas del alcance visible
   * (activas y desactivadas), sin la que se edita: los UNIQUE del backend (`V2.27`: adopción + localidad,
   * slug + adopción) incluyen las desactivadas, y su violación llega como un 500 `5000` sin detalle.
   */
  ocupadas: {
    /** Localidades que ya tienen una ficha (activa o desactivada) de esta adopción. */
    localidadIds: string[];
    /**
     * Subconjunto de `localidadIds` cuya ficha está desactivada: no se crea otra, se reactiva esa
     * (editándola y marcándola como activa).
     */
    localidadIdsDesactivadas: string[];
    /** Slugs (canónicos) de las demás fichas, activas o desactivadas. */
    slugs: string[];
  };
}

/** Fichas de una adopción, con lo que su listado necesita saber de ella. */
export interface FichasDeAdopcion {
  fichas: FichaLocalVM[];
  /**
   * COMPATIBILIDAD TEMPORAL: el servidor respondió fichas sin su adopción (backend anterior a `586b670`), así
   * que no se puede saber cuáles son de esta. `fichas` viene vacío por eso, no porque no haya.
   */
  sinContenido: boolean;
  /**
   * Por qué hoy no se le pueden agregar fichas (el backend respondería 404); `null` si está vigente o si
   * no se pudo leer la adopción (sin `READ_ADOPTION` o falló): en ese caso decide el backend al guardar.
   */
  motivoNoVigente: MotivoNoVigente | null;
}
