import { Tramite, Organismo, Modalidad, Etiqueta, EventoDeVida, Localidad, Categoria, Destinatario, TramiteContenidoLocalidad, PaginatedResponse } from '../models/tramite.model';
import { Usuario } from '../models/usuario.model';
import { UserRole } from '../enums/user-role.enum';
import { FeedbackTramite } from '../models/dashboard.model';

// ── Localidades ─────────────────────────────────────────────
export const MOCK_LOCALIDADES: Localidad[] = [
  { id: 1,  nombre: 'Posadas',                  departamento: 'Capital',                         codigoPostal: '3300', activo: true,  tramitesCount: 3 },
  { id: 2,  nombre: 'Garupá',                   departamento: 'Capital',                         codigoPostal: '3304', activo: true,  tramitesCount: 1 },
  { id: 3,  nombre: 'Candelaria',               departamento: 'Candelaria',                      codigoPostal: '3303', activo: true,  tramitesCount: 1 },
  { id: 4,  nombre: 'Oberá',                    departamento: 'Oberá',                           codigoPostal: '3360', activo: true,  tramitesCount: 2 },
  { id: 5,  nombre: 'Campo Viera',              departamento: 'Oberá',                           codigoPostal: '3365', activo: true,  tramitesCount: 0 },
  { id: 6,  nombre: 'Eldorado',                 departamento: 'Eldorado',                        codigoPostal: '3380', activo: true,  tramitesCount: 2 },
  { id: 7,  nombre: 'Montecarlo',               departamento: 'Montecarlo',                      codigoPostal: '3384', activo: true,  tramitesCount: 0 },
  { id: 8,  nombre: 'Puerto Iguazú',            departamento: 'Iguazú',                          codigoPostal: '3370', activo: true,  tramitesCount: 1 },
  { id: 9,  nombre: 'Leandro N. Alem',          departamento: 'Leandro N. Alem',                 codigoPostal: '3315', activo: true,  tramitesCount: 1 },
  { id: 10, nombre: 'Apóstoles',                departamento: 'Apóstoles',                       codigoPostal: '3316', activo: true,  tramitesCount: 1 },
  { id: 11, nombre: 'San Ignacio',              departamento: 'San Ignacio',                     codigoPostal: '3322', activo: true,  tramitesCount: 0 },
  { id: 12, nombre: 'Jardín América',           departamento: 'San Ignacio',                     codigoPostal: '3328', activo: true,  tramitesCount: 0 },
  { id: 13, nombre: 'Aristóbulo del Valle',     departamento: 'Cainguás',                        codigoPostal: '3364', activo: true,  tramitesCount: 0 },
  { id: 14, nombre: 'Puerto Rico',              departamento: 'Libertador General San Martín',   codigoPostal: '3334', activo: true,  tramitesCount: 0 },
  { id: 15, nombre: 'Bernardo de Irigoyen',     departamento: 'General Manuel Belgrano',         codigoPostal: '3378', activo: true,  tramitesCount: 0 },
  { id: 16, nombre: 'El Soberbio',              departamento: '25 de Mayo',                      codigoPostal: '3377', activo: true,  tramitesCount: 0 },
  { id: 17, nombre: 'San Pedro',               departamento: 'San Pedro',                        codigoPostal: '3376', activo: false, tramitesCount: 0 },
  { id: 18, nombre: 'Concepción de la Sierra', departamento: 'Concepción',                       codigoPostal: '3325', activo: true,  tramitesCount: 0 },
  { id: 19, nombre: 'San Javier',              departamento: 'San Javier',                       codigoPostal: '3347', activo: true,  tramitesCount: 0 },
  { id: 20, nombre: 'Alba Posse',              departamento: '25 de Mayo',                       codigoPostal: '3375', activo: true,  tramitesCount: 0 },
];

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
  { id: 1, nombre: 'Digital de punta a punta', descripcion: 'Trámite completamente digital sin instancia presencial', icono: 'computer', color: '#4CAF50', activo: true, tramitesCount: 3 },
  { id: 2, nombre: 'Digital con instancia presencial', descripcion: 'Inicio digital con paso presencial obligatorio', icono: 'swap_horiz', color: '#2196F3', activo: true, tramitesCount: 2 },
  { id: 3, nombre: 'Presencial con apoyo digital', descripcion: 'Trámite presencial con herramientas digitales de soporte', icono: 'storefront', color: '#FF9800', activo: true, tramitesCount: 4 },
  { id: 4, nombre: 'Informativo / derivación', descripcion: 'Solo información y enlace al organismo responsable', icono: 'info', color: '#9C27B0', activo: true, tramitesCount: 1 },
];

