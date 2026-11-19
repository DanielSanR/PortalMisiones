import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { DestinatariosHttpDataSource } from './destinatarios.http.datasource';

/** El alta y la edición de destinatario tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('DestinatariosHttpDataSource', [
  { nombre: 'alta', url: /\/api\/recipient$/, pedir: (http) => new DestinatariosHttpDataSource(http).create({ nombre: 'Ciudadanos' }) },
  { nombre: 'edición', url: /\/api\/recipient\/x$/, pedir: (http) => new DestinatariosHttpDataSource(http).update('x', { nombre: 'Ciudadanos' }) },
]);
