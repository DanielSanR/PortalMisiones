import { describeDuplicadoSinDialogoGlobal } from '@core/interceptors/testing/duplicado-sin-dialogo-global.testing';
import { PlantillaFormValue } from '../models/plantilla.vm';
import { PlantillasHttpDataSource } from './plantillas.http.datasource';

const PLANTILLA: PlantillaFormValue = {
  titulo: 'Renovar', slug: 'renovar', resumen: '', descripcionLarga: '', modalidadId: null, categoriaPrincipalId: null,
  categoriaIds: [], etiquetaIds: [], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
};

/** El alta y la edición de plantilla tienen unicidad: un duplicado lo cuenta el formulario, no el diálogo global. */
describeDuplicadoSinDialogoGlobal('PlantillasHttpDataSource', [
  { nombre: 'alta', url: /\/api\/procedure-template$/, pedir: (http) => new PlantillasHttpDataSource(http).create(PLANTILLA) },
  { nombre: 'edición', url: /\/api\/procedure-template\/x$/, pedir: (http) => new PlantillasHttpDataSource(http).update('x', PLANTILLA) },
]);
