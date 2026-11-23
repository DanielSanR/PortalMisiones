import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, filter, map, startWith } from 'rxjs';
import { NAV_ITEMS, NavItem } from '@core/constants/role-mapping.constants';
import { BreadcrumbDeclarado, BreadcrumbItem, resolverBreadcrumb } from '@core/utils/breadcrumb.utils';

/** Icono genérico cuando el primer segmento del breadcrumb no matchea ningún `NavItem`
 *  (ej. detalle de trámite, cuyo trail es ["Trámites", "Detalle"] — sí matchea; se usa
 *  solo como red de seguridad ante secciones fuera del nav). */
const FALLBACK_SECTION_ICON = 'file-text';

/** Lo que dibuja el topbar para la ruta activa. */
interface BreadcrumbVista {
  /** Icono de la sección activa (icono del `NavItem` cuyo label matchea el primer tramo). */
  icono: string;
  /** Tramos previos al título (links a su sección); el último tramo es `titulo`, el `<h1>`. */
  previos: BreadcrumbItem[];
  /** Título de la página = último tramo del breadcrumb ("Inicio" en Home). */
  titulo: string;
}

/**
 * Breadcrumb del topbar: ícono de la sección + tramos previos (links) + título de la página (el único `<h1>`).
 * Refleja `data.breadcrumb` de la ruta hija más profunda (la que efectivamente resuelve `router-outlet`).
 *
 * El host no genera caja (`display: contents`): ícono, tramos y h1 siguen siendo hijos flex del header,
 * como cuando vivían en el template del shell. Por eso conservan las clases `admin-layout__*`.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly secciones$ = new BehaviorSubject<readonly NavItem[]>([]);

  /**
   * Secciones que el usuario VE (no todo `NAV_ITEMS`): contra ellas se resuelven los links. Un tramo de una
   * sección a la que no tiene acceso queda como texto, en vez de llevarlo a una ruta que el guard le rechaza.
   */
  @Input() set secciones(value: readonly NavItem[]) {
    this.secciones$.next(value ?? []);
  }

  readonly vista$: Observable<BreadcrumbVista> = combineLatest([
    this.secciones$,
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
    ),
  ]).pipe(map(([secciones]) => this.vistaDe(secciones)));

  private vistaDe(secciones: readonly NavItem[]): BreadcrumbVista {
    let route = this.activatedRoute.root;
    while (route.firstChild) route = route.firstChild;
    const declarado = route.snapshot.data['breadcrumb'] as BreadcrumbDeclarado[] | undefined;
    const trail = resolverBreadcrumb(declarado, secciones);
    return {
      // "Inicio" cuando no hay trail (Home); si no, el del `NavItem` del primer tramo (ej. "Roles" → shield-star).
      icono: NAV_ITEMS.find((item) => item.label === (trail[0]?.label ?? 'Inicio'))?.icon ?? FALLBACK_SECTION_ICON,
      previos: trail.slice(0, -1),
      titulo: trail.length > 0 ? trail[trail.length - 1].label : 'Inicio',
    };
  }
}