// ── Etiquetas (chips transversales del Figma) ──────────────
export const MOCK_ETIQUETAS: Etiqueta[] = [
  { id: 1,  nombre: 'Personas',         slug: 'personas',         icono: 'person',             color: '#2196F3', activo: true, tramitesCount: 5 },
  { id: 2,  nombre: 'Niños',            slug: 'ninos',            icono: 'child_care',         color: '#E91E63', activo: true, tramitesCount: 1 },
  { id: 3,  nombre: 'DNI',              slug: 'dni',              icono: 'badge',              color: '#FF9800', activo: true, tramitesCount: 2 },
  { id: 4,  nombre: 'Salud',            slug: 'salud',            icono: 'health_and_safety',  color: '#4CAF50', activo: true, tramitesCount: 2 },
  { id: 5,  nombre: 'Educación',        slug: 'educacion',        icono: 'school',             color: '#3F51B5', activo: true, tramitesCount: 2 },
  { id: 6,  nombre: 'Alimentos',        slug: 'alimentos',        icono: 'restaurant',         color: '#8BC34A', activo: true, tramitesCount: 1 },
  { id: 7,  nombre: 'Adultos Mayores',  slug: 'adultos-mayores',  icono: 'elderly',            color: '#9C27B0', activo: true, tramitesCount: 0 },
  { id: 8,  nombre: 'Discapacidad',     slug: 'discapacidad',     icono: 'accessible',         color: '#00BCD4', activo: true, tramitesCount: 0 },
  { id: 9,  nombre: 'Reciclaje',        slug: 'reciclaje',        icono: 'recycling',          color: '#4CAF50', activo: true, tramitesCount: 0 },
  { id: 10, nombre: 'Seguridad',        slug: 'seguridad',        icono: 'security',           color: '#F44336', activo: true, tramitesCount: 0 },
  { id: 11, nombre: 'Medio Ambiente',   slug: 'medio-ambiente',   icono: 'eco',                color: '#2E7D32', activo: true, tramitesCount: 0 },
  { id: 12, nombre: 'Jubilaciones',     slug: 'jubilaciones',     icono: 'elderly_woman',      color: '#795548', activo: true, tramitesCount: 0 },
  { id: 13, nombre: 'Cultura',          slug: 'cultura',          icono: 'theater_comedy',     color: '#FF5722', activo: true, tramitesCount: 0 },
  { id: 14, nombre: 'Deportes',         slug: 'deportes',         icono: 'sports_soccer',      color: '#009688', activo: true, tramitesCount: 0 },
  { id: 15, nombre: 'Turismo',          slug: 'turismo',          icono: 'flight',             color: '#03A9F4', activo: true, tramitesCount: 0 },
];

