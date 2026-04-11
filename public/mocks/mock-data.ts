import { Tramite, Organismo, Modalidad, Etiqueta, PaginatedResponse } from '../models/tramite.model';
import { Usuario } from '../models/usuario.model';
import { UserRole } from '../enums/user-role.enum';
import { DashboardMetrics, TopTramite, TopBusqueda, AuditoriaTramite } from '../models/dashboard.model';

// ── Organismos ──────────────────────────────────────────────
export const MOCK_ORGANISMOS: Organismo[] = [
  { id: 'org-1', nombre: 'Instituto Provincial de Salud (IPS)', sigla: 'IPS', logoUrl: null, sitioWeb: 'https://ips.misiones.gob.ar', parentId: null },
  { id: 'org-2', nombre: 'Registro Provincial de las Personas', sigla: 'RPP', logoUrl: null, sitioWeb: 'https://registro.misiones.gob.ar', parentId: null },
  { id: 'org-3', nombre: 'Dirección General de Rentas', sigla: 'DGR', logoUrl: null, sitioWeb: 'https://rentas.misiones.gob.ar', parentId: null },
  { id: 'org-4', nombre: 'Ministerio de Educación', sigla: 'ME', logoUrl: null, sitioWeb: 'https://educacion.misiones.gob.ar', parentId: null },
  { id: 'org-5', nombre: 'Ministerio de Salud Pública', sigla: 'MSP', logoUrl: null, sitioWeb: 'https://salud.misiones.gob.ar', parentId: null },
  { id: 'org-6', nombre: 'Instituto Provincial de Desarrollo Habitacional', sigla: 'IPRODHA', logoUrl: null, sitioWeb: 'https://iprodha.misiones.gob.ar', parentId: null },
  { id: 'org-7', nombre: 'Ministerio de Trabajo y Empleo', sigla: 'MTE', logoUrl: null, sitioWeb: 'https://trabajo.misiones.gob.ar', parentId: null },
];

// ── Modalidades ─────────────────────────────────────────────
export const MOCK_MODALIDADES: Modalidad[] = [
  { id: 1, nombre: 'Digital' },
  { id: 2, nombre: 'Presencial' },
  { id: 3, nombre: 'Mixto' },
];

// ── Etiquetas ───────────────────────────────────────────────
export const MOCK_ETIQUETAS: Etiqueta[] = [
  { id: 1, nombre: 'Salud', categoria: 'Temática' },
  { id: 2, nombre: 'Educación', categoria: 'Temática' },
  { id: 3, nombre: 'DNI / Identidad', categoria: 'Temática' },
  { id: 4, nombre: 'Impuestos', categoria: 'Temática' },
  { id: 5, nombre: 'Vivienda', categoria: 'Temática' },
  { id: 6, nombre: 'Empleo', categoria: 'Temática' },
  { id: 7, nombre: 'Niñez', categoria: 'Perfil' },
  { id: 8, nombre: 'Jubilados', categoria: 'Perfil' },
  { id: 9, nombre: 'Empresas', categoria: 'Perfil' },
  { id: 10, nombre: 'Emprendedores', categoria: 'Perfil' },
];

