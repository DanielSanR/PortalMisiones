import { FichaAdopcionResumen, FichaLocal, FichaLocalVM } from '../models/ficha-local.vm';
import { VigenciaDeAdopcion, motivoNoVigente } from './vigencia-adopcion';

/**
 * Reglas puras para completar lo que el backend no devuelve de una ficha (solo trae ids): nombres de
 * plantilla, organismo y localidad, y la vigencia de su adopción. El facade lee los catálogos (con sus
 * permisos y su caché) y acá se combinan. Los tipos son estructurales a propósito: `domain/` no importa
 * otros features, y la `Adopcion` de `@features/adopciones` y la `LocalidadVM` de `@features/localidades`
 * los cumplen.
 */

/** Lo que hace falta de una adopción para nombrar y fechar sus fichas. */
export interface AdopcionDeFicha extends VigenciaDeAdopcion {
  id: string;
  plantillaId: string;
  organismoId: string;
}

/** Título y `slugBase` de una plantilla. */
export interface PlantillaNombre {
  titulo: string;
  slug: string;
}

/** Catálogos para resolver los ids de una ficha. Un mapa vacío = no se pudo (o no se puede) leer. */
export interface CatalogosDeFichas {
  adopciones: Map<string, AdopcionDeFicha>;
  plantillas: Map<string, PlantillaNombre>;
  organismos: Map<string, string>;
  localidades: Map<string, { nombre: string }>;
  /** Algún catálogo falló (no por falta de permiso): no se cachea, para reintentar en el próximo uso. */
  degradado: boolean;
}

/** Resultado de leer un catálogo: el mapa (vacío si no hay permiso o falló) y si falló. */
export interface LecturaDeCatalogo<T> {
  mapa: Map<string, T>;
  fallo: boolean;
}

/**
 * Lo leído de a uno con `GET /{id}` porque no viene en los listados: el de adopciones solo trae las
 * habilitadas y el de plantillas solo las activas. `null` = el backend dijo que no existe o que está fuera
 * del alcance (no se vuelve a pedir).
 */
export interface LecturasSueltas {
  adopciones: Map<string, AdopcionDeFicha | null>;
  plantillas: Map<string, PlantillaNombre | null>;
}

/** El `GET /{id}` dijo que no existe o que está fuera del alcance: volver a pedirlo no cambia nada. */
export function esLecturaDefinitiva(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 404 || status === 403;
}

/** De una plantilla, lo que hace falta para nombrar sus fichas. */
export function nombreDePlantilla(plantilla: PlantillaNombre): PlantillaNombre {
  return { titulo: plantilla.titulo, slug: plantilla.slug };
}

/**
 * Las fichas del listado que son de ESTA adopción. El listado ya viene filtrado por la fuente
 * (`?organismProcedureId=`), pero se vuelve a filtrar para no depender del servidor (igual que
 * `PuntosAtencionFacade.getDeFicha`): un backend anterior a `586b670` ignora ese parámetro y devuelve TODO el
 * alcance, que se mostraría como fichas de esta adopción. COMPATIBILIDAD TEMPORAL: ese backend además no dice
 * de qué adopción es cada ficha; en ese caso no queda ninguna y `sinContenido` lo avisa (un vacío sin aviso se
 * leería como "no tiene fichas").
 */
export function soloDeLaAdopcion(lista: FichaLocal[], adopcionId: string): { propias: FichaLocal[]; sinContenido: boolean } {
  return {
    propias: lista.filter((ficha) => ficha.adopcionId === adopcionId),
    sinContenido: lista.some((ficha) => ficha.sinContenido),
  };
}

/** Junta las cuatro lecturas en los catálogos; alcanza con que una haya fallado para que queden degradados. */
export function catalogosDe(lecturas: {
  adopciones: LecturaDeCatalogo<AdopcionDeFicha>;
  plantillas: LecturaDeCatalogo<PlantillaNombre>;
  organismos: LecturaDeCatalogo<string>;
  localidades: LecturaDeCatalogo<{ nombre: string }>;
}): CatalogosDeFichas {
  return {
    adopciones: lecturas.adopciones.mapa,
    plantillas: lecturas.plantillas.mapa,
    organismos: lecturas.organismos.mapa,
    localidades: lecturas.localidades.mapa,
    degradado: lecturas.adopciones.fallo || lecturas.plantillas.fallo || lecturas.organismos.fallo || lecturas.localidades.fallo,
  };
}

/**
 * La adopción de una ficha: la del listado o, si está deshabilitada, la leída suelta. Si una deshabilitada
 * vuelve a habilitarse aparece en el listado, que gana.
 */
export function adopcionDe(
  ficha: Pick<FichaLocal, 'adopcionId'>, catalogos: CatalogosDeFichas, sueltas: LecturasSueltas,
): AdopcionDeFicha | null {
  return catalogos.adopciones.get(ficha.adopcionId) ?? sueltas.adopciones.get(ficha.adopcionId) ?? null;
}