// ── Categorías (árbol de navegación del Figma) ─────────────
export const MOCK_CATEGORIAS: Categoria[] = [
  // Nivel 1 (raíz)
  { id: 1,  nombre: 'Automotor, transporte y tránsito', slug: 'automotor-transporte-transito', descripcion: 'Licencias, infracciones, tasas y permisos vehiculares', icono: 'directions_car', color: '#1565C0', parentId: null, orden: 1, activo: true, tramitesCount: 4 },
  { id: 2,  nombre: 'Denuncias',                        slug: 'denuncias',                     descripcion: 'Denuncias ante organismos provinciales',               icono: 'report',         color: '#C62828', parentId: null, orden: 2, activo: true, tramitesCount: 0 },
  { id: 3,  nombre: 'Jubilaciones y pensiones',         slug: 'jubilaciones-pensiones',         descripcion: 'Trámites previsionales y certificaciones',             icono: 'elderly',        color: '#6A1B9A', parentId: null, orden: 3, activo: true, tramitesCount: 0 },
  { id: 4,  nombre: 'Impuestos, pagos y deudas',        slug: 'impuestos-pagos-deudas',         descripcion: 'Consultas y gestión tributaria provincial',            icono: 'payments',       color: '#E65100', parentId: null, orden: 4, activo: true, tramitesCount: 1 },
  { id: 5,  nombre: 'Actividades comerciales, productivas y de servicio', slug: 'actividades-comerciales', descripcion: 'Registros, habilitaciones y permisos comerciales', icono: 'storefront', color: '#2E7D32', parentId: null, orden: 5, activo: true, tramitesCount: 1 },
  { id: 6,  nombre: 'Educación y becas',                slug: 'educacion-becas',                descripcion: 'Inscripciones, becas y programas educativos',          icono: 'school',         color: '#1565C0', parentId: null, orden: 6, activo: true, tramitesCount: 2 },
  { id: 7,  nombre: 'Salud',                            slug: 'salud',                          descripcion: 'Credenciales, libretas sanitarias y turnos',           icono: 'health_and_safety', color: '#2E7D32', parentId: null, orden: 7, activo: true, tramitesCount: 2 },
  { id: 8,  nombre: 'Vivienda',                         slug: 'vivienda',                       descripcion: 'Planes habitacionales y certificados',                icono: 'house',          color: '#795548', parentId: null, orden: 8, activo: true, tramitesCount: 1 },
  { id: 9,  nombre: 'Trabajo y empleo',                 slug: 'trabajo-empleo',                 descripcion: 'Capacitaciones y programas de inserción laboral',      icono: 'work',           color: '#37474F', parentId: null, orden: 9, activo: true, tramitesCount: 1 },
  { id: 10, nombre: 'Documentación e identidad',        slug: 'documentacion-identidad',        descripcion: 'DNI, partidas, registros civiles',                    icono: 'badge',          color: '#FF8F00', parentId: null, orden: 10, activo: true, tramitesCount: 1 },

  // Nivel 2 — hijos de "Automotor, transporte y tránsito" (id: 1)
  { id: 101, nombre: 'Licencia de conducir',      slug: 'licencia-conducir',      descripcion: null, icono: 'card_membership', color: '#1565C0', parentId: 1, orden: 1, activo: true, tramitesCount: 3 },
  { id: 102, nombre: 'Infracciones',              slug: 'infracciones',           descripcion: null, icono: 'gavel',           color: '#1565C0', parentId: 1, orden: 2, activo: true, tramitesCount: 0 },
  { id: 103, nombre: 'Tasas',                     slug: 'tasas',                  descripcion: null, icono: 'receipt_long',    color: '#1565C0', parentId: 1, orden: 3, activo: true, tramitesCount: 0 },
  { id: 104, nombre: 'Permisos y solicitudes',    slug: 'permisos-solicitudes',   descripcion: null, icono: 'approval',        color: '#1565C0', parentId: 1, orden: 4, activo: true, tramitesCount: 1 },

  // Nivel 2 — hijos de "Impuestos, pagos y deudas" (id: 4)
  { id: 401, nombre: 'Ingresos Brutos',           slug: 'ingresos-brutos',        descripcion: null, icono: 'account_balance', color: '#E65100', parentId: 4, orden: 1, activo: true, tramitesCount: 1 },

  // Nivel 2 — hijos de "Actividades comerciales" (id: 5)
  { id: 501, nombre: 'Registro PyME',             slug: 'registro-pyme',          descripcion: null, icono: 'business_center', color: '#2E7D32', parentId: 5, orden: 1, activo: true, tramitesCount: 1 },
];

// ── Destinatarios (tabs del Figma) ─────────────────────────
export const MOCK_DESTINATARIOS: Destinatario[] = [
  { id: 1, nombre: 'Ciudadanía',                   slug: 'ciudadania',               icono: 'person',           orden: 1, activo: true },
  { id: 2, nombre: 'Organizaciones y empresas',    slug: 'organizaciones-empresas',  icono: 'business',         orden: 2, activo: true },
  { id: 3, nombre: 'Organismos',                   slug: 'organismos',               icono: 'account_balance',  orden: 3, activo: true },
];