// ── Trámites ────────────────────────────────────────────────
export const MOCK_TRAMITES: Tramite[] = [
  {
    id: 'tram-1', titulo: 'Obtener credencial IPS', slug: 'obtener-credencial-ips',
    resumen: 'Solicitud de credencial para afiliados al Instituto Provincial de Salud.',
    descripcionLarga: '¿A quién se dirige?\nA todos los afiliados activos del IPS.\n\nRequisitos:\n- DNI vigente\n- Último recibo de sueldo\n- Foto carnet 4x4\n\nPaso a paso:\n1. Presentarse en la delegación más cercana\n2. Completar el formulario de solicitud\n3. Adjuntar documentación requerida\n4. Retirar la credencial en 15 días hábiles',
    urlOficial: 'https://ips.misiones.gob.ar/credencial', organismoId: 'org-1', modalidadId: 2,
    estado: 'publicado', destacado: true,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[0], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-03-20T14:30:00Z',
  },
  {
    id: 'tram-2', titulo: 'Inscribirse en el Boleto Estudiantil Gratuito (BEEG)', slug: 'inscribirse-beeg',
    resumen: 'Registro para obtener el Boleto Estudiantil Gratuito para estudiantes de Misiones.',
    descripcionLarga: 'El BEEG permite a estudiantes de nivel primario, secundario y terciario viajar gratis en transporte público provincial.',
    urlOficial: 'https://beeg.misiones.gob.ar', organismoId: 'org-4', modalidadId: 1,
    estado: 'publicado', destacado: true,
    etiquetas: [MOCK_ETIQUETAS[1]], organismo: MOCK_ORGANISMOS[3], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-03-18T09:15:00Z',
  },
  {
    id: 'tram-3', titulo: 'Solicitar turno en Registro Civil', slug: 'solicitar-turno-registro-civil',
    resumen: 'Reserva de turnos online para trámites de DNI, partidas y actas.',
    descripcionLarga: null, urlOficial: 'https://turnos.registro.misiones.gob.ar', organismoId: 'org-2', modalidadId: 3,
    estado: 'publicado', destacado: true,
    etiquetas: [MOCK_ETIQUETAS[2]], organismo: MOCK_ORGANISMOS[1], modalidad: MOCK_MODALIDADES[2],
    createdAt: '2026-01-20T12:00:00Z', updatedAt: '2026-03-15T16:45:00Z',
  },
  {
    id: 'tram-4', titulo: 'Consultar deuda de Ingresos Brutos', slug: 'consultar-deuda-iibb',
    resumen: 'Verificar el estado de cuenta y deuda del impuesto sobre Ingresos Brutos.',
    descripcionLarga: null, urlOficial: 'https://rentas.misiones.gob.ar/iibb', organismoId: 'org-3', modalidadId: 1,
    estado: 'publicado', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[3], MOCK_ETIQUETAS[8]], organismo: MOCK_ORGANISMOS[2], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-03-10T11:20:00Z',
  },
  {
    id: 'tram-5', titulo: 'Obtener certificado de residencia', slug: 'obtener-certificado-residencia',
    resumen: 'Tramitación del certificado de residencia provincial para presentaciones ante organismos.',
    descripcionLarga: null, urlOficial: 'https://registro.misiones.gob.ar/residencia', organismoId: 'org-2', modalidadId: 2,
    estado: 'revision', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[2]], organismo: MOCK_ORGANISMOS[1], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-25T08:00:00Z',
  },
  {
    id: 'tram-6', titulo: 'Registrar emprendimiento en el programa PyME Misiones', slug: 'registrar-pyme-misiones',
    resumen: 'Inscripción en el registro provincial de PyMEs para acceder a beneficios fiscales y crediticios.',
    descripcionLarga: null, urlOficial: 'https://pyme.misiones.gob.ar', organismoId: 'org-3', modalidadId: 1,
    estado: 'borrador', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[8], MOCK_ETIQUETAS[9]], organismo: MOCK_ORGANISMOS[2], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-03-20T14:00:00Z', updatedAt: '2026-03-26T10:00:00Z',
  },
  {
    id: 'tram-7', titulo: 'Solicitar plan de vivienda IPRODHA', slug: 'solicitar-vivienda-iprodha',
    resumen: 'Inscripción para acceder a los planes de vivienda del Instituto Provincial de Desarrollo Habitacional.',
    descripcionLarga: null, urlOficial: 'https://iprodha.misiones.gob.ar/planes', organismoId: 'org-6', modalidadId: 2,
    estado: 'publicado', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[4]], organismo: MOCK_ORGANISMOS[5], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-02-10T08:00:00Z', updatedAt: '2026-03-12T15:30:00Z',
  },
  {
    id: 'tram-8', titulo: 'Inscribirse en capacitaciones laborales', slug: 'inscribirse-capacitaciones-laborales',
    resumen: 'Registro en cursos de formación profesional del Ministerio de Trabajo y Empleo.',
    descripcionLarga: null, urlOficial: 'https://trabajo.misiones.gob.ar/capacitaciones', organismoId: 'org-7', modalidadId: 3,
    estado: 'borrador', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[5]], organismo: MOCK_ORGANISMOS[6], modalidad: MOCK_MODALIDADES[2],
    createdAt: '2026-03-22T11:00:00Z', updatedAt: '2026-03-27T09:00:00Z',
  },
  {
    id: 'tram-9', titulo: 'Obtener libreta sanitaria', slug: 'obtener-libreta-sanitaria',
    resumen: 'Trámite para obtener o renovar la libreta sanitaria obligatoria para manipuladores de alimentos.',
    descripcionLarga: null, urlOficial: 'https://salud.misiones.gob.ar/libreta', organismoId: 'org-5', modalidadId: 2,
    estado: 'despublicado', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[4], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-02-28T12:00:00Z',
  },
  {
    id: 'tram-10', titulo: 'Solicitar beca estudiantil provincial', slug: 'solicitar-beca-estudiantil',
    resumen: 'Postulación para becas destinadas a estudiantes de nivel terciario y universitario de Misiones.',
    descripcionLarga: null, urlOficial: 'https://educacion.misiones.gob.ar/becas', organismoId: 'org-4', modalidadId: 1,
    estado: 'publicado', destacado: false,
    etiquetas: [MOCK_ETIQUETAS[1], MOCK_ETIQUETAS[6]], organismo: MOCK_ORGANISMOS[3], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-02-20T09:00:00Z', updatedAt: '2026-03-22T13:00:00Z',
  },
];

