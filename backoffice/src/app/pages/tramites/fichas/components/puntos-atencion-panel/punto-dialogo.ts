import { FieldConfig } from '@core/models/field.interface';
import { PuntoAtencionFormValue, PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';
import { TEXTO_PUNTOS_SIMULADOS } from '@pages/tramites/fichas/ficha-textos';
import { MAX_DECIMALES, errorDeCoordenada, formatearCoordenada, parsearCoordenada } from './coordenadas';
import { DatosDeUbicacion, PuntoUbicacionComponent } from './punto-ubicacion/punto-ubicacion.component';
import { TEXTO_AYUDA_UBICAR } from './punto-ubicacion/punto-ubicacion-textos';
import { FALLBACK_PUNTO, puntoErrorGuardado } from './punto-save-error';

/** Largo razonable de los textos cortos (la base es VARCHAR/TEXT sin límite). */
const MAX_NOMBRE = 255;

/** Una coordenada escrita a mano (coma o punto decimal), con el rango y los textos que le tocan. */
function campoDeCoordenada(name: 'latitud' | 'longitud', label: string, limite: number, ejemplo: string): FieldConfig {
  const articulo = name === 'latitud' ? 'La latitud' : 'La longitud';
  const mensajes = {
    numero: `Escribí un número (ej: ${ejemplo})`,
    rango: `Tiene que estar entre -${limite} y ${limite}`,
    decimales: `Hasta ${MAX_DECIMALES} decimales`,
  };
  return {
    name,
    label,
    type: 'text',
    cssClass: 'colspan-half',
    inputMode: 'decimal',
    // No es un dato de quien lo carga: que el navegador no ofrezca coordenadas (o cualquier número) ya escritas.
    autocomplete: 'off',
    placeholder: `Ej: ${ejemplo}`,
    hint: `Entre -${limite} y ${limite}, hasta ${MAX_DECIMALES} decimales. Se completa al marcar el mapa.`,
    validations: {
      required: true,
      mensajes: { required: `${articulo} es obligatoria` },
      validar: (valor) => {
        const error = errorDeCoordenada(valor, -limite, limite);
        return error ? mensajes[error] : null;
      },
    },
  };
}

/**
 * Campos de un punto de atención (PLAN_TRAMITES_API.md §4.4, P-8), en tres secciones:
 * - **Datos del punto**: nombre.
 * - **Ubicación**: dirección; "Ubicar en el mapa" + el mapa interactivo (campo `vista` que ESCRIBE latitud y
 *   longitud: `vista.escribe`); y latitud/longitud a mano como alternativa (validadas en rango y con hasta 6
 *   decimales; el mapper las redondea a 6 antes de enviar). El backend las exige (`@NotNull`): no hay "quitar".
 * - **Horarios y contacto**: horarios, contacto y, en edición, "Activo" (reactiva un punto desactivado).
 * Con la fuente simulada, un aviso arriba dice que no se guarda en el servidor. `localidad` (de la ficha) completa
 * la búsqueda por dirección y centra el mapa en un alta.
 */
export function camposDePunto(esEdicion: boolean, fuenteSimulada: boolean, localidad: string | null = null): FieldConfig[] {
  const aviso: FieldConfig[] = fuenteSimulada
    ? [{ name: '_fuente_simulada', label: '', type: 'tip', tono: 'alerta', placeholder: TEXTO_PUNTOS_SIMULADOS }]
    : [];
  const activo: FieldConfig[] = esEdicion
    ? [{
        name: 'activo',
        label: 'Activo',
        type: 'checkbox',
        aviso: (valor) => (valor ? null : { texto: 'Desactivado, deja de mostrarse en la ficha.' }),
      }]
    : [];
  const datosDeUbicacion: DatosDeUbicacion = { localidad };
  return [
    ...aviso,
    { name: '_seccion_datos', label: 'Datos del punto', type: 'section-header' },
    {
      name: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Ej: Centro de Emisión de Licencias',
      validations: { required: true, maxLength: MAX_NOMBRE, mensajes: { required: 'El nombre es obligatorio' } },
    },
    { name: '_seccion_ubicacion', label: 'Ubicación', type: 'section-header', placeholder: TEXTO_AYUDA_UBICAR },
    {
      name: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Ej: Av. Uruguay 3150',
      autocomplete: 'off',
      validations: { required: true, mensajes: { required: 'La dirección es obligatoria' } },
    },
    {
      name: '_ubicacion',
      label: 'Ubicación en el mapa',
      type: 'vista',
      vista: { componente: PuntoUbicacionComponent, datos: datosDeUbicacion, escribe: ['latitud', 'longitud'] },
    },
    campoDeCoordenada('latitud', 'Latitud', 90, '-27,367104'),
    campoDeCoordenada('longitud', 'Longitud', 180, '-55,896108'),
    { name: '_seccion_contacto', label: 'Horarios y contacto', type: 'section-header' },
    { name: 'horarios', label: 'Horarios', type: 'textarea', opcional: true, filas: 2, placeholder: 'Ej: Lunes a viernes de 7 a 13' },
    { name: 'contacto', label: 'Contacto', type: 'textarea', opcional: true, filas: 2, placeholder: 'Teléfono, correo…' },
    ...activo,
  ];
}

/**
 * Configuración del diálogo de alta/edición de un punto de atención (`FormDialogComponent`). `punto` null
 * = alta. `localidad`: nombre de la localidad de la ficha (para ubicar la dirección y centrar el mapa). Queda
 * abierto mientras guarda y, si el backend rechaza, cuenta el motivo ahí mismo (siempre con texto propio:
 * `puntoErrorGuardado`). `afterClosed()` emite el punto guardado, o `undefined` si se canceló.
 */
export function dialogoDePunto(
  facade: PuntosAtencionFacade,
  fichaId: string,
  punto: PuntoAtencionVM | null,
  localidad: string | null = null,
): FormDialogData<PuntoAtencionVM> {
  const esEdicion = !!punto;
  return {
    ...formDialogEstatico<PuntoAtencionVM>({
      titulo: esEdicion ? 'Editar punto de atención' : 'Agregar punto de atención',
      subtitulo: 'Dónde se hace el trámite en esta localidad. Se muestra en la ficha del portal.',
      textoGuardar: esEdicion ? 'Guardar cambios' : 'Agregar',
      requiereCambios: esEdicion,
      mensajeDescartar: esEdicion
        ? 'Hay cambios sin guardar en este punto de atención. Si cerrás ahora se pierden.'
        : 'Hay datos sin guardar. Si cerrás ahora no se agrega el punto de atención.',
      formId: 'punto-dialog-form',
      fields: camposDePunto(esEdicion, facade.fuenteSimulada, localidad),
      initialData: {
        nombre: punto?.nombre ?? '',
        direccion: punto?.direccion ?? '',
        latitud: formatearCoordenada(punto?.latitud ?? null),
        longitud: formatearCoordenada(punto?.longitud ?? null),
        horarios: punto?.horarios ?? '',
        contacto: punto?.contacto ?? '',
        activo: punto?.activo ?? true,
      },
      guardar: (valor) => {
        const form: PuntoAtencionFormValue = {
          fichaId,
          nombre: String(valor['nombre'] ?? ''),
          direccion: String(valor['direccion'] ?? ''),
          contacto: String(valor['contacto'] ?? ''),
          horarios: String(valor['horarios'] ?? ''),
          // Validadas por el formulario: no son null.
          latitud: parsearCoordenada(String(valor['latitud'] ?? '')) as number,
          longitud: parsearCoordenada(String(valor['longitud'] ?? '')) as number,
          // En el alta no hay interruptor: el punto nace activo.
          activo: esEdicion ? valor['activo'] !== false : true,
        };
        return punto ? facade.update(punto.id, form) : facade.create(form);
      },
      fallback: FALLBACK_PUNTO,
    }),
    // Siempre un texto propio (403, 4012, 4073, 5xx…): nunca el `message` del backend.
    errorDeGuardado: puntoErrorGuardado,
  };
}