// ── Contenido por localidad (overrides) ────────────────────
export const MOCK_CONTENIDO_LOCALIDAD: TramiteContenidoLocalidad[] = [
  // Credencial IPS — Posadas
  { id: 1, tramiteId: 'tram-1', localidadId: 1, localidadNombre: 'Posadas', costos: 'Gratuito para afiliados activos', contacto: 'Av. Roque Pérez N°2398, Posadas\nTel: (0376) 444-7800\nHorario: Lunes a Viernes 7:00 a 13:00', sitioWeb: 'https://ips.misiones.gob.ar/posadas', urlTramite: 'https://ips.misiones.gob.ar/posadas/credencial', horarios: 'Lunes a Viernes 7:00 a 13:00', notas: null, activo: true },
  // Credencial IPS — Oberá
  { id: 2, tramiteId: 'tram-1', localidadId: 4, localidadNombre: 'Oberá', costos: 'Gratuito para afiliados activos', contacto: 'Calle Italia N°520, Oberá\nTel: (03755) 42-1100\nHorario: Lunes a Viernes 7:00 a 12:00', sitioWeb: 'https://ips.misiones.gob.ar/obera', urlTramite: 'https://ips.misiones.gob.ar/obera/credencial', horarios: 'Lunes a Viernes 7:00 a 12:00', notas: null, activo: true },
  // Credencial IPS — Eldorado
  { id: 3, tramiteId: 'tram-1', localidadId: 6, localidadNombre: 'Eldorado', costos: 'Gratuito para afiliados activos', contacto: 'Av. San Martín N°1850, Eldorado\nTel: (03751) 42-2000\nHorario: Lunes a Viernes 7:30 a 12:30', sitioWeb: null, urlTramite: null, horarios: 'Lunes a Viernes 7:30 a 12:30', notas: 'Atención con turno previo únicamente', activo: true },
  // Turno Registro Civil — Posadas
  { id: 4, tramiteId: 'tram-3', localidadId: 1, localidadNombre: 'Posadas', costos: '$5.000 (partida) / $2.500 (turno DNI)', contacto: 'Av. Corrientes N°2231, Posadas\nTel: (0376) 444-3600', sitioWeb: null, urlTramite: 'https://turnos.registro.misiones.gob.ar/posadas', horarios: 'Lunes a Viernes 7:30 a 12:30', notas: null, activo: true },
];

