import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { DashboardFacade, CatalogKey, CatalogCounts } from '@features/dashboard';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
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

interface QuickAction { label: string; route: string; permissions: string[]; icon: string; }
interface ConfigCard { key: CatalogKey; label: string; icon: string; route: string; permission?: string; }

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

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Nuevo trámite',           route: '/dashboard/tramites/nuevo',        permissions: ['CREATE_PROCEDURE', 'CREATE_VARIANT'], icon: 'file-text' },
  { label: 'Nuevo organismo',         route: '/dashboard/organismos/nuevo',      permissions: ['CREATE_ORGANISM'],       icon: 'buildings' },
  { label: 'Nuevo tipo de organismo', route: '/dashboard/tipos-organismo/nuevo', permissions: ['CREATE_ORGANISM_TYPE'],  icon: 'path' },
  { label: 'Nueva categoría',         route: '/dashboard/categorias/nuevo',      permissions: ['CREATE_CATEGORY'],       icon: 'folders' },
  { label: 'Nueva modalidad',         route: '/dashboard/modalidades/nuevo',     permissions: ['CREATE_MODALITY'],       icon: 'sliders-horizontal' },
  { label: 'Nuevo evento de vida',    route: '/dashboard/eventos-de-vida/nuevo', permissions: ['CREATE_LIFE_EVENT'],     icon: 'bookmarks-simple' },
  { label: 'Nuevo destinatario',      route: '/dashboard/destinatarios/nuevo',   permissions: ['CREATE_RECIPIENT'],      icon: 'user-focus' },
  { label: 'Nueva etiqueta',          route: '/dashboard/etiquetas/nuevo',       permissions: ['CREATE_TAXONOMY'],       icon: 'tag' },
  { label: 'Nuevo usuario',           route: '/dashboard/usuarios/nuevo',        permissions: ['CREATE_USER'],           icon: 'users' },
];

/** Catálogos públicos o gateados por permiso atómico (roles/permisos se gatean por ROL aparte). */
const CONFIG_CARDS: ConfigCard[] = [
  { key: 'organismos',      label: 'Organismos',         icon: 'buildings',           route: '/dashboard/organismos/lista',      permission: 'READ_ORGANISM' },
  { key: 'tiposOrganismo',  label: 'Tipos de organismo', icon: 'path',                 route: '/dashboard/tipos-organismo/lista', permission: 'READ_ORGANISM_TYPE' },
  { key: 'categorias',      label: 'Categorías',         icon: 'folders',              route: '/dashboard/categorias/lista' },
  { key: 'modalidades',     label: 'Modalidades',        icon: 'sliders-horizontal',   route: '/dashboard/modalidades/lista' },
  { key: 'eventos',         label: 'Eventos de vida',    icon: 'bookmarks-simple',     route: '/dashboard/eventos-de-vida/lista' },
  { key: 'destinatarios',   label: 'Destinatarios',      icon: 'user-focus',           route: '/dashboard/destinatarios/lista' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    HasPermissionDirective,
    ExampleDataPillComponent,
    DashboardPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthTokenService);
  private readonly facade = inject(DashboardFacade);

  readonly today = new Date();
  userName = 'Usuario';
  roleLabel = '';
  widgets: DashboardWidgetFlags = { ...EMPTY_WIDGETS };
  pipelineScope: PipelineScope = {
    icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: '',
    gatePermission: 'READ_PROCEDURE',
  };

  /** Roles/Permisos: el backend los autoriza por ROL (hasAnyRole), no por permiso atómico — no hay
   *  `READ_ROLE` real que gatear con `*appHasPermission`; se resuelve una vez (igual que el resto
   *  de las pantallas del backoffice, ver `tramites-list.component.ts`). */
  canSeeRolesPermisos = false;

  readonly quickActions = QUICK_ACTIONS;
  readonly configCards = CONFIG_CARDS;
  /** Evita renderizar el título "Accesos rápidos" vacío si el rol no tiene ningún `CREATE_*`. */
  hasAnyQuickAction = false;
  counts$!: Observable<CatalogCounts>;

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
    const user = this.auth.getCurrentUser();
    this.userName = user ? `${user.nombre} ${user.apellido}`.trim() || user.email : 'Usuario';
    this.roleLabel = this.auth.getUserRoleLabel();

    const role = this.auth.getUserRole();
    this.widgets = (role && WIDGETS_BY_ROLE[role]) || EMPTY_WIDGETS;
    this.pipelineScope = this.resolvePipelineScope(role);
    this.canSeeRolesPermisos = this.auth.hasAnyRole([UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE]);
    this.hasAnyQuickAction = QUICK_ACTIONS.some((action) => this.auth.canAny(...action.permissions));

    this.counts$ = this.facade.loadCatalogCounts(this.resolveAllowedCatalogKeys());
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

  /** Solo pide conteo de lo que el usuario puede leer (evita 403); los públicos se piden siempre. */
  private resolveAllowedCatalogKeys(): CatalogKey[] {
    const keys: CatalogKey[] = ['categorias', 'modalidades', 'eventos', 'destinatarios'];
    if (this.auth.can('READ_ORGANISM')) keys.push('organismos');
    if (this.auth.can('READ_ORGANISM_TYPE')) keys.push('tiposOrganismo');
    if (this.canSeeRolesPermisos) keys.push('roles', 'permisos');
    return keys;
  }
}
