/**
 * Forma "cruda" de los datos del Home tal como los entregaría una fuente (hoy: mock).
 * Trae conteos; los porcentajes de las barras los deriva el mapper. Cuando exista el endpoint
 * real, este contrato se ajusta al DTO del backend sin tocar facade/componentes.
 * No depende del VM: el mapper traduce DTO → VM.
 */
export type DashboardColorDTO = 'success' | 'info' | 'warning' | 'error';

export interface QueueItemDTO { titulo: string; organismo: string; tiempo: string; slaLabel: string; slaLevel: 'danger' | 'warning' | 'success'; }
export interface MyQueueItemDTO { titulo: string; organismo: string; faltantes: string[]; }
export interface PipelineSegmentDTO { label: string; value: number; color: DashboardColorDTO; }
export interface MineItemDTO { label: string; value: number; color: DashboardColorDTO; }
export interface OrgBarDTO { organismo: string; publicadosPercent: number; otrosPercent: number; total: number; }
export interface SearchItemDTO { termino: string; cantidad: number; }
export interface TopTramiteDTO { titulo: string; consultas: number; }
export interface FeedbackItemDTO { sentimiento: 'positivo' | 'neutral' | 'negativo'; texto: string; meta: string; }
export interface ActivityItemDTO { actor: string; accion: string; objeto: string; fecha: string; }

export interface DashboardHomeDTO {
  queueItems: QueueItemDTO[];
  myQueueItems: MyQueueItemDTO[];
  pipelineSegments: PipelineSegmentDTO[];
  mineItems: MineItemDTO[];
  visitsTotal: number;
  visitsAvgPerDay: number;
  visitsDaily: number[];
  orgBars: OrgBarDTO[];
  searchesWithoutResults: SearchItemDTO[];
  topTramites: TopTramiteDTO[];
  feedbackItems: FeedbackItemDTO[];
  activityItems: ActivityItemDTO[];
}
