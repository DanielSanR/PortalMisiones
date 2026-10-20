/**
 * Forma "cruda" de un registro de auditoría tal como lo entregaría una fuente (hoy: el mock
 * en memoria del feature). Cuando exista el endpoint real, este contrato se ajusta al DTO del
 * backend y el mapper absorbe la diferencia sin tocar facade/componentes.
 */
export type AuditoriaAccionDTO = 'crear' | 'editar' | 'publicar' | 'despublicar' | 'enviar_revision' | 'eliminar';

export interface AuditoriaRegistroDTO {
  id: number;
  tramiteId: string;
  usuarioId: string;
  accion: AuditoriaAccionDTO;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  /** ISO 8601. */
  fechaAccion: string;
  usuarioNombre?: string;
  tramiteTitulo?: string;
}

/** Una página de registros + el total tras filtrar. */
export interface AuditoriaPaginaDTO {
  data: AuditoriaRegistroDTO[];
  total: number;
}
