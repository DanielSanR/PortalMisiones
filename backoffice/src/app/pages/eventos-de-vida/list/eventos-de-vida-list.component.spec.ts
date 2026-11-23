import { EventosDeVidaFacade, EventoDeVidaVM } from '@features/eventos-de-vida';
import { FuenteDePrueba, describeDialogoDeLista, describeLista } from '@shared/utils/testing/lista.testing';
import { EventosDeVidaListComponent } from './eventos-de-vida-list.component';

const NOMBRES = [
  'Nacimiento', 'Empezar la escuela', 'Mudarme', 'Trabajo nuevo', 'Casarme', 'Tener un hijo', 'Emprender',
  'Jubilarme', 'Perder el trabajo', 'Comprar una casa', 'Empezar la universidad', 'Fallecimiento de un familiar',
];
const EVENTOS: EventoDeVidaVM[] = NOMBRES.map((nombre, i) => ({ id: `e-${i + 1}`, slug: `evento-${i + 1}`, nombre }));
const PERMISOS = ['READ_LIFE_EVENT', 'CREATE_LIFE_EVENT', 'UPDATE_LIFE_EVENT', 'DELETE_LIFE_EVENT'];

const facade = (fuente: FuenteDePrueba<EventoDeVidaVM>) => [{
  provide: EventosDeVidaFacade,
  useValue: { eventos$: fuente.filas$, loadEventos: fuente.cargar, delete: fuente.eliminar },
}];

describeLista<EventoDeVidaVM>({
  titulo: 'EventosDeVidaListComponent',
  componente: EventosDeVidaListComponent,
  facade,
  filas: EVENTOS,
  nombre: (e) => e.nombre,
  permisos: PERMISOS,
  contador: (n) => `${n} eventos de vida`,
  errorTitulo: 'No pudimos cargar los eventos de vida',
  vacio: { titulo: 'Todavía no hay eventos de vida', cta: 'Nuevo evento' },
  sinCrear: { permisos: ['READ_LIFE_EVENT'] },
  sinResultados: { texto: 'Ningún evento de vida coincide con la búsqueda aplicada.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'empezar', esperadas: (e) => e.nombre.toLowerCase().includes('empezar') },
  ordenPorNombre: 'Evento de Vida',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: ['READ_LIFE_EVENT'], principal: null, menu: [] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar el evento de vida?', confirmar: 'Sí, eliminar', aviso: 'Evento de vida eliminado', foco: true },
});

describeDialogoDeLista<EventoDeVidaVM, EventosDeVidaListComponent>({
  titulo: 'EventosDeVidaListComponent',
  componente: EventosDeVidaListComponent,
  facade,
  filas: EVENTOS,
  permisos: PERMISOS,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nuevo evento de vida', aviso: 'Evento de vida creado' },
  editar: { titulo: 'Editar evento de vida', aviso: 'Evento de vida actualizado' },
});