// ── Trámites ────────────────────────────────────────────────
export const MOCK_TRAMITES: Tramite[] = [
  {
    id: 'tram-1', titulo: 'Obtener credencial IPS', slug: 'obtener-credencial-ips',
    resumen: 'Solicitud de credencial para afiliados al Instituto Provincial de Salud.',
    descripcionLarga: '¿A quién se dirige?\nA todos los afiliados activos del IPS.\n\nRequisitos:\n- DNI vigente\n- Último recibo de sueldo\n- Foto carnet 4x4\n\nPaso a paso:\n1. Presentarse en la delegación más cercana\n2. Completar el formulario de solicitud\n3. Adjuntar documentación requerida\n4. Retirar la credencial en 15 días hábiles',
    urlOficial: 'https://ips.misiones.gob.ar/credencial', organismoId: 'org-1', modalidadId: 2, icono: 'health_and_safety',
    estado: 'publicado', destacado: true,
    requisitos: 'DNI vigente\nÚltimo recibo de sueldo\nFoto carnet 4x4', costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[3]], organismo: MOCK_ORGANISMOS[0], modalidad: MOCK_MODALIDADES[1],
    localidades: [{ id: 1, nombre: 'Posadas' }, { id: 4, nombre: 'Oberá' }, { id: 6, nombre: 'Eldorado' }],
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-03-20T14:30:00Z',
  },
  {
    id: 'tram-2', titulo: 'Inscribirse en el Boleto Estudiantil Gratuito (BEEG)', slug: 'inscribirse-beeg',
    resumen: 'Registro para obtener el Boleto Estudiantil Gratuito para estudiantes de Misiones.',
    descripcionLarga: 'El BEEG permite a estudiantes de nivel primario, secundario y terciario viajar gratis en transporte público provincial.',
    urlOficial: 'https://beeg.misiones.gob.ar', organismoId: 'org-4', modalidadId: 1, icono: 'directions_bus',
    estado: 'publicado', destacado: true,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[4]], organismo: MOCK_ORGANISMOS[3], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-03-18T09:15:00Z',
  },
  {
    id: 'tram-3', titulo: 'Solicitar turno en Registro Civil', slug: 'solicitar-turno-registro-civil',
    resumen: 'Reserva de turnos online para trámites de DNI, partidas y actas.',
    descripcionLarga: null, urlOficial: 'https://turnos.registro.misiones.gob.ar', organismoId: 'org-2', modalidadId: 3, icono: 'badge',
    estado: 'publicado', destacado: true,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[2], MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[1], modalidad: MOCK_MODALIDADES[2],
    localidades: [{ id: 1, nombre: 'Posadas' }],
    createdAt: '2026-01-20T12:00:00Z', updatedAt: '2026-03-15T16:45:00Z',
  },
  {
    id: 'tram-4', titulo: 'Consultar deuda de Ingresos Brutos', slug: 'consultar-deuda-iibb',
    resumen: 'Verificar el estado de cuenta y deuda del impuesto sobre Ingresos Brutos.',
    descripcionLarga: null, urlOficial: 'https://rentas.misiones.gob.ar/iibb', organismoId: 'org-3', modalidadId: 1, icono: 'payments',
    estado: 'publicado', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[2], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-03-10T11:20:00Z',
  },
  {
    id: 'tram-5', titulo: 'Obtener certificado de residencia', slug: 'obtener-certificado-residencia',
    resumen: 'Tramitación del certificado de residencia provincial para presentaciones ante organismos.',
    descripcionLarga: null, urlOficial: 'https://registro.misiones.gob.ar/residencia', organismoId: 'org-2', modalidadId: 2, icono: 'contact_page',
    estado: 'revision', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[2], MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[1], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-25T08:00:00Z',
  },
  {
    id: 'tram-6', titulo: 'Registrar emprendimiento en el programa PyME Misiones', slug: 'registrar-pyme-misiones',
    resumen: 'Inscripción en el registro provincial de PyMEs para acceder a beneficios fiscales y crediticios.',
    descripcionLarga: null, urlOficial: 'https://pyme.misiones.gob.ar', organismoId: 'org-3', modalidadId: 1, icono: 'storefront',
    estado: 'borrador', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[2], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-03-20T14:00:00Z', updatedAt: '2026-03-26T10:00:00Z',
  },
  {
    id: 'tram-7', titulo: 'Solicitar plan de vivienda IPRODHA', slug: 'solicitar-vivienda-iprodha',
    resumen: 'Inscripción para acceder a los planes de vivienda del Instituto Provincial de Desarrollo Habitacional.',
    descripcionLarga: null, urlOficial: 'https://iprodha.misiones.gob.ar/planes', organismoId: 'org-6', modalidadId: 2, icono: 'house',
    estado: 'publicado', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[5], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-02-10T08:00:00Z', updatedAt: '2026-03-12T15:30:00Z',
  },
  {
    id: 'tram-8', titulo: 'Inscribirse en capacitaciones laborales', slug: 'inscribirse-capacitaciones-laborales',
    resumen: 'Registro en cursos de formación profesional del Ministerio de Trabajo y Empleo.',
    descripcionLarga: null, urlOficial: 'https://trabajo.misiones.gob.ar/capacitaciones', organismoId: 'org-7', modalidadId: 3, icono: 'work',
    estado: 'borrador', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[0]], organismo: MOCK_ORGANISMOS[6], modalidad: MOCK_MODALIDADES[2],
    createdAt: '2026-03-22T11:00:00Z', updatedAt: '2026-03-27T09:00:00Z',
  },
  {
    id: 'tram-9', titulo: 'Obtener libreta sanitaria', slug: 'obtener-libreta-sanitaria',
    resumen: 'Trámite para obtener o renovar la libreta sanitaria obligatoria para manipuladores de alimentos.',
    descripcionLarga: null, urlOficial: 'https://salud.misiones.gob.ar/libreta', organismoId: 'org-5', modalidadId: 2, icono: 'medical_services',
    estado: 'despublicado', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[3], MOCK_ETIQUETAS[5]], organismo: MOCK_ORGANISMOS[4], modalidad: MOCK_MODALIDADES[1],
    createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-02-28T12:00:00Z',
  },
  {
    id: 'tram-10', titulo: 'Solicitar beca estudiantil provincial', slug: 'solicitar-beca-estudiantil',
    resumen: 'Postulación para becas destinadas a estudiantes de nivel terciario y universitario de Misiones.',
    descripcionLarga: null, urlOficial: 'https://educacion.misiones.gob.ar/becas', organismoId: 'org-4', modalidadId: 1, icono: 'school',
    estado: 'publicado', destacado: false,
    requisitos: null, costos: null, formularios: null, contacto: null, sitioWebTramite: null, categoriaId: null,
    etiquetas: [MOCK_ETIQUETAS[4], MOCK_ETIQUETAS[1]], organismo: MOCK_ORGANISMOS[3], modalidad: MOCK_MODALIDADES[0],
    createdAt: '2026-02-20T09:00:00Z', updatedAt: '2026-03-22T13:00:00Z',
  },
];

