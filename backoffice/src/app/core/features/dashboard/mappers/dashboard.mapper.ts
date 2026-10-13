import { DashboardHomeDTO } from '../models/dashboard.dto';
import { DashboardHomeVM } from '../models/dashboard.vm';

const pct = (value: number, total: number): number => (total > 0 ? Math.round((value / total) * 100) : 0);

/**
 * Mapea los datos crudos del Home al VM campo por campo (el DTO no conoce al VM): copia cada
 * ítem y deriva los porcentajes del pipeline (sobre el total) y del top de trámites (relativo
 * al más consultado).
 */
export function toDashboardHomeVM(dto: DashboardHomeDTO): DashboardHomeVM {
  const pipelineTotal = dto.pipelineSegments.reduce((acc, s) => acc + s.value, 0);
  const topMax = dto.topTramites.reduce((acc, t) => Math.max(acc, t.consultas), 0);
  return {
    queueItems: dto.queueItems.map((q) => ({
      titulo: q.titulo, organismo: q.organismo, tiempo: q.tiempo, slaLabel: q.slaLabel, slaLevel: q.slaLevel,
    })),
    myQueueItems: dto.myQueueItems.map((q) => ({ titulo: q.titulo, organismo: q.organismo, faltantes: [...q.faltantes] })),
    pipelineSegments: dto.pipelineSegments.map((s) => ({
      label: s.label, value: s.value, color: s.color, percent: pct(s.value, pipelineTotal),
    })),
    mineItems: dto.mineItems.map((m) => ({ label: m.label, value: m.value, color: m.color })),
    visitsTotal: dto.visitsTotal,
    visitsAvgPerDay: dto.visitsAvgPerDay,
    visitsDaily: [...dto.visitsDaily],
    orgBars: dto.orgBars.map((o) => ({
      organismo: o.organismo, publicadosPercent: o.publicadosPercent, otrosPercent: o.otrosPercent, total: o.total,
    })),
    searchesWithoutResults: dto.searchesWithoutResults.map((s) => ({ termino: s.termino, cantidad: s.cantidad })),
    topTramites: dto.topTramites.map((t) => ({ titulo: t.titulo, consultas: t.consultas, percent: pct(t.consultas, topMax) })),
    feedbackItems: dto.feedbackItems.map((f) => ({ sentimiento: f.sentimiento, texto: f.texto, meta: f.meta })),
    activityItems: dto.activityItems.map((a) => ({ actor: a.actor, accion: a.accion, objeto: a.objeto, fecha: a.fecha })),
  };
}
