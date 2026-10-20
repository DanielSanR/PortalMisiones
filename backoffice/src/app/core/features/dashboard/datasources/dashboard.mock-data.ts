import { DashboardHomeDTO } from '../models/dashboard.dto';

/** Datos de ejemplo del Home (placeholder honesto — sin backend real, ver HOME_REDISENO.md §2). */
export const MOCK_DASHBOARD_HOME: DashboardHomeDTO = {
  queueItems: [
    { titulo: 'Renovación de licencia de conducir', organismo: 'Dirección de Tránsito',    tiempo: 'hace 2 días', slaLabel: '6 días', slaLevel: 'danger' },
    { titulo: 'Certificado de antecedentes',         organismo: 'Ministerio de Seguridad',  tiempo: 'hace 1 día',  slaLabel: '3 días', slaLevel: 'warning' },
    { titulo: 'Inscripción a becas provinciales',     organismo: 'Ministerio de Educación',  tiempo: 'hoy',         slaLabel: '1 día',  slaLevel: 'success' },
  ],

  myQueueItems: [
    { titulo: 'Turno médico — especialidades',    organismo: 'Hospital Escuela', faltantes: ['requisitos', 'costo'] },
    { titulo: 'Certificado de discapacidad',       organismo: 'Hospital Escuela', faltantes: ['documentación'] },
  ],

  // Conteos; el mapper deriva los porcentajes (64 / 14 / 17 / 5 sobre 529).
  pipelineSegments: [
    { label: 'Publicados',     value: 337, color: 'success' },
    { label: 'En revisión',    value: 74,  color: 'info' },
    { label: 'Borrador',       value: 92,  color: 'warning' },
    { label: 'Despublicados',  value: 26,  color: 'error' },
  ],

  mineItems: [
    { label: 'Publicadas', value: 14, color: 'success' },
    { label: 'Borrador',   value: 5,  color: 'warning' },
    { label: 'Sin datos',  value: 3,  color: 'error' },
    { label: 'Contactos',  value: 8,  color: 'info' },
  ],

  visitsTotal: 96031,
  visitsAvgPerDay: 3098,
  visitsDaily: [
    38, 42, 35, 51, 47, 60, 55, 44, 39, 58,
    62, 49, 53, 67, 71, 60, 58, 64, 70, 75,
    68, 72, 80, 77, 66, 73, 85, 90, 88, 95, 100,
  ],

  orgBars: [
    { organismo: 'Min. de Salud Pública',   publicadosPercent: 72, otrosPercent: 28, total: 82 },
    { organismo: 'Dirección de Tránsito',   publicadosPercent: 65, otrosPercent: 35, total: 74 },
    { organismo: 'Min. de Educación',       publicadosPercent: 80, otrosPercent: 20, total: 61 },
    { organismo: 'Min. de Seguridad',       publicadosPercent: 55, otrosPercent: 45, total: 58 },
    { organismo: 'IPS Misiones',            publicadosPercent: 90, otrosPercent: 10, total: 47 },
    { organismo: 'Min. de Desarrollo Social', publicadosPercent: 60, otrosPercent: 40, total: 39 },
    { organismo: 'Registro Civil',          publicadosPercent: 85, otrosPercent: 15, total: 33 },
    { organismo: 'Dirección de Rentas',     publicadosPercent: 70, otrosPercent: 30, total: 28 },
  ],

  searchesWithoutResults: [
    { termino: 'licencia de conducir',       cantidad: 1284 },
    { termino: 'certificado de discapacidad', cantidad: 812 },
    { termino: 'turno médico',                cantidad: 645 },
    { termino: 'cédula de identidad',         cantidad: 511 },
    { termino: 'boleto estudiantil',          cantidad: 398 },
  ],

  // Conteos; el mapper deriva el % relativo al más consultado (100 / 74 / 61 / 47 / 34).
  topTramites: [
    { titulo: 'Cédula de identidad — renovación',       consultas: 8420 },
    { titulo: 'Certificado de antecedentes penales',    consultas: 6210 },
    { titulo: 'Licencia de conducir — renovación',      consultas: 5100 },
    { titulo: 'Inscripción escolar',                    consultas: 3980 },
    { titulo: 'Turno médico — especialidades',          consultas: 2870 },
  ],

  feedbackItems: [
    { sentimiento: 'negativo', texto: 'No encontré cómo sacar turno para el hospital.',              meta: 'Turno médico · Hospital Escuela · hace 3 h' },
    { sentimiento: 'neutral',  texto: 'El trámite estaba bien pero faltaba el teléfono de contacto.', meta: 'Certificado de antecedentes · Min. de Seguridad · hace 5 h' },
    { sentimiento: 'positivo', texto: 'Muy claro, lo resolví en minutos.',                             meta: 'Licencia de conducir · Dirección de Tránsito · hace 1 día' },
  ],

  activityItems: [
    { actor: 'M. Rodríguez', accion: 'publicó',          objeto: 'Renovación de licencia de conducir', fecha: 'hace 20 min' },
    { actor: 'L. Fernández', accion: 'envió a revisión',  objeto: 'Certificado de antecedentes',         fecha: 'hace 1 h' },
    { actor: 'J. Paredes',   accion: 'editó',             objeto: 'Turno médico — especialidades',       fecha: 'hace 3 h' },
    { actor: 'M. Rodríguez', accion: 'despublicó',        objeto: 'Inscripción a becas 2025',            fecha: 'ayer' },
  ],
};
