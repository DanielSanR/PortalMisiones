import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaFormData, FichaLocalVM } from '@features/fichas-locales';
import { textoRecomendados } from '@pages/tramites/plantillas/plantilla-recomendados-textos';
import { TEXTOS_FICHA_INEXISTENTE, TEXTO_FICHA_SIN_CONTENIDO, esFichaInexistente } from '../ficha-save-error';
import { MOTIVO_NO_VIGENTE } from '../ficha-textos';
import { FichaForm } from './ficha-form-campos';

/** Lo que el formulario de ficha muestra, derivado de lo cargado y de lo escrito. Funciones puras. */

/** Lo que el membrete y el pie muestran del formulario en vivo. */
export interface VistaFicha {
  /** Título de la plantilla; vacío si no se pudo leer. */
  titulo: string;
  /** Alta sin trámite elegido todavía: el membrete lo pide en vez de decir "no disponible". */
  sinAdopcion: boolean;
  organismo: string;
  /** Nombre de la localidad elegida; vacío si todavía no hay. */
  localidad: string;
  /** Slug como se va a guardar (canónico). */
  slug: string;
  activa: boolean;
  recomendadosCompletos: boolean;
  recomendado: string;
}

/**
 * @param valor el `getRawValue()` del form: en edición la localidad (y a veces "activa") están deshabilitadas.
 * @param sinAdopcion alta que elige el trámite y todavía no tiene uno leído.
 * @param conservaSlug edición sin tocar el slug: se muestra tal cual se leyó.
 */
export function aVista(
  valor: ReturnType<FichaForm['getRawValue']>, datos: FichaFormData | null, sinAdopcion: boolean, conservaSlug: boolean,
): VistaFicha {
  const ficha = datos?.ficha;
  const localidad = datos?.localidades.find((l) => l.id === valor.localidadId);
  // Informativo, no bloquea el guardado: lo que el ciudadano necesita encontrar en la ficha.
  const recomendados = [
    { etiqueta: 'Requisitos', completo: !!valor.requisitos.trim() },
    { etiqueta: 'Costos', completo: !!valor.costos.trim() },
    { etiqueta: 'URL', completo: !!valor.url.trim() },
  ];
  return {
    titulo: datos?.adopcion?.plantillaTitulo ?? ficha?.plantillaTitulo ?? '',
    sinAdopcion,
    organismo: datos?.adopcion?.organismoNombre ?? ficha?.organismoNombre ?? '',
    localidad: localidad?.nombre ?? ficha?.localidadNombre ?? '',
    slug: conservaSlug ? valor.slug : canonicalizarSlug(valor.slug),
    activa: valor.activa,
    recomendadosCompletos: recomendados.every((dato) => dato.completo),
    recomendado: textoRecomendados(recomendados),
  };
}

/** `slugBase-localidad`, canonicalizado (P-5). Vacío si todavía no hay localidad elegida. */
export function slugSugerido(datos: FichaFormData | null, localidadId: string): string {
  const localidad = datos?.localidades.find((l) => l.id === localidadId);
  if (!localidad) return '';
  return canonicalizarSlug([datos?.adopcion?.plantillaSlug, localidad.nombre].filter(Boolean).join('-'));
}

/** Cómo se va a guardar el slug, si difiere de lo tipeado. Sin tocar se guarda tal cual: no hay "se guardará como". */
export function slugPrevisto(valor: string, conservaSlug: boolean): string | null {
  if (conservaSlug) return null;
  const canonico = canonicalizarSlug(valor);
  return canonico && canonico !== valor ? canonico : null;
}

/** El slug guardado no sigue el formato actual (y, si no se toca, se conserva así). */
export function esSlugHeredado(slugLeido: string): boolean {
  return !!slugLeido && canonicalizarSlug(slugLeido) !== slugLeido;
}

/** Motivo por el que la pantalla no pudo dibujarse, ya traducido. */
export interface ErrorCarga {
  titulo: string;
  texto: string;
  /** Reintentar no sirve (la ficha o la adopción no existe). */
  definitivo: boolean;
  /** A dónde lleva el botón secundario. */
  volverA: 'fichas' | 'adopciones';
}

/**
 * COMPATIBILIDAD TEMPORAL (backend anterior a `586b670`): el servidor entregó la ficha sin su contenido, así que
 * no hay base para el PUT. No se dibuja el form: guardarlo borraría lo que está guardado.
 */
export const ERROR_FICHA_SIN_CONTENIDO: ErrorCarga = {
  definitivo: true, volverA: 'fichas', titulo: 'Esta ficha todavía no se puede editar', texto: TEXTO_FICHA_SIN_CONTENIDO,
};

/** @param desdeFichas la pantalla se abrió desde las fichas (edición, o alta que elige el trámite) y vuelve ahí. */
export function aErrorDeCarga(err: unknown, isEdit: boolean, desdeFichas: boolean): ErrorCarga {
  const volverA = desdeFichas ? 'fichas' : 'adopciones';
  if (esFichaInexistente(err)) {
    return {
      definitivo: true,
      volverA,
      ...(isEdit
        ? TEXTOS_FICHA_INEXISTENTE
        : { titulo: 'Ese trámite del organismo no existe', texto: 'Puede que el enlace esté mal escrito o que no sea de tu organismo.' }),
    };
  }
  return {
    definitivo: false,
    volverA,
    titulo: isEdit ? 'No pudimos cargar la ficha' : 'No pudimos cargar el formulario',
    texto: 'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
  };
}

/**
 * El trámite del organismo de la ficha no está vigente: el backend va a rechazar el guardado (404). Se avisa
 * arriba del form; si igual se intenta, el error se muestra con texto propio.
 */
export function avisoDeNoVigente(motivo: keyof typeof MOTIVO_NO_VIGENTE, isEdit: boolean): string {
  const accion = isEdit ? 'guardar cambios en esta ficha' : 'crearle fichas';
  return `El trámite del organismo ${MOTIVO_NO_VIGENTE[motivo]}: no vas a poder ${accion} hasta que vuelva a estar vigente. `
    + 'Mientras tanto sus fichas no se ven en el portal, aunque estén publicadas.';
}

/** Texto del botón de envío: dice lo que va a pasar. */
export function textoDeGuardar(isEdit: boolean, seDespublica: boolean): string {
  if (!isEdit) return 'Crear ficha';
  return seDespublica ? 'Guardar y despublicar' : 'Guardar cambios';
}

/** Ayuda del pie, coherente con el botón. */
export function ayudaDelPie(isEdit: boolean, seDespublica: boolean, sinCambios: boolean): string {
  if (!isEdit) return 'La ficha se crea en borrador.';
  if (seDespublica) return 'Al guardar, la ficha se despublica.';
  return sinCambios ? 'Sin cambios para guardar.' : 'Guardar no cambia el estado de publicación.';
}

/** Aviso de éxito del guardado. Guardar normalmente no cambia el estado: si esta vez lo cambió, se dice. */
export function textoDeGuardada(isEdit: boolean, guardada: FichaLocalVM, despublicada: boolean): string {
  if (!isEdit) return 'Ficha creada en borrador. Cuando esté lista, enviala a revisión';
  if (despublicada) {
    return 'Cambios guardados. Como la ficha figuraba publicada y está desactivada, además se despublicó: no se ve en el portal';
  }
  if (!guardada.activa) return 'Cambios guardados. La ficha está desactivada';
  return guardada.estado === 'PUBLICADO' ? 'Cambios guardados. Ya se ven en el portal' : 'Cambios guardados';
}
