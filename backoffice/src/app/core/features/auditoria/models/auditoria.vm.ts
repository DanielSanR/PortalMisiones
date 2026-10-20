/** Acción auditada sobre un trámite. */
export type AuditoriaAccion = 'crear' | 'editar' | 'publicar' | 'despublicar' | 'enviar_revision' | 'eliminar';

/** ViewModel de un registro de auditoría. Feature BLOQUEADA por backend (corre en mock). */
export interface AuditoriaRegistroVM {
  id: number;
  tramiteId: string;
  usuarioId: string;
  accion: AuditoriaAccion;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  fechaAccion: string;
  usuarioNombre: string;
  tramiteTitulo: string;
}

/** Consulta paginada server-side (página 1-based). */
export interface AuditoriaQuery {
  page: number;
  pageSize: number;
  search?: string;
  accion?: AuditoriaAccion;
}

/** Una página de resultados + el total tras filtrar. */
export interface AuditoriaPaginaVM {
  registros: AuditoriaRegistroVM[];
  total: number;
}
