import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { ExampleDataPillComponent } from '../../shared/components/example-data-pill';
import { DashboardPanelComponent } from './components/dashboard-panel/dashboard-panel.component';

// ── Tipos de vista (placeholders honestos — ver HOME_REDISENO.md §5) ─────────
interface DashboardWidgetFlags {
  queue: boolean;
  myQueue: boolean;
  pipeline: boolean;
  mine: boolean;
  analytics: boolean;
  procedures: boolean;
  feedback: boolean;
  audit: boolean;
}

interface PipelineScope {
  icon: string;
  title: string;
  subtitle: string;
  gatePermission: string;
}

interface QueueItem { titulo: string; organismo: string; tiempo: string; slaLabel: string; slaLevel: 'danger' | 'warning' | 'success'; }
interface MyQueueItem { titulo: string; organismo: string; faltantes: string[]; }
interface PipelineSegment { label: string; value: number; percent: number; color: 'success' | 'info' | 'warning' | 'error'; }
interface MineItem { label: string; value: number; color: 'success' | 'info' | 'warning' | 'error'; }
interface OrgBar { organismo: string; publicadosPercent: number; otrosPercent: number; total: number; }
interface SearchItem { termino: string; cantidad: number; }
interface TopTramiteItem { titulo: string; consultas: number; percent: number; }
interface FeedbackItem { sentimiento: 'positivo' | 'neutral' | 'negativo'; texto: string; meta: string; }
interface ActivityItem { actor: string; accion: string; objeto: string; fecha: string; }

const EMPTY_WIDGETS: DashboardWidgetFlags = {
  queue: false, myQueue: false, pipeline: false, mine: false,
  analytics: false, procedures: false, feedback: false, audit: false,
};

