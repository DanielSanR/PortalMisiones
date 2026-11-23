import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FieldConfig } from '@core/models/field.interface';
import {
  FichaFormData, FichaLocalFormValue, FichaLocalVM, MAX_SLUG, errorDeLocalidad, errorDeUrl, reactivacionDuplicada,
  slugRepetido, slugSinContenido,
} from '@features/fichas-locales';

/**
 * Los campos del formulario de ficha: su descripción (etiqueta y mensajes), sus controles con los validadores, y
 * el pasaje ficha → form → valor a guardar. Las reglas son del dominio (`@features/fichas-locales`); acá solo se
 * adaptan a `ValidatorFn`. El `FormGroup` lo arma el componente (única excepción al dynamic form en esta sección).
 */

export type CampoConResumen = 'adopcion' | 'localidadId' | 'slug' | 'url' | 'activa';

/**
 * Los campos que validan, descritos como los de `app-dynamic-form`: así el mensaje de cada error sale
 * de `form-error-messages.util` (un solo lugar para el `<mat-error>` del campo y el banner resumen).
 * `mensajes` trae el texto de los validadores propios de esta pantalla.
 */
export const CAMPOS: Record<CampoConResumen, FieldConfig> = {
  adopcion: {
    name: 'adopcion', label: 'Trámite del organismo', type: 'tree-select',
    validations: { mensajes: { required: 'Elegí el trámite del organismo' } },
  },
  localidadId: {
    name: 'localidadId', label: 'Localidad', type: 'select',
    validations: {
      mensajes: {
        required: 'Elegí una localidad',
        localidadOcupada: 'Esa localidad ya tiene una ficha de este trámite',
        localidadDesactivada: 'Esa localidad ya tiene una ficha desactivada de este trámite: reactivala en vez de crear otra',
      },
    },
  },
  slug: {
    name: 'slug', label: 'Slug', type: 'text',
    validations: {
      maxLength: MAX_SLUG,
      mensajes: { required: 'El slug es obligatorio', slugRepetido: 'Ya lo usa otra ficha. Elegí otro.' },
    },
  },
  url: {
    name: 'url', label: 'URL', type: 'url',
    validations: {
      mensajes: {
        urlEsquema: 'Tiene que empezar con https:// (o http://). Ej.: https://www.misiones.gob.ar',
        urlEspacios: 'No puede tener espacios: revisá la dirección',
        urlIncompleta: 'Falta el sitio después de https://. Ej.: https://www.misiones.gob.ar',
      },
    },
  },
  activa: {
    name: 'activa', label: 'Activa', type: 'checkbox',
    validations: { mensajes: { reactivaDuplicada: 'La localidad ya tiene otra ficha activa de este trámite' } },
  },
};

/** Por qué el interruptor "Ficha activa" no se puede apagar en una ficha publicada (tooltip y texto de ayuda). */
export const MOTIVO_ACTIVA_BLOQUEADA =
  'Está publicada: para desactivarla usá "Desactivar" en el detalle de la ficha, que además la quita del portal.';

/** Lo que los validadores de duplicados necesitan de la pantalla. Se lee en cada validación: cambia con la carga. */
export interface ContextoDeValidacion {
  isEdit: boolean;
  datos: FichaFormData | null;
}

const error = (clave: string | null | false): ValidationErrors | null => (clave ? { [clave]: true } : null);
const texto = (control: AbstractControl): string => String(control.value ?? '');

const slugUtilizable: ValidatorFn = (control) => error(slugSinContenido(texto(control)) && 'slugVacio');
const urlValida: ValidatorFn = (control) => error(errorDeUrl(texto(control)));

/**
 * Controles del formulario. Los validadores de duplicados leen `contexto()` (lo ocupado por las demás fichas):
 * - localidad, solo en alta (en edición no cambia): ya tiene ficha de esta adopción, activa o desactivada;
 * - slug: lo usa otra ficha;
 * - activa, solo en edición: reactivarla dejaría dos fichas activas en la localidad.
 */
export function controlesDeFicha(contexto: () => ContextoDeValidacion) {
  const ocupadas = () => contexto().datos?.ocupadas;
  const localidadLibre: ValidatorFn = (control) => {
    const libres = ocupadas();
    return contexto().isEdit || !libres ? null : error(errorDeLocalidad(texto(control), libres));
  };
  const slugLibre: ValidatorFn = (control) => {
    const libres = ocupadas();
    return error(!!libres && slugRepetido(texto(control), libres) && 'slugRepetido');
  };
  const reactivable: ValidatorFn = (control) => {
    const { isEdit, datos } = contexto();
    if (!isEdit || !datos?.ficha || !control.value) return null;
    return error(reactivacionDuplicada(datos.ficha, datos.ocupadas) && 'reactivaDuplicada');
  };
  return {
    /** Solo en alta sin `?adopcion=`: el trámite del organismo del que cuelga la ficha. Deshabilitado en el resto. */
    adopcion: new FormControl('', { nonNullable: true, validators: Validators.required }),
    localidadId: new FormControl('', { nonNullable: true, validators: [Validators.required, localidadLibre] }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SLUG), slugUtilizable, slugLibre],
    }),
    url: new FormControl('', { nonNullable: true, validators: urlValida }),
    requisitos: new FormControl('', { nonNullable: true }),
    costos: new FormControl('', { nonNullable: true }),
    activa: new FormControl(true, { nonNullable: true, validators: reactivable }),
  };
}

export type ControlesDeFicha = ReturnType<typeof controlesDeFicha>;
export type FichaForm = FormGroup<ControlesDeFicha>;

/**
 * Carga la ficha leída en el form (queda pristine) y fija la localidad: cambiarla sería otra ficha. Se edita sobre
 * lo que devolvió el `GET`: el PUT es total y viajan todos los campos.
 */
export function volcarFicha(form: FichaForm, ficha: FichaLocalVM): void {
  form.reset({
    localidadId: ficha.localidadId,
    slug: ficha.slug,
    url: ficha.url ?? '',
    requisitos: ficha.requisitos ?? '',
    costos: ficha.costos ?? '',
    activa: ficha.activa,
  });
  form.controls.localidadId.disable();
}

/** Re-ejecuta los validadores de esos controles sin emitir: leen datos de la pantalla que acaban de cambiar. */
export function revalidar(form: FichaForm, ...campos: (keyof ControlesDeFicha)[]): void {
  for (const campo of campos) form.controls[campo].updateValueAndValidity({ emitEvent: false });
}

/**
 * Lo que se guarda. `getRawValue`: la localidad (y a veces "activa") están deshabilitadas y viajan igual.
 * `slugLeido` no nulo = el slug no se tocó en edición: viaja tal cual se leyó (`conservarSlug`), sin
 * re-canonicalizar un slug heredado.
 */
export function aValorDeFicha(form: FichaForm, adopcionId: string, slugLeido: string | null): FichaLocalFormValue {
  const valor = form.getRawValue();
  const conservarSlug = slugLeido !== null;
  return {
    adopcionId,
    localidadId: valor.localidadId,
    slug: conservarSlug ? slugLeido : valor.slug,
    conservarSlug,
    url: valor.url,
    requisitos: valor.requisitos,
    costos: valor.costos,
    activa: valor.activa,
  };
}
