import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { CategoriasHttpDataSource } from './categorias.http.datasource';

/** El alta y la edición de categoría tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('CategoriasHttpDataSource', [
  { nombre: 'alta', url: /\/api\/category$/, pedir: (http) => new CategoriasHttpDataSource(http).create({ parentId: null, slug: 'salud', nombre: 'Salud' }) },
  { nombre: 'edición', url: /\/api\/category\/x$/, pedir: (http) => new CategoriasHttpDataSource(http).update('x', { parentId: null, slug: 'salud', nombre: 'Salud' }) },
]);
