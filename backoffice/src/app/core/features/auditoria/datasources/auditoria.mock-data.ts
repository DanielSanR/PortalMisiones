import { AuditoriaRegistroDTO } from '../models/auditoria.dto';

/** Registros de ejemplo de auditoría (feature bloqueada por backend; sin endpoint real). */
export const MOCK_AUDITORIA_REGISTROS: AuditoriaRegistroDTO[] = [
  {
    id: 1, tramiteId: 'tram-6', usuarioId: 'usr-4', accion: 'crear',
    datosAnteriores: null,
    datosNuevos: { titulo: 'Registrar emprendimiento en el programa PyME Misiones', estado: 'borrador', modalidadId: 1, organismoId: 'org-3' },
    fechaAccion: '2026-03-26T10:00:00Z', usuarioNombre: 'Laura Martínez', tramiteTitulo: 'Registrar emprendimiento PyME',
  },
  {
    id: 2, tramiteId: 'tram-5', usuarioId: 'usr-3', accion: 'editar',
    datosAnteriores: { resumen: 'Certificado de residencia para trámites varios.' },
    datosNuevos: { resumen: 'Tramitación del certificado de residencia provincial para presentaciones ante organismos.' },
    fechaAccion: '2026-03-25T08:00:00Z', usuarioNombre: 'Juan Pérez', tramiteTitulo: 'Obtener certificado de residencia',
  },
  {
    id: 3, tramiteId: 'tram-5', usuarioId: 'usr-3', accion: 'enviar_revision',
    datosAnteriores: { estado: 'borrador' },
    datosNuevos: { estado: 'revision' },
    fechaAccion: '2026-03-25T09:15:00Z', usuarioNombre: 'Juan Pérez', tramiteTitulo: 'Obtener certificado de residencia',
  },
  {
    id: 4, tramiteId: 'tram-1', usuarioId: 'usr-2', accion: 'publicar',
    datosAnteriores: { estado: 'revision' },
    datosNuevos: { estado: 'publicado' },
    fechaAccion: '2026-03-20T14:30:00Z', usuarioNombre: 'María González', tramiteTitulo: 'Obtener credencial IPS',
  },
  {
    id: 5, tramiteId: 'tram-2', usuarioId: 'usr-1', accion: 'editar',
    datosAnteriores: { titulo: 'Inscribirse en el BEEG', destacado: false },
    datosNuevos: { titulo: 'Inscribirse en el Boleto Estudiantil Gratuito (BEEG)', destacado: true },
    fechaAccion: '2026-03-18T09:15:00Z', usuarioNombre: 'Carlos Fernández', tramiteTitulo: 'Inscribirse en el BEEG',
  },
  {
    id: 6, tramiteId: 'tram-2', usuarioId: 'usr-1', accion: 'publicar',
    datosAnteriores: { estado: 'revision' },
    datosNuevos: { estado: 'publicado' },
    fechaAccion: '2026-03-18T09:30:00Z', usuarioNombre: 'Carlos Fernández', tramiteTitulo: 'Inscribirse en el BEEG',
  },
  {
    id: 7, tramiteId: 'tram-9', usuarioId: 'usr-1', accion: 'despublicar',
    datosAnteriores: { estado: 'publicado' },
    datosNuevos: { estado: 'despublicado' },
    fechaAccion: '2026-02-28T12:00:00Z', usuarioNombre: 'Carlos Fernández', tramiteTitulo: 'Obtener libreta sanitaria',
  },
  {
    id: 8, tramiteId: 'tram-3', usuarioId: 'usr-3', accion: 'editar',
    datosAnteriores: { urlOficial: 'https://registro.misiones.gob.ar/turnos' },
    datosNuevos: { urlOficial: 'https://turnos.registro.misiones.gob.ar' },
    fechaAccion: '2026-03-15T16:45:00Z', usuarioNombre: 'Juan Pérez', tramiteTitulo: 'Solicitar turno en Registro Civil',
  },
  {
    id: 9, tramiteId: 'tram-8', usuarioId: 'usr-1', accion: 'crear',
    datosAnteriores: null,
    datosNuevos: { titulo: 'Inscribirse en capacitaciones laborales', estado: 'borrador', modalidadId: 3, organismoId: 'org-7' },
    fechaAccion: '2026-03-22T11:00:00Z', usuarioNombre: 'Carlos Fernández', tramiteTitulo: 'Inscribirse en capacitaciones laborales',
  },
  {
    id: 10, tramiteId: 'tram-4', usuarioId: 'usr-4', accion: 'editar',
    datosAnteriores: { resumen: 'Consulta de deuda IIBB online.' },
    datosNuevos: { resumen: 'Verificar el estado de cuenta y deuda del impuesto sobre Ingresos Brutos.' },
    fechaAccion: '2026-03-10T11:20:00Z', usuarioNombre: 'Laura Martínez', tramiteTitulo: 'Consultar deuda de Ingresos Brutos',
  },
];
