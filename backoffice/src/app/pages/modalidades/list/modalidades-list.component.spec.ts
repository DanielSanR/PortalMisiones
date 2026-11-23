import { ModalidadesFacade, ModalidadVM } from '@features/modalidades';
import { FuenteDePrueba, describeDialogoDeLista, describeLista } from '@shared/utils/testing/lista.testing';
import { ModalidadesListComponent } from './modalidades-list.component';

const NOMBRES = [
  'Presencial', 'Digital', 'Mixta', 'Telefónica', 'Por correo', 'Con turno', 'Sin turno', 'Itinerante',
  'A domicilio', 'Por ventanilla', 'Digital asistida', 'Por apoderado',
];
const MODALIDADES: ModalidadVM[] = NOMBRES.map((nombre, i) => ({ id: `m-${i + 1}`, nombre }) as ModalidadVM);
const PERMISOS = ['READ_MODALITY', 'CREATE_MODALITY', 'UPDATE_MODALITY', 'DELETE_MODALITY'];

const facade = (fuente: FuenteDePrueba<ModalidadVM>) => [{
  provide: ModalidadesFacade,
  useValue: { modalidades$: fuente.filas$, loadModalidades: fuente.cargar, delete: fuente.eliminar },
}];

describeLista<ModalidadVM>({
  titulo: 'ModalidadesListComponent',
  componente: ModalidadesListComponent,
  facade,
  filas: MODALIDADES,
  nombre: (m) => m.nombre,
  permisos: PERMISOS,
  contador: (n) => `${n} modalidades`,
  errorTitulo: 'No pudimos cargar las modalidades',
  vacio: { titulo: 'Todavía no hay modalidades', cta: 'Nueva modalidad' },
  sinCrear: { permisos: ['READ_MODALITY'] },
  sinResultados: { texto: 'Ninguna modalidad coincide con la búsqueda.', cta: 'Limpiar búsqueda' },
  busqueda: { termino: 'digital', esperadas: (m) => m.nombre.toLowerCase().includes('digital') },
  ordenPorNombre: 'Nombre',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: ['READ_MODALITY'], principal: null, menu: [] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar la modalidad?', confirmar: 'Sí, eliminar', aviso: 'Modalidad eliminada', foco: true },
});

describeDialogoDeLista<ModalidadVM, ModalidadesListComponent>({
  titulo: 'ModalidadesListComponent',
  componente: ModalidadesListComponent,
  facade,
  filas: MODALIDADES,
  permisos: PERMISOS,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nueva modalidad', aviso: 'Modalidad creada' },
  editar: { titulo: 'Editar modalidad', aviso: 'Modalidad actualizada' },
});
