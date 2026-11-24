/**
 * Preferencias del backoffice. Son locales: viven en el `localStorage` de este navegador, no en la cuenta
 * (el backend no tiene dónde guardarlas). Los atajos de teclado tienen su propia clave en `AtajosService`.
 */
export type FilasPorPagina = 10 | 20 | 50;
export type Densidad = 'comoda' | 'compacta';
export type DuracionDeAvisos = 'normal' | 'largo' | 'fijo';

export interface Preferencias {
  filasPorPagina: FilasPorPagina;
  densidad: Densidad;
  avisos: DuracionDeAvisos;
  recordarMenuContraido: boolean;
  menuContraido: boolean;
}

/** Valores permitidos de cada preferencia con opciones (para validar lo guardado y armar los controles). */
export const OPCIONES_FILAS_POR_PAGINA: readonly FilasPorPagina[] = [10, 20, 50];
export const OPCIONES_DENSIDAD: readonly Densidad[] = ['comoda', 'compacta'];
export const OPCIONES_AVISOS: readonly DuracionDeAvisos[] = ['normal', 'largo', 'fijo'];

export const PREFERENCIAS_DE_FABRICA: Preferencias = {
  filasPorPagina: 10,
  densidad: 'comoda',
  avisos: 'normal',
  recordarMenuContraido: false,
  menuContraido: false,
};
