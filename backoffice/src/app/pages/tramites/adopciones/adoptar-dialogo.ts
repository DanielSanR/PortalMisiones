import { map } from 'rxjs';
import { FieldConfig } from '@core/models/field.interface';
import { finDelDia, hoy, inicioDelDia } from '@core/utils/fecha.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { AdopcionFormValue, AdopcionOpciones, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { FormDialogData } from '@shared/components/form-dialog';
import { CONFLICTOS_ADOPCION, FALLBACK_ADOPCION } from './adopcion-save-error';

/** Vigencia de una adopción: días (ver `rangoDeVigencia` para cómo se mandan). */
export interface Vigencia {
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

const esFecha = (valor: unknown): valor is Date => valor instanceof Date;
const MAL_ESCRITA = 'Escribí la fecha como DD/MM/AAAA';

/**
 * "Hasta" no puede ser un día anterior a "desde". El mismo día vale: la vigencia va de 00:00:00 a
 * 23:59:59, y el backend solo exige `effectiveTo > effectiveFrom` (si no, `4012`).
 */
export function motivoDeHasta(hasta: unknown, desde: unknown): string | null {
  if (!esFecha(hasta) || !esFecha(desde)) return null;
  return inicioDelDia(hasta).getTime() >= inicioDelDia(desde).getTime() ? null : 'No puede ser anterior a la fecha de inicio';
}

/**
 * "Vigente desde" (obligatoria) y "Vigente hasta" (opcional, no anterior) con datepicker es-AR (DD/MM/AAAA).
 * Los comparten el diálogo "Adoptar trámite" y la edición del detalle. `desde` es el valor con el que abre
 * un alta; en la edición los valores llegan por `initialData`.
 */
export function camposDeVigencia(desde: Date | null = null): FieldConfig[] {
  return [
    {
      name: 'vigenteDesde',
      label: 'Vigente desde',
      type: 'datepicker',
      cssClass: 'colspan-half',
      hint: 'Desde el comienzo de ese día.',
      ...(desde ? { value: desde } : {}),
      fecha: { botonCalendario: 'Elegir la fecha de inicio' },
      validations: { required: true, mensajes: { required: 'Es obligatoria', matDatepickerParse: MAL_ESCRITA } },
    },
    {
      name: 'vigenteHasta',
      label: 'Vigente hasta',
      type: 'datepicker',
      cssClass: 'colspan-half',
      opcional: true,
      hint: 'Hasta el final de ese día. Vacío = sin fecha de fin.',
      fecha: { minDe: 'vigenteDesde', botonCalendario: 'Elegir la fecha de fin', quitar: 'Quitar la fecha de fin' },
      validations: {
        mensajes: { matDatepickerParse: MAL_ESCRITA },
        validarCon: { campos: ['vigenteDesde'], validar: (hasta, valores) => motivoDeHasta(hasta, valores['vigenteDesde']) },
      },
    },
  ];
}

/**
 * Lo que se manda al backend (el PUT es total). Un campo editado va al borde de su día: desde a las
 * 00:00:00, hasta a las 23:59:59 (inclusive). Un campo SIN tocar (`sinTocar`) reenvía el valor `original`
 * con su hora exacta: si no, guardar solo "Habilitado" podía mover la vigencia de una adopción cargada con
 * otras horas (p. ej. un fin a las 00:00 pasaba a 23:59:59, un día más).
 */
export function rangoDeVigencia(
  valor: Record<string, unknown>,
  original?: Vigencia,
  sinTocar: { desde: boolean; hasta: boolean } = { desde: false, hasta: false },
): Vigencia {
  const desde = valor['vigenteDesde'];
  const hasta = valor['vigenteHasta'];
  return {
    vigenteDesde: original && sinTocar.desde ? original.vigenteDesde : inicioDelDia(desde as Date),
    vigenteHasta: original && sinTocar.hasta ? original.vigenteHasta : esFecha(hasta) ? finDelDia(hasta) : null,
  };
}

/**
 * Campos de "Adoptar trámite": plantilla activa + organismo + vigencia. Con una sesión de organismo
 * (`opciones.organismoFijo`) el organismo viene como dato de solo lectura, enfocable y con el motivo.
 */
export function camposDeAdoptar(opciones: AdopcionOpciones): FieldConfig[] {
  const fijo = opciones.organismoFijo;
  const SIN_PLANTILLAS = 'No hay plantillas activas para adoptar.';
  const SIN_ORGANISMOS = 'No hay organismos activos disponibles.';
  return [
    {
      name: 'plantillaId',
      label: 'Plantilla provincial',
      type: 'select',
      placeholder: 'Elegí una plantilla',
      ...(opciones.plantillas.length ? {} : { hint: SIN_PLANTILLAS }),
      options: opciones.plantillas.map((p) => ({ id: p.id, name: p.nombre })),
      optionsLoaded: true,
      emptyOptionsMessage: SIN_PLANTILLAS,
      validations: { required: true, mensajes: { required: 'Elegí una plantilla' } },
    },
    fijo
      ? {
          name: 'organismoId',
          label: 'Organismo',
          type: 'select',
          readonly: true,
          value: fijo.id,
          hint: fijo.motivo,
          options: [{ id: fijo.id, name: fijo.nombre }],
          optionsLoaded: true,
        }
      : {
          name: 'organismoId',
          label: 'Organismo',
          type: 'select',
          placeholder: 'Elegí un organismo',
          ...(opciones.organismos.length ? {} : { hint: SIN_ORGANISMOS }),
          options: opciones.organismos.map((o) => ({ id: o.id, name: o.nombre })),
          optionsLoaded: true,
          emptyOptionsMessage: SIN_ORGANISMOS,
          validations: { required: true, mensajes: { required: 'Elegí un organismo' } },
        },
    ...camposDeVigencia(hoy()),
  ];
}

/**
 * Configuración del diálogo "Adoptar trámite" (`FormDialogComponent`). Solo se abre con `ADOPTAR_ACCESS`
 * (P-2: hace falta `READ_ORGANISM` para elegir el organismo, o tener uno propio en la sesión). Queda
 * abierto mientras guarda y, si el backend rechaza (`4080` solapamiento, `4012`, `4073`), cuenta el motivo
 * ahí mismo para corregir y reintentar. `afterClosed()` emite la adopción creada, o `undefined` si se canceló.
 */
export function dialogoDeAdoptar(facade: AdopcionesFacade): FormDialogData<AdopcionVM> {
  /** Organismo impuesto por la sesión (se conoce al cargar; cada "Reintentar" lo vuelve a leer). */
  let organismoFijoId: string | null = null;
  return {
    titulo: 'Adoptar trámite',
    subtitulo: 'El organismo ofrece una plantilla provincial durante el período que elijas.',
    textoGuardar: 'Adoptar',
    textoGuardando: 'Adoptando…',
    textoCargando: 'Cargando plantillas y organismos…',
    tituloDeError: 'No se pudo adoptar',
    mensajeDescartar: 'Hay datos sin guardar. Si cerrás ahora no se adopta el trámite.',
    formId: 'adoptar-dialog-form',
    cargar: () => facade.getOpcionesAdoptar().pipe(
      map((opciones) => {
        organismoFijoId = opciones.organismoFijo?.id ?? null;
        return { fields: camposDeAdoptar(opciones) };
      }),
    ),
    errorDeCarga: () => ({
      titulo: 'No pudimos cargar el formulario',
      texto: 'Faltan las plantillas o los organismos. Revisá tu conexión e intentá de nuevo.',
      reintentable: true,
    }),
    guardar: (valor) => {
      const adopcion: AdopcionFormValue = {
        plantillaId: String(valor['plantillaId'] ?? ''),
        organismoId: organismoFijoId ?? String(valor['organismoId'] ?? ''),
        organismoTitularId: null,
        habilitada: true,
        ...rangoDeVigencia(valor),
      };
      return facade.adoptar(adopcion);
    },
    errorDeGuardado: (err, form) => aplicarErrorDeGuardado(err, form, CONFLICTOS_ADOPCION, FALLBACK_ADOPCION),
  };
}
