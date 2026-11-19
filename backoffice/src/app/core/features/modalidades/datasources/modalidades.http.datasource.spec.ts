import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { ModalidadesHttpDataSource } from './modalidades.http.datasource';

/** El alta y la edición de modalidad tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('ModalidadesHttpDataSource', [
  { nombre: 'alta', url: /\/api\/modality$/, pedir: (http) => new ModalidadesHttpDataSource(http).create({ nombre: 'Presencial' }) },
  { nombre: 'edición', url: /\/api\/modality\/x$/, pedir: (http) => new ModalidadesHttpDataSource(http).update('x', { nombre: 'Presencial' }) },
]);
