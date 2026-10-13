import { AuditoriaPaginaDTO, AuditoriaRegistroDTO } from '../models/auditoria.dto';
import { AuditoriaPaginaVM, AuditoriaRegistroVM } from '../models/auditoria.vm';

/**
 * Mapea el DTO de auditoría al VM. Cuando el backend exponga el endpoint, se ajusta el DTO y
 * este mapper sin tocar facade/componentes.
 */
export function toAuditoriaRegistroVM(a: AuditoriaRegistroDTO): AuditoriaRegistroVM {
  return {
    id: a.id,
    tramiteId: a.tramiteId,
    usuarioId: a.usuarioId,
    accion: a.accion,
    datosAnteriores: a.datosAnteriores,
    datosNuevos: a.datosNuevos,
    fechaAccion: a.fechaAccion,
    usuarioNombre: a.usuarioNombre ?? '',
    tramiteTitulo: a.tramiteTitulo ?? '',
  };
}

export function toAuditoriaPaginaVM(res: AuditoriaPaginaDTO): AuditoriaPaginaVM {
  return { registros: res.data.map(toAuditoriaRegistroVM), total: res.total };
}
