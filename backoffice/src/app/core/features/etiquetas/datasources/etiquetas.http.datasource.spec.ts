import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { EtiquetasHttpDataSource } from './etiquetas.http.datasource';

/** El alta y la edición de etiqueta tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('EtiquetasHttpDataSource', [
  { nombre: 'alta', url: /\/api\/tag$/, pedir: (http) => new EtiquetasHttpDataSource(http).create({ slug: 'salud', organismoId: null }) },
  { nombre: 'edición', url: /\/api\/tag\/x$/, pedir: (http) => new EtiquetasHttpDataSource(http).update('x', { slug: 'salud', organismoId: null }) },
]);
