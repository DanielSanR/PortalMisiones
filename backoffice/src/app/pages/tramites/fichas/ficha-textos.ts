import { Observable } from 'rxjs';
import { PUBLICACION_POLICY } from '@core/constants/policy-overrides.constants';
import { AccionWorkflow, FichaAdopcionResumen, FichaLocalVM, MotivoNoVigente } from '@features/fichas-locales';
import { ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { mensajeErrorAccion } from './ficha-save-error';

/** Cómo se muestra cada acción del workflow (botón, menú de fila, confirmación y aviso de éxito). */
export interface AccionUI {
  label: string;
  /** Ícono Phosphor sin el prefijo `ph-`. */
  icon: string;
  /** Saca la ficha del portal: botón y confirmación en rojo. */
  danger: boolean;
  exito: string;
  confirmTitulo: string;
  confirmBoton: string;
  ocupado: string;
  /** Texto de la confirmación, con el nombre de la ficha. */
  mensaje: (nombre: string) => string;
}

/** Quién revisa y publica, según `PUBLICACION_POLICY.aprobador` (D-3: solo cambia el texto). */
export const QUIEN_PUBLICA = PUBLICACION_POLICY.aprobador === 'provincial'
  ? 'la Subsecretaría de Gobierno Inteligente'
  : 'quien publica en tu organismo';

export const ACCIONES_UI: Record<AccionWorkflow, AccionUI> = {
  'enviar-a-revision': {
    label: 'Enviar a revisión',
    icon: 'paper-plane-tilt',
    danger: false,
    exito: 'Ficha enviada a revisión',
    confirmTitulo: '¿Enviar la ficha a revisión?',
    confirmBoton: 'Sí, enviar',
    ocupado: 'Enviando…',
    mensaje: (nombre) => `${nombre} queda en revisión hasta que ${QUIEN_PUBLICA} la publique. Mientras tanto no se ve en el portal.`,
  },
  publicar: {
    label: 'Publicar',
    icon: 'globe-hemisphere-west',
    danger: false,
    exito: 'Ficha publicada',
    confirmTitulo: '¿Publicar la ficha?',
    confirmBoton: 'Sí, publicar',
    ocupado: 'Publicando…',
    mensaje: (nombre) => `${nombre} se va a ver en el portal en el momento, tal como está ahora.`,
  },
  despublicar: {
    label: 'Despublicar',
    icon: 'eye-slash',
    danger: true,
    exito: 'Ficha despublicada',
    confirmTitulo: '¿Despublicar la ficha?',
    confirmBoton: 'Sí, despublicar',
    ocupado: 'Despublicando…',
    mensaje: (nombre) => `${nombre} deja de verse en el portal. Después la podés republicar sin pasar por revisión.`,
  },
  republicar: {
    label: 'Republicar',
    icon: 'arrow-counter-clockwise',
    danger: false,
    exito: 'Ficha republicada',
    confirmTitulo: '¿Republicar la ficha?',
    confirmBoton: 'Sí, republicar',
    ocupado: 'Republicando…',
    mensaje: (nombre) => `${nombre} vuelve a verse en el portal tal como está ahora, sin pasar por revisión.`,
  },
  'enviar-y-publicar': {
    label: 'Enviar y publicar',
    icon: 'rocket-launch',
    danger: false,
    exito: 'Ficha publicada',
    confirmTitulo: '¿Enviar y publicar la ficha?',
    confirmBoton: 'Sí, publicar',
    ocupado: 'Publicando…',
    mensaje: (nombre) => `${nombre} pasa por revisión y se publica en el mismo paso: se va a ver en el portal en el momento.`,
  },
};

/**
 * Aviso persistente cuando la fuente de fichas y puntos de atención es simulada (mock en memoria, el modo
 * todo-mock de `ng serve`): nada de lo que se cargue llega al servidor. Con la fuente real no se muestra.
 */
export const TEXTO_FUENTE_SIMULADA =
  'Datos de ejemplo: en este modo las fichas y los puntos de atención no se guardan en el servidor. '
  + 'Lo que cargues acá se pierde al recargar la página.';

/** Versión corta para el panel y el diálogo de puntos de atención. */
export const TEXTO_PUNTOS_SIMULADOS =
  'Datos de ejemplo: en este modo los puntos de atención no se guardan en el servidor y se pierden al recargar la página.';

/** Texto de un snackbar de éxito; con fuente simulada aclara que no se guardó en el servidor. */
export function textoExito(texto: string, simulada: boolean): string {
  return simulada ? `${texto} (datos de ejemplo, no se guardó en el servidor)` : texto;
}

/** Nombre legible de una ficha: "Trámite · Localidad" (o el slug si no se pudieron resolver los nombres). */
export function nombreDeFicha(ficha: FichaLocalVM): string {
  const partes = [ficha.plantillaTitulo, ficha.localidadNombre].filter((p): p is string => !!p);
  return partes.length ? partes.join(' · ') : ficha.slug;
}

/** `data` del `ConfirmDialogComponent` para una acción del workflow (listado y detalle). */
export function confirmAccion(
  ficha: FichaLocalVM,
  accion: AccionWorkflow,
  ejecutar: () => Observable<unknown>,
): ConfirmDialogData {
  const ui = ACCIONES_UI[accion];
  const nombre = nombreDeFicha(ficha);
  return {
    title: ui.confirmTitulo,
    message: ui.mensaje(nombre),
    highlight: nombre,
    danger: ui.danger,
    confirmText: ui.confirmBoton,
    busyText: ui.ocupado,
    confirmAction: ejecutar,
    errorDeAccion: mensajeErrorAccion,
  };
}

/**
 * `data` del confirm "Desactivar" (`DELETE` lógico). Si estaba publicada, avisa que queda despublicada
 * (el backend la pasa a `DESPUBLICADO`).
 */
export function confirmDesactivar(ficha: FichaLocalVM, ejecutar: () => Observable<unknown>): ConfirmDialogData {
  const nombre = nombreDeFicha(ficha);
  const publicada = ficha.estado === 'PUBLICADO'
    ? ' Está publicada: al desactivarla queda despublicada y deja de verse en el portal.'
    : '';
  return {
    title: '¿Desactivar la ficha?',
    message: `${nombre} deja de ofrecerse en esa localidad.${publicada} Podés reactivarla editándola; para volver a mostrarla en el portal vas a tener que publicarla de nuevo.`,
    highlight: nombre,
    danger: true,
    confirmText: 'Sí, desactivar',
    busyText: 'Desactivando…',
    confirmAction: ejecutar,
    errorDeAccion: mensajeErrorAccion,
  };
}

/** Fecha corta es-AR (DD/MM/YYYY) para los motivos de vigencia. */
function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Por qué no se le pueden agregar ni editar fichas a un trámite del organismo que no está vigente (sin fechas). */
export const MOTIVO_NO_VIGENTE: Record<MotivoNoVigente, string> = {
  deshabilitada: 'está deshabilitado',
  programada: 'todavía no empezó a regir',
  vencida: 'ya venció',
};

/**
 * Motivo corto, con la fecha, por el que un trámite del organismo no se puede elegir para una ficha
 * ("Empieza a regir el 01/12/2026"). `null` si está vigente.
 */
export function motivoNoElegible(adopcion: Pick<FichaAdopcionResumen, 'motivoNoVigente' | 'vigenteDesde' | 'vigenteHasta'>): string | null {
  switch (adopcion.motivoNoVigente) {
    case 'deshabilitada': return 'Deshabilitado';
    case 'programada': return `Empieza a regir el ${fechaCorta(adopcion.vigenteDesde)}`;
    case 'vencida': return adopcion.vigenteHasta ? `Venció el ${fechaCorta(adopcion.vigenteHasta)}` : 'Ya venció';
    default: return null;
  }
}