// ── Usuarios ────────────────────────────────────────────────
export const MOCK_USUARIOS: Usuario[] = [
  { id: 'usr-1', email: 'admin@misiones.gob.ar', nombre: 'Carlos', apellido: 'Fernández', rol: UserRole.SUPERADMIN, organismoId: null, organismoNombre: '-', activo: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'usr-2', email: 'ips.admin@misiones.gob.ar', nombre: 'María', apellido: 'González', rol: UserRole.ADMIN_ORGANISMO, organismoId: 'org-1', organismoNombre: 'IPS', activo: true, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'usr-3', email: 'registro.admin@misiones.gob.ar', nombre: 'Juan', apellido: 'Pérez', rol: UserRole.ADMIN_ORGANISMO, organismoId: 'org-2', organismoNombre: 'Registro Provincial', activo: true, createdAt: '2026-01-20T00:00:00Z' },
  { id: 'usr-4', email: 'editor.rentas@misiones.gob.ar', nombre: 'Laura', apellido: 'Martínez', rol: UserRole.EDITOR, organismoId: 'org-3', organismoNombre: 'DGR', activo: true, createdAt: '2026-02-01T00:00:00Z' },
  { id: 'usr-5', email: 'editor.edu@misiones.gob.ar', nombre: 'Roberto', apellido: 'Silva', rol: UserRole.EDITOR, organismoId: 'org-4', organismoNombre: 'Min. Educación', activo: false, createdAt: '2026-02-15T00:00:00Z' },
];

// ── Dashboard Metrics ───────────────────────────────────────
export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  totalTramites: 10,
  tramitesPublicados: 5,
  tramitesBorrador: 2,
  tramitesRevision: 1,
  totalOrganismos: 7,
  busquedasHoy: 342,
  busquedasSinResultado: 28,
  satisfaccionPromedio: 4.2,
};

export const MOCK_TOP_TRAMITES: TopTramite[] = [
  { tramiteId: 'tram-2', titulo: 'Inscribirse en el BEEG', consultas: 1250 },
  { tramiteId: 'tram-1', titulo: 'Obtener credencial IPS', consultas: 890 },
  { tramiteId: 'tram-3', titulo: 'Solicitar turno Registro Civil', consultas: 756 },
  { tramiteId: 'tram-4', titulo: 'Consultar deuda IIBB', consultas: 523 },
  { tramiteId: 'tram-7', titulo: 'Solicitar vivienda IPRODHA', consultas: 412 },
  { tramiteId: 'tram-10', titulo: 'Solicitar beca estudiantil', consultas: 387 },
];

export const MOCK_TOP_BUSQUEDAS: TopBusqueda[] = [
  { termino: 'boleto estudiantil', cantidad: 456, sinResultados: false },
  { termino: 'credencial ips', cantidad: 312, sinResultados: false },
  { termino: 'turno dni', cantidad: 289, sinResultados: false },
  { termino: 'ingresos brutos', cantidad: 234, sinResultados: false },
  { termino: 'becas universitarias', cantidad: 198, sinResultados: false },
  { termino: 'certificado antecedentes', cantidad: 167, sinResultados: true },
  { termino: 'licencia de conducir', cantidad: 145, sinResultados: true },
  { termino: 'subsidio gas', cantidad: 89, sinResultados: true },
];

export const MOCK_AUDITORIA: AuditoriaTramite[] = [
  { id: 1, tramiteId: 'tram-6', usuarioId: 'usr-4', accion: 'crear', datosAnteriores: null, datosNuevos: null, fechaAccion: '2026-03-26T10:00:00Z', usuarioNombre: 'Laura Martínez', tramiteTitulo: 'Registrar emprendimiento PyME' },
  { id: 2, tramiteId: 'tram-5', usuarioId: 'usr-3', accion: 'editar', datosAnteriores: null, datosNuevos: null, fechaAccion: '2026-03-25T08:00:00Z', usuarioNombre: 'Juan Pérez', tramiteTitulo: 'Obtener certificado de residencia' },
  { id: 3, tramiteId: 'tram-1', usuarioId: 'usr-2', accion: 'publicar', datosAnteriores: null, datosNuevos: null, fechaAccion: '2026-03-20T14:30:00Z', usuarioNombre: 'María González', tramiteTitulo: 'Obtener credencial IPS' },
];

// ── Helper: paginate ────────────────────────────────────────
export function paginate<T>(items: T[], page = 1, pageSize = 10): PaginatedResponse<T> {
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return {
    data,
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}