/**
 * Ids de adopción de estas fichas que no están en el listado ni se leyeron sueltas: son los que hay que
 * pedir con `GET /{id}`. Sin repetidos. Una ficha `sinContenido` no trae adopción: no hay nada que pedir.
 */
export function adopcionesSinLeer(
  fichas: Pick<FichaLocal, 'adopcionId'>[], catalogos: CatalogosDeFichas, sueltas: LecturasSueltas,
): string[] {
  return [...new Set(fichas.map((f) => f.adopcionId).filter(Boolean))]
    .filter((id) => !catalogos.adopciones.has(id) && !sueltas.adopciones.has(id));
}

/**
 * Ids de plantilla de las adopciones de estas fichas que no están en el listado ni se leyeron sueltas. Se
 * calcula DESPUÉS de leer las adopciones sueltas: la plantilla de una adopción deshabilitada sale de ahí.
 */
export function plantillasSinLeer(
  fichas: Pick<FichaLocal, 'adopcionId'>[], catalogos: CatalogosDeFichas, sueltas: LecturasSueltas,
): string[] {
  return [...new Set(fichas
    .map((f) => adopcionDe(f, catalogos, sueltas)?.plantillaId)
    .filter((id): id is string => !!id))]
    .filter((id) => !catalogos.plantillas.has(id) && !sueltas.plantillas.has(id));
}

/**
 * Ficha → ViewModel con los nombres resueltos. Lo que no se puede resolver (sin permiso de lectura, id que ya
 * no está, catálogo caído) queda en `null` en vez de tumbar la pantalla. `adopcionNoVigente` se calcula en
 * `ahora`; sin la adopción queda sin decidir (`null`).
 */
export function resolverNombres(
  ficha: FichaLocal, catalogos: CatalogosDeFichas, sueltas: LecturasSueltas, ahora: Date,
): FichaLocalVM {
  const adopcion = adopcionDe(ficha, catalogos, sueltas);
  const plantillaId = adopcion?.plantillaId ?? null;
  const organismoId = adopcion?.organismoId ?? null;
  const plantilla = plantillaId ? catalogos.plantillas.get(plantillaId) ?? sueltas.plantillas.get(plantillaId) : undefined;
  return {
    ...ficha,
    plantillaId,
    organismoId,
    plantillaTitulo: plantilla?.titulo ?? null,
    organismoNombre: (organismoId ? catalogos.organismos.get(organismoId) : undefined) ?? null,
    localidadNombre: catalogos.localidades.get(ficha.localidadId)?.nombre ?? null,
    adopcionNoVigente: adopcion ? motivoNoVigente(adopcion, ahora) : null,
  };
}

/** Resumen de una adopción, con su vigencia calculada en `ahora` (misma regla que el backend al guardar la ficha). */
export function resumenDeAdopcion(
  adopcion: AdopcionDeFicha, plantilla: PlantillaNombre | null, organismoNombre: string | null, ahora: Date,
): FichaAdopcionResumen {
  const motivo = motivoNoVigente(adopcion, ahora);
  return {
    id: adopcion.id,
    plantillaTitulo: plantilla?.titulo ?? null,
    plantillaSlug: plantilla?.slug ?? null,
    organismoNombre,
    habilitada: adopcion.habilitada,
    vigente: motivo === null,
    motivoNoVigente: motivo,
    vigenteDesde: adopcion.vigenteDesde,
    vigenteHasta: adopcion.vigenteHasta,
  };
}

/**
 * Adopciones entre las que el alta de una ficha deja elegir: las habilitadas del catálogo, con el nombre del
 * trámite y del organismo y si están VIGENTES. El backend solo acepta fichas de una adopción vigente (si no,
 * 404), así que las que todavía no empezaron o ya vencieron salen marcadas (`vigente = false` + motivo) para
 * que el form las muestre como no elegibles en vez de esconderlas. Ordenadas por trámite y organismo; las que
 * no tienen nombre (sin `READ_PROCEDURE`) quedan al final.
 */
export function adopcionesElegibles(catalogos: CatalogosDeFichas, ahora: Date): FichaAdopcionResumen[] {
  return [...catalogos.adopciones.values()]
    .filter((a) => a.habilitada)
    .map((a) => resumenDeAdopcion(
      a, catalogos.plantillas.get(a.plantillaId) ?? null, catalogos.organismos.get(a.organismoId) ?? null, ahora,
    ))
    .sort((a, b) => {
      if (!a.plantillaTitulo !== !b.plantillaTitulo) return a.plantillaTitulo ? -1 : 1;
      return (a.plantillaTitulo ?? '').localeCompare(b.plantillaTitulo ?? '', 'es-AR', { sensitivity: 'base' })
        || (a.organismoNombre ?? '').localeCompare(b.organismoNombre ?? '', 'es-AR', { sensitivity: 'base' });
    });
}
