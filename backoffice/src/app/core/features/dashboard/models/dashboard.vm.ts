/**
 * ViewModels del Home (dashboard). Feature BLOQUEADA por backend: hoy todo es dato de ejemplo
 * (placeholder honesto, ver HOME_REDISENO.md §2) servido por el MockDataSource.
 */
export type DashboardColor = 'success' | 'info' | 'warning' | 'error';

export interface QueueItemVM { titulo: string; organismo: string; tiempo: string; slaLabel: string; slaLevel: 'danger' | 'warning' | 'success'; }
export interface MyQueueItemVM { titulo: string; organismo: string; faltantes: string[]; }
export interface PipelineSegmentVM { label: string; value: number; percent: number; color: DashboardColor; }
export interface MineItemVM { label: string; value: number; color: DashboardColor; }
export interface OrgBarVM { organismo: string; publicadosPercent: number; otrosPercent: number; total: number; }
export interface SearchItemVM { termino: string; cantidad: number; }
export interface TopTramiteItemVM { titulo: string; consultas: number; percent: number; }
export interface FeedbackItemVM { sentimiento: 'positivo' | 'neutral' | 'negativo'; texto: string; meta: string; }
export interface ActivityItemVM { actor: string; accion: string; objeto: string; fecha: string; }

/** Todo lo que pinta el Home, en una sola carga. */
export interface DashboardHomeVM {
  queueItems: QueueItemVM[];
  myQueueItems: MyQueueItemVM[];
  pipelineSegments: PipelineSegmentVM[];
  mineItems: MineItemVM[];
  visitsTotal: number;
  visitsAvgPerDay: number;
  /** Alturas relativas (0-100) de las barras diarias del último mes. */
  visitsDaily: number[];
  orgBars: OrgBarVM[];
  searchesWithoutResults: SearchItemVM[];
  topTramites: TopTramiteItemVM[];
  feedbackItems: FeedbackItemVM[];
  activityItems: ActivityItemVM[];
}
