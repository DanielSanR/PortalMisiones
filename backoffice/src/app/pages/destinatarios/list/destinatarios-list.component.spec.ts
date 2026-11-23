import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';
import { FuenteDePrueba, describeDialogoDeLista, describeLista } from '@shared/utils/testing/lista.testing';
import { DestinatariosListComponent } from './destinatarios-list.component';

const NOMBRES = [
  'Presencial', 'Digital', 'Mixta', 'Telefónica', 'Por correo', 'Con turno', 'Sin turno', 'Itinerante',
  'A domicilio', 'Por ventanilla', 'Digital asistida', 'Por apoderado',
];
const DESTINATARIOS: DestinatarioVM[] = NOMBRES.map((nombre, i) => ({ id: `d-${i + 1}`, nombre }) as DestinatarioVM);
const PERMISOS = ['READ_RECIPIENT', 'CREATE_RECIPIENT', 'UPDATE_RECIPIENT', 'DELETE_RECIPIENT'];

const facade = (fuente: FuenteDePrueba<DestinatarioVM>) => [{
  provide: DestinatariosFacade,
  useValue: { destinatarios$: fuente.filas$, loadDestinatarios: fuente.cargar, delete: fuente.eliminar },
}];

describeLista<DestinatarioVM>({
  titulo: 'DestinatariosListComponent',
  componente: DestinatariosListComponent,
  facade,
  filas: DESTINATARIOS,
  nombre: (m) => m.nombre,
  permisos: PERMISOS,
  contador: (n) => `${n} destinatarios`,
  errorTitulo: 'No pudimos cargar los destinatarios',
  vacio: { titulo: 'Todavía no hay destinatarios', cta: 'Nuevo destinatario' },
  sinCrear: { permisos: ['READ_RECIPIENT'] },
  sinResultados: { texto: 'Ningún destinatario coincide con la búsqueda aplicada.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'digital', esperadas: (m) => m.nombre.toLowerCase().includes('digital') },
  ordenPorNombre: 'Nombre',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: ['READ_RECIPIENT'], principal: null, menu: [] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar el destinatario?', confirmar: 'Sí, eliminar', aviso: 'Destinatario eliminado', foco: true },
});

describeDialogoDeLista<DestinatarioVM, DestinatariosListComponent>({
  titulo: 'DestinatariosListComponent',
  componente: DestinatariosListComponent,
  facade,
  filas: DESTINATARIOS,
  permisos: PERMISOS,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nuevo destinatario', aviso: 'Destinatario creado' },
  editar: { titulo: 'Editar destinatario', aviso: 'Destinatario actualizado' },
});
