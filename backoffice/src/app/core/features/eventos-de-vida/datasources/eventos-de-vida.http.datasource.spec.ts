import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { EventosDeVidaHttpDataSource } from './eventos-de-vida.http.datasource';

/** El alta y la edición de evento de vida tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('EventosDeVidaHttpDataSource', [
  { nombre: 'alta', url: /\/api\/life-event$/, pedir: (http) => new EventosDeVidaHttpDataSource(http).create({ nombre: 'Nacer' }) },
  { nombre: 'edición', url: /\/api\/life-event\/x$/, pedir: (http) => new EventosDeVidaHttpDataSource(http).update('x', { nombre: 'Nacer' }) },
]);