// ── Usuarios ────────────────────────────────────────────────
export const MOCK_USUARIOS: Usuario[] = [
  { id: 'usr-1', email: 'admin@misiones.gob.ar', nombre: 'Carlos', apellido: 'Fernández', rol: UserRole.SUPERADMIN, organismoId: null, organismoNombre: '-', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'usr-2', email: 'ips.admin@misiones.gob.ar', nombre: 'María', apellido: 'González', rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-1', organismoNombre: 'IPS', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'usr-3', email: 'registro.admin@misiones.gob.ar', nombre: 'Juan', apellido: 'Pérez', rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-2', organismoNombre: 'Registro Provincial', localidadId: null, localidadNombre: undefined, activo: true, createdAt: '2026-01-20T00:00:00Z' },
  { id: 'usr-4', email: 'editor.rentas@misiones.gob.ar', nombre: 'Laura', apellido: 'Martínez', rol: UserRole.AGENT, organismoId: 'org-3', organismoNombre: 'DGR', localidadId: 1, localidadNombre: 'Posadas', activo: true, createdAt: '2026-02-01T00:00:00Z' },
  { id: 'usr-5', email: 'editor.edu@misiones.gob.ar', nombre: 'Roberto', apellido: 'Silva', rol: UserRole.AGENT, organismoId: 'org-4', organismoNombre: 'Min. Educación', localidadId: null, localidadNombre: undefined, activo: false, createdAt: '2026-02-15T00:00:00Z' },
];

// ── Feedback Ciudadano ───────────────────────────────────────
export const MOCK_FEEDBACK: FeedbackTramite[] = [
  { id: 1,  tramiteId: 'tram-2', tramiteTitulo: 'Inscribirse en el BEEG',               organismoNombre: 'Min. Educación',    esUtil: true,  comentario: 'Muy fácil de hacer, se resolvió en el día.',                          fechaFeedback: '2026-04-10T14:32:00Z' },
  { id: 2,  tramiteId: 'tram-2', tramiteTitulo: 'Inscribirse en el BEEG',               organismoNombre: 'Min. Educación',    esUtil: true,  comentario: null,                                                                   fechaFeedback: '2026-04-09T10:15:00Z' },
  { id: 3,  tramiteId: 'tram-2', tramiteTitulo: 'Inscribirse en el BEEG',               organismoNombre: 'Min. Educación',    esUtil: false, comentario: 'La página tardaba en cargar y no pude completar la solicitud.',         fechaFeedback: '2026-04-08T16:48:00Z' },
  { id: 4,  tramiteId: 'tram-2', tramiteTitulo: 'Inscribirse en el BEEG',               organismoNombre: 'Min. Educación',    esUtil: true,  comentario: null,                                                                   fechaFeedback: '2026-04-07T09:20:00Z' },
  { id: 5,  tramiteId: 'tram-1', tramiteTitulo: 'Obtener credencial IPS',               organismoNombre: 'IPS',               esUtil: true,  comentario: 'Encontré toda la información que necesitaba.',                         fechaFeedback: '2026-04-10T11:05:00Z' },
  { id: 6,  tramiteId: 'tram-1', tramiteTitulo: 'Obtener credencial IPS',               organismoNombre: 'IPS',               esUtil: false, comentario: 'Falta indicar el horario de atención de la delegación.',               fechaFeedback: '2026-04-06T13:30:00Z' },
  { id: 7,  tramiteId: 'tram-1', tramiteTitulo: 'Obtener credencial IPS',               organismoNombre: 'IPS',               esUtil: true,  comentario: null,                                                                   fechaFeedback: '2026-04-05T08:45:00Z' },
  { id: 8,  tramiteId: 'tram-3', tramiteTitulo: 'Solicitar turno en Registro Civil',    organismoNombre: 'Registro Provincial', esUtil: true, comentario: 'Excelente, pude sacar turno en menos de 5 minutos.',                  fechaFeedback: '2026-04-09T17:00:00Z' },
  { id: 9,  tramiteId: 'tram-3', tramiteTitulo: 'Solicitar turno en Registro Civil',    organismoNombre: 'Registro Provincial', esUtil: false, comentario: 'El sistema no me dejó elegir la sede que quería.',                   fechaFeedback: '2026-04-04T10:10:00Z' },
  { id: 10, tramiteId: 'tram-4', tramiteTitulo: 'Consultar deuda de Ingresos Brutos',   organismoNombre: 'DGR',               esUtil: true,  comentario: null,                                                                   fechaFeedback: '2026-04-08T12:00:00Z' },
  { id: 11, tramiteId: 'tram-4', tramiteTitulo: 'Consultar deuda de Ingresos Brutos',   organismoNombre: 'DGR',               esUtil: false, comentario: 'No entendí bien cómo calcular los intereses de mora.',                 fechaFeedback: '2026-04-03T15:22:00Z' },
  { id: 12, tramiteId: 'tram-7', tramiteTitulo: 'Solicitar plan de vivienda IPRODHA',   organismoNombre: 'IPRODHA',           esUtil: true,  comentario: 'Muy completo, explica bien los requisitos.',                           fechaFeedback: '2026-04-07T14:55:00Z' },
  { id: 13, tramiteId: 'tram-10', tramiteTitulo: 'Solicitar beca estudiantil provincial', organismoNombre: 'Min. Educación',  esUtil: true,  comentario: null,                                                                   fechaFeedback: '2026-04-06T09:30:00Z' },
  { id: 14, tramiteId: 'tram-10', tramiteTitulo: 'Solicitar beca estudiantil provincial', organismoNombre: 'Min. Educación',  esUtil: false, comentario: 'La fecha límite no estaba clara en la ficha del trámite.',            fechaFeedback: '2026-04-02T11:40:00Z' },
  { id: 15, tramiteId: 'tram-2', tramiteTitulo: 'Inscribirse en el BEEG',               organismoNombre: 'Min. Educación',    esUtil: true,  comentario: 'Sería útil que indiquen cuántos días tarda la respuesta.',            fechaFeedback: '2026-04-01T16:10:00Z' },
];

