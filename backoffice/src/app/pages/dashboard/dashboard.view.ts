import { ActivityItemVM, DashboardHomeVM, OrgBarVM } from '@features/dashboard';

/**
 * Copy y derivaciones de VISTA del Home. Todo es dato de ejemplo (el Home entero lo es, ver las pills
 * "Datos de ejemplo"); vive acá y no en el template. Cuando el facade exponga estos campos reales
 * (tendencia, totales de organismos, tipo de evento) se reemplazan sin tocar el HTML.
 */
export const HOME_COPY = {
  visitsTrend: '+12,4 % vs. junio',
  visitsAxisY: ['4k', '3k', '2k', '1k', '0'],
  visitsAxisX: ['1 jul', '10 jul', '20 jul', '31 jul'],
  /** Cantidad de barras finales que se pintan como "recientes" (serie sólida vs. histórica). */
  visitsRecentBars: 3,
  orgSubtitle: '529 trámites cargados · top 8 de 68 organismos',
  orgSeeAll: 'Ver los 68',
  pipelineSubtitles: {
    default: '529 trámites en total',
    organism: '63 trámites de tu organismo',
    agent: '22 fichas por localidad a tu cargo',
  },
} as const;

/** Color del punto de la línea de tiempo según el tipo de evento (success = publica, primary = el resto). */
export type ActivityDot = 'success' | 'primary';

export interface ActivityRowView extends ActivityItemVM {
  dot: ActivityDot;
}

export interface OrgRowView extends OrgBarVM {
  /** Ancho de la barra completa (% relativo al organismo con más trámites). */
  scale: number;
}

export interface DashboardHomeView extends DashboardHomeVM {
  orgRows: OrgRowView[];
  activityRows: ActivityRowView[];
}

const PUBLISH_VERBS = new Set(['publicó']);

export function toHomeView(home: DashboardHomeVM): DashboardHomeView {
  const max = home.orgBars.reduce((acc, o) => Math.max(acc, o.total), 0);
  return {
    ...home,
    orgRows: home.orgBars.map((o) => ({ ...o, scale: max > 0 ? Math.round((o.total / max) * 100) : 0 })),
    activityRows: home.activityItems.map((a) => ({ ...a, dot: PUBLISH_VERBS.has(a.accion) ? 'success' : 'primary' })),
  };
}
