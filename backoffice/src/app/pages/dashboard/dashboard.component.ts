import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Observable, Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { DashboardFacade } from '@features/dashboard';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { ExampleDataPillComponent } from '@shared/components/example-data-pill';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { DashboardPanelComponent } from './components/dashboard-panel/dashboard-panel.component';
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
interface DashboardScreenVM {
  estado: 'cargando' | 'listo' | 'error';
  home?: DashboardHomeView;
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
export class DashboardComponent implements OnInit {
  /** Infra de sesión (excepción documentada): solo para resolver el rol → matriz de widgets. */
  private readonly auth = inject(AuthTokenService);

  readonly copy = HOME_COPY;

  widgets: DashboardWidgetFlags = { ...EMPTY_WIDGETS };
  pipelineScope: PipelineScope = {
    icon: 'git-branch', title: '¿Cómo está el contenido?', subtitle: '',
    gatePermission: 'READ_PROCEDURE',
  };

  private readonly facade = inject(DashboardFacade);
  /** Cada emisión vuelve a pedir el Home; `switchMap` descarta un intento anterior en vuelo. */
  private readonly reintentar$ = new Subject<void>();

  /**
   * Estado de la pantalla (hoy mock, vía facade), consumido con `async` pipe. Cada intento
   * arranca en `cargando`; un error queda como `error` sin cortar el stream, así "Reintentar"
   * vuelve a disparar la carga.
   */
  readonly vm$: Observable<DashboardScreenVM> = this.reintentar$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.facade.loadHome().pipe(
        map((home): DashboardScreenVM => ({ estado: 'listo', home: toHomeView(home) })),
        startWith<DashboardScreenVM>({ estado: 'cargando' }),
        catchError(() => of<DashboardScreenVM>({ estado: 'error' })),
      ),
    ),
  );

  reintentar(): void {
    this.reintentar$.next();
  }

  ngOnInit(): void {
    const role = this.auth.getUserRole();
    this.widgets = (role && WIDGETS_BY_ROLE[role]) || EMPTY_WIDGETS;
    this.pipelineScope = this.resolvePipelineScope(role);
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
