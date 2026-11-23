import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { UserRole } from '@core/enums/user-role.enum';
import { DashboardFacade } from '@features/dashboard';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { ExampleDataPillComponent } from '@shared/components/example-data-pill';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DashboardPanelComponent } from '../components/dashboard-panel/dashboard-panel.component';
import { DashboardHomeView, HOME_COPY, toHomeView } from './dashboard.view';

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

/** VM de pantalla del Home: la carga de los widgets como estado explícito (no hay "en blanco"). */
interface DashboardCarga {
  estado: 'cargando' | 'listo' | 'error';
  home?: DashboardHomeView;
}

/** La carga + lo que depende del rol de quien mira (matriz de widgets y alcance del pipeline). */
interface DashboardScreenVM extends DashboardCarga {
  widgets: DashboardWidgetFlags;
  pipelineScope: PipelineScope;
}

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
    AsyncPipe,
    DecimalPipe,
    MatButtonModule,
    UnavailableDirective,
    ExampleDataPillComponent,
    LoadingComponent,
    DashboardPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly copy = HOME_COPY;

  private readonly facade = inject(DashboardFacade);
  /** Cada emisión vuelve a pedir el Home; `switchMap` descarta un intento anterior en vuelo. */
  private readonly reintentar$ = new Subject<void>();

  /**
   * Carga de los widgets (hoy mock, vía facade). Cada intento arranca en `cargando`; un error queda como
   * `error` sin cortar el stream, así "Reintentar" vuelve a disparar la carga.
   */
  private readonly carga$: Observable<DashboardCarga> = this.reintentar$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.facade.loadHome().pipe(
        map((home): DashboardCarga => ({ estado: 'listo', home: toHomeView(home) })),
        startWith<DashboardCarga>({ estado: 'cargando' }),
        catchError(() => of<DashboardCarga>({ estado: 'error' })),
      ),
    ),
  );

  /**
   * Estado de la pantalla, consumido con `async` pipe: la carga + la matriz de widgets del rol. El rol lo
   * expone el facade (`rolDeSesion$`); la pantalla no inyecta la sesión.
   */
  readonly vm$: Observable<DashboardScreenVM> = combineLatest([this.facade.rolDeSesion$, this.carga$]).pipe(
    map(([role, carga]): DashboardScreenVM => ({
      ...carga,
      widgets: (role && WIDGETS_BY_ROLE[role]) || EMPTY_WIDGETS,
      pipelineScope: this.resolvePipelineScope(role),
    })),
  );

  reintentar(): void {
    this.reintentar$.next();
  }

  private resolvePipelineScope(role: UserRole | null): PipelineScope {
    if (role === UserRole.ADMIN_ORGANIZATION) {
      return { icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: HOME_COPY.pipelineSubtitles.organism, gatePermission: 'READ_PROCEDURE · scope organismo' };
    }
    if (role === UserRole.AGENT) {
      return { icon: 'git-branch', title: '¿Cómo están tus fichas?', subtitle: HOME_COPY.pipelineSubtitles.agent, gatePermission: 'READ_VARIANT · scope organismo' };
    }
    return { icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: HOME_COPY.pipelineSubtitles.default, gatePermission: 'READ_PROCEDURE' };
  }
}
