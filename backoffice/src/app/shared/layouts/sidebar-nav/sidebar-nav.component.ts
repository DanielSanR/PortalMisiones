import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavGroup, NavItem } from '@core/constants/role-mapping.constants';
import { AuthzContext, authzContextDe } from '@core/utils/authorization.utils';
import { GrupoResultado, ResultadoBuscador, buscarEnShell } from './buscador-comandos';

/** Grupo de nav con su estado de colapso para el template. */
interface NavGroupView {
  label: string;
  items: NavItem[];
  isOpen: boolean;
}

/**
 * Buscador de comandos de la sidebar ("Buscar o ejecutar…") y el nav que lo acompaña. Van juntos porque con
 * búsqueda activa el nav SE CONVIERTE en los resultados (no hay panel flotante): comparten contenedor, filas
 * y scroll.
 *
 * No conoce la sesión ni el router: recibe los grupos ya filtrados por permiso y avisa qué se eligió
 * (`ejecutar`) o que se navegó desde el nav (`navegado`); el shell decide qué hacer (cerrar el menú en
 * mobile, navegar, cerrar sesión, colapsar).
 *
 * El host no genera caja (`display: contents`): el buscador y el `<nav>` siguen siendo hijos flex de la
 * sidebar, como cuando vivían en el template del shell. Por eso conservan las clases `admin-layout__*`.
 */
@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatTooltipModule],
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarNavComponent {
  /** Grupos accesibles para el usuario actual (gateados por permiso). */
  @Input() set grupos(value: NavGroup[]) {
    this.accesibles = value ?? [];
    this.recomputeNavGroups();
  }
  /** Contexto de autorización del usuario actual, para gatear los comandos. */
  @Input() authz: AuthzContext = authzContextDe(null);
  /** Sidebar colapsada: los ítems muestran su label como tooltip. */
  @Input() colapsado = false;

  /** Se eligió un resultado (clic o Enter). La búsqueda ya quedó limpia. */
  @Output() readonly ejecutar = new EventEmitter<ResultadoBuscador>();
  /** Se hizo clic en un ítem del nav en reposo. */
  @Output() readonly navegado = new EventEmitter<void>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('navScroll') navScrollRef?: ElementRef<HTMLElement>;

  /** Grupos de nav en reposo, lo que consume el template. */
  navGroups: NavGroupView[] = [];
  searchQuery = '';
  /** Resultados en lista plana: es el orden que recorren las flechas. */
  resultados: ResultadoBuscador[] = [];
  /** Los mismos resultados agrupados, que es lo que dibuja el nav. */
  gruposResultado: GrupoResultado[] = [];
  /** Fila bajo el cursor; -1 cuando no hay resultados. */
  indiceActivo = -1;

  private readonly cdr = inject(ChangeDetectorRef);
  private accesibles: NavGroup[] = [];
  /** Labels de grupo colapsados manualmente por el usuario (vacío = todos abiertos). */
  private readonly collapsedGroups = new Set<string>();

  /** Foca el campo (atajo "/"). Tras el render: con el menú abriéndose o expandiéndose todavía no es enfocable. */
  enfocarBuscador(): void {
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  /** Filtro client-side del buscador de la sidebar (sin backend). */
  onSearchInput(value: string): void {
    this.searchQuery = value;
    const { resultados, grupos } = buscarEnShell(value, this.accesibles.flatMap((g) => g.items), this.authz);
    this.resultados = resultados;
    this.gruposResultado = grupos;
    // Se preselecciona el primero: Enter sin tocar las flechas ejecuta lo más probable.
    this.indiceActivo = resultados.length > 0 ? 0 : -1;
    this.cdr.markForCheck();
  }

  /** Flechas para recorrer, Enter para ejecutar, Escape para limpiar. */
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // `MatDrawer` escucha Escape en su propio elemento y cierra el sidenav. Cortamos
      // la propagación solo cuando hay algo que limpiar: si no, Escape con el buscador
      // vacío deja de cerrar el drawer en mobile, que ahí sí es lo que se espera.
      // En desktop el sidenav es fijo y no se cierra con Escape (`[disableClose]` en el
      // template del shell): no hay botón para volver a abrirlo.
      if (!this.searchQuery) return;
      event.stopPropagation();
      this.limpiarBusqueda();
      return;
    }
    if (this.resultados.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      const total = this.resultados.length;
      this.indiceActivo = (this.indiceActivo + paso + total) % total;
      this.desplazarAlCursor();
      return;
    }
    if (event.key === 'Enter' && this.indiceActivo >= 0) {
      event.preventDefault();
      this.elegir(this.resultados[this.indiceActivo]);
    }
  }

  elegir(resultado: ResultadoBuscador): void {
    this.limpiarBusqueda();
    this.ejecutar.emit(resultado);
  }

  limpiarBusqueda(): void {
    this.searchQuery = '';
    this.resultados = [];
    this.gruposResultado = [];
    this.indiceActivo = -1;
    if (this.searchInputRef) this.searchInputRef.nativeElement.value = '';
    this.cdr.markForCheck();
  }

  /** Abre/cierra un grupo del nav. Estado local, no persiste entre sesiones. */
  toggleGroup(label: string): void {
    if (this.collapsedGroups.has(label)) {
      this.collapsedGroups.delete(label);
    } else {
      this.collapsedGroups.add(label);
    }
    this.recomputeNavGroups();
  }

  /** La lista vive dentro del nav, que scrollea: sin esto el cursor se va de vista
   *  con las flechas. `setTimeout` porque el alto hay que medirlo ya renderizado. */
  private desplazarAlCursor(): void {
    setTimeout(() => {
      this.navScrollRef?.nativeElement
        .querySelector('.is-cursor')
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** Nav en reposo. El filtrado por texto no vive acá: con búsqueda activa el nav
   *  no se dibuja, lo reemplaza el grupo "Ir a" de los resultados. */
  private recomputeNavGroups(): void {
    this.navGroups = this.accesibles.map((group) => ({
      label: group.label,
      items: group.items,
      isOpen: !this.collapsedGroups.has(group.label),
    }));
    this.cdr.markForCheck();
  }
}