// ── Eventos de Vida ─────────────────────────────────────────
export const MOCK_EVENTOS_DE_VIDA: EventoDeVida[] = [
  {
    id: 1, nombre: 'Nacimiento de un hijo', descripcion: 'Trámites relacionados con el nacimiento y primeros años de vida.',
    icono: 'child_care', color: '#E91E63', activo: true, tramitesCount: 2,
    tramites: [{ id: 'tram-1', titulo: 'Obtener credencial IPS' }, { id: 'tram-3', titulo: 'Solicitar turno en Registro Civil' }],
  },
  {
    id: 2, nombre: 'Inscribirse en el sistema educativo', descripcion: 'Acceso a beneficios, becas y programas educativos provinciales.',
    icono: 'school', color: '#2196F3', activo: true, tramitesCount: 2,
    tramites: [{ id: 'tram-2', titulo: 'Inscribirse en el BEEG' }, { id: 'tram-10', titulo: 'Solicitar beca estudiantil provincial' }],
  },
  {
    id: 3, nombre: 'Iniciar un emprendimiento', descripcion: 'Habilitaciones, registros impositivos y programas para nuevos negocios.',
    icono: 'rocket_launch', color: '#009688', activo: true, tramitesCount: 2,
    tramites: [{ id: 'tram-4', titulo: 'Consultar deuda de Ingresos Brutos' }, { id: 'tram-6', titulo: 'Registrar emprendimiento en el programa PyME Misiones' }],
  },
  {
    id: 4, nombre: 'Acceder a una vivienda', descripcion: 'Planes habitacionales y certificados de residencia.',
    icono: 'house', color: '#795548', activo: true, tramitesCount: 2,
    tramites: [{ id: 'tram-5', titulo: 'Obtener certificado de residencia' }, { id: 'tram-7', titulo: 'Solicitar plan de vivienda IPRODHA' }],
  },
  {
    id: 5, nombre: 'Capacitarse y conseguir empleo', descripcion: 'Formación profesional y programas de inserción laboral.',
    icono: 'work', color: '#607D8B', activo: true, tramitesCount: 1,
    tramites: [{ id: 'tram-8', titulo: 'Inscribirse en capacitaciones laborales' }],
  },
  {
    id: 6, nombre: 'Acceder a servicios de salud', descripcion: 'Credenciales, libretas sanitarias y turnos médicos.',
    icono: 'health_and_safety', color: '#4CAF50', activo: false, tramitesCount: 2,
    tramites: [{ id: 'tram-1', titulo: 'Obtener credencial IPS' }, { id: 'tram-9', titulo: 'Obtener libreta sanitaria' }],
  },
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