/** Matriz de widgets por rol (screens-spec.md §4, HOME_REDISENO.md §4). */
const WIDGETS_BY_ROLE: Record<UserRole, DashboardWidgetFlags> = {
  [UserRole.SUPERADMIN]:          { queue: true,  myQueue: false, pipeline: true, mine: false, analytics: true,  procedures: true,  feedback: true,  audit: true },
  [UserRole.ADMIN_BACKOFFICE]:    { queue: true,  myQueue: false, pipeline: true, mine: false, analytics: true,  procedures: true,  feedback: true,  audit: true },
  [UserRole.ADMIN_ORGANIZATION]:  { queue: true,  myQueue: true,  pipeline: true, mine: true,  analytics: false, procedures: true,  feedback: true,  audit: true },
  [UserRole.AGENT]:                { queue: false, myQueue: true,  pipeline: true, mine: true,  analytics: false, procedures: false, feedback: false, audit: true },
  [UserRole.MANAGER]:             { queue: false, myQueue: false, pipeline: true, mine: false, analytics: true,  procedures: true,  feedback: true,  audit: false },
  [UserRole.USER]:                { ...EMPTY_WIDGETS },
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ExampleDataPillComponent,
    DashboardPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthTokenService);

  widgets: DashboardWidgetFlags = { ...EMPTY_WIDGETS };
  pipelineScope: PipelineScope = {
    icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: '',
    gatePermission: 'READ_PROCEDURE',
  };

  // ── Datos de ejemplo (placeholder honesto — sin backend real, ver HOME_REDISENO.md §2) ────────
  readonly queueItems: QueueItem[] = [
    { titulo: 'Renovación de licencia de conducir', organismo: 'Dirección de Tránsito',    tiempo: 'hace 2 días', slaLabel: '6 días', slaLevel: 'danger' },
    { titulo: 'Certificado de antecedentes',         organismo: 'Ministerio de Seguridad',  tiempo: 'hace 1 día',  slaLabel: '3 días', slaLevel: 'warning' },
    { titulo: 'Inscripción a becas provinciales',     organismo: 'Ministerio de Educación',  tiempo: 'hoy',         slaLabel: '1 día',  slaLevel: 'success' },
  ];

  readonly myQueueItems: MyQueueItem[] = [
    { titulo: 'Turno médico — especialidades',    organismo: 'Hospital Escuela', faltantes: ['requisitos', 'costo'] },
    { titulo: 'Certificado de discapacidad',       organismo: 'Hospital Escuela', faltantes: ['documentación'] },
  ];

  readonly pipelineSegments: PipelineSegment[] = [
    { label: 'Publicados',     value: 337, percent: 64, color: 'success' },
    { label: 'En revisión',    value: 74,  percent: 14, color: 'info' },
    { label: 'Borrador',       value: 92,  percent: 17, color: 'warning' },
    { label: 'Despublicados',  value: 26,  percent: 5,  color: 'error' },
  ];

  readonly mineItems: MineItem[] = [
    { label: 'Publicadas', value: 14, color: 'success' },
    { label: 'Borrador',   value: 5,  color: 'warning' },
    { label: 'Sin datos',  value: 3,  color: 'error' },
    { label: 'Contactos',  value: 8,  color: 'info' },
  ];

  readonly visitsTotal = 96031;
  readonly visitsAvgPerDay = 3098;
  readonly visitsDaily: number[] = [
    38, 42, 35, 51, 47, 60, 55, 44, 39, 58,
    62, 49, 53, 67, 71, 60, 58, 64, 70, 75,
    68, 72, 80, 77, 66, 73, 85, 90, 88, 95, 100,
  ];

  readonly orgBars: OrgBar[] = [
    { organismo: 'Min. de Salud Pública',   publicadosPercent: 72, otrosPercent: 28, total: 82 },
    { organismo: 'Dirección de Tránsito',   publicadosPercent: 65, otrosPercent: 35, total: 74 },
    { organismo: 'Min. de Educación',       publicadosPercent: 80, otrosPercent: 20, total: 61 },
    { organismo: 'Min. de Seguridad',       publicadosPercent: 55, otrosPercent: 45, total: 58 },
    { organismo: 'IPS Misiones',            publicadosPercent: 90, otrosPercent: 10, total: 47 },
    { organismo: 'Min. de Desarrollo Social', publicadosPercent: 60, otrosPercent: 40, total: 39 },
    { organismo: 'Registro Civil',          publicadosPercent: 85, otrosPercent: 15, total: 33 },
    { organismo: 'Dirección de Rentas',     publicadosPercent: 70, otrosPercent: 30, total: 28 },
  ];

  readonly searchesWithoutResults: SearchItem[] = [
    { termino: 'licencia de conducir',       cantidad: 1284 },
    { termino: 'certificado de discapacidad', cantidad: 812 },
    { termino: 'turno médico',                cantidad: 645 },
    { termino: 'cédula de identidad',         cantidad: 511 },
    { termino: 'boleto estudiantil',          cantidad: 398 },
  ];

  readonly topTramites: TopTramiteItem[] = [
    { titulo: 'Cédula de identidad — renovación',       consultas: 8420, percent: 100 },
    { titulo: 'Certificado de antecedentes penales',    consultas: 6210, percent: 74 },
    { titulo: 'Licencia de conducir — renovación',      consultas: 5100, percent: 61 },
    { titulo: 'Inscripción escolar',                    consultas: 3980, percent: 47 },
    { titulo: 'Turno médico — especialidades',          consultas: 2870, percent: 34 },
  ];

  readonly feedbackItems: FeedbackItem[] = [
    { sentimiento: 'negativo', texto: 'No encontré cómo sacar turno para el hospital.',              meta: 'Turno médico · Hospital Escuela · hace 3 h' },
    { sentimiento: 'neutral',  texto: 'El trámite estaba bien pero faltaba el teléfono de contacto.', meta: 'Certificado de antecedentes · Min. de Seguridad · hace 5 h' },
    { sentimiento: 'positivo', texto: 'Muy claro, lo resolví en minutos.',                             meta: 'Licencia de conducir · Dirección de Tránsito · hace 1 día' },
  ];

  readonly activityItems: ActivityItem[] = [
    { actor: 'M. Rodríguez', accion: 'publicó',          objeto: 'Renovación de licencia de conducir', fecha: 'hace 20 min' },
    { actor: 'L. Fernández', accion: 'envió a revisión',  objeto: 'Certificado de antecedentes',         fecha: 'hace 1 h' },
    { actor: 'J. Paredes',   accion: 'editó',             objeto: 'Turno médico — especialidades',       fecha: 'hace 3 h' },
    { actor: 'M. Rodríguez', accion: 'despublicó',        objeto: 'Inscripción a becas 2025',            fecha: 'ayer' },
  ];

  ngOnInit(): void {
    const role = this.auth.getUserRole();
    this.widgets = (role && WIDGETS_BY_ROLE[role]) || EMPTY_WIDGETS;
    this.pipelineScope = this.resolvePipelineScope(role);
  }

  private resolvePipelineScope(role: UserRole | null): PipelineScope {
    if (role === UserRole.ADMIN_ORGANIZATION) {
      return { icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: '63 trámites de tu organismo', gatePermission: 'READ_PROCEDURE · scope organismo' };
    }
    if (role === UserRole.AGENT) {
      return { icon: 'git-branch', title: '¿Cómo están tus variantes?', subtitle: '22 variantes a tu cargo', gatePermission: 'READ_VARIANT · scope organismo' };
    }
    return { icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: '529 trámites en total', gatePermission: 'READ_PROCEDURE' };
  }
}
