import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, distinctUntilChanged, firstValueFrom, map, shareReplay, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '@shared/components/table';
import { FilterTabsComponent, FilterTabOption } from '@shared/components/filter-tabs';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { ListSearchComponent } from '@shared/components/list-search';
import { AtajoDirective } from '@shared/directives/atajo.directive';
import { ActiveFiltersComponent, FiltroActivo } from '@shared/components/active-filters';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { buildPermisoGroups, PERMISO_ACTION_LABELS } from '@shared/utils/permiso-groups.util';
import { PermisosFacade, PermisoVM } from '@features/permisos';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { ListaCliente, TextosDeVacio, compararPorTexto, textosDeVacio } from '@shared/utils/lista-cliente';
import { avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DialogoEnLista } from '@shared/utils/dialogo-en-lista';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDePermiso } from '../permiso-dialogo';

/** Valor "sin filtrar" de los dos filtros con dato real (acción y recurso). */
const TODAS = 'todas';

/**
 * Fila de la tabla: el permiso más lo que se deduce de su código `ACCION_RECURSO`
 * (ver `permiso-groups.util.ts`). Se precalcula una vez por catálogo porque tanto el
 * filtrado como el orden y la celda lo necesitan en cada emisión.
 */
interface PermisoFilaVM extends PermisoVM {
  recursoKey: string;
  recursoLabel: string;
  accionKey: string;
  accionLabel: string;
}

/** Opción del select "Recurso" — derivada del catálogo, no de una lista fija. */
interface OpcionRecurso {
  key: string;
  label: string;
}

/** Filtros propios de la lista: recurso (select) y acción (chips). */
interface FiltrosDePermisos {
  recurso: string;
  accion: string;
}

/** Textos del vacío + lo que necesitan los controles de filtro. */
interface ExtrasDePermisos extends TextosDeVacio {
  /** Chips de acción, con los contadores calculados sobre lo ya buscado y filtrado por recurso. */
  tabs: FilterTabOption[];
  /** Opciones del select: salen del catálogo completo, así no se achican al filtrar. */
  recursos: OpcionRecurso[];
}

const TEXTOS_DE_VACIO = textosDeVacio(
  {
    emptyTitle: 'Todavía no hay permisos',
    emptyMessage: 'El catálogo de permisos define qué puede hacer cada rol. Creá el primero para empezar a armarlos.',
    emptyActionLabel: 'Nuevo permiso',
  },
  {
    emptyTitle: 'Sin resultados',
    emptyMessage: 'Ningún permiso coincide con la búsqueda o los filtros aplicados.',
    emptyActionLabel: 'Limpiar filtros',
  },
);

@Component({
  selector: 'app-permisos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HasPermissionDirective,
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    RowActionsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    PageActionsDirective,
    AtajoDirective,
  ],
  templateUrl: './permisos-list.component.html',
  styleUrl: './permisos-list.component.scss',
})
export class PermisosListComponent implements OnInit {
  private readonly facade = inject(PermisosFacade);
  /** Crear/editar/eliminar: solo SUPERADMIN (PPDT-5.1). ADMIN_BACKOFFICE ve la pantalla en lectura. */
  readonly escribirPermisos = ESCRIBIR_ROLES_PERMISOS_ACCESS;
  /**
   * `/api/permission` se autoriza por ROL, no por permiso atómico: el CTA del estado vacío (que gatea por
   * permiso) necesita saber si quien mira puede crear. Lo resuelve el facade con la sesión.
   */
  readonly puedeEscribir$ = this.facade.puedeEscribir$;
  readonly permisos$ = this.facade.permisos$;

  /** Filtro por recurso (`ACCION_RECURSO`); '' = todos. Es select y no chips: hay ~14 recursos. */
  readonly recursoCtrl = new FormControl('', { nonNullable: true });
  /** Filtro por acción (CREATE/READ/...), en la fila de chips. */
  readonly filtro$ = new BehaviorSubject<string>(TODAS);

  private readonly recurso$ = this.recursoCtrl.valueChanges.pipe(
    distinctUntilChanged(),
    startWith(this.recursoCtrl.value),
  );

  /**
   * Catálogo ya indexado por recurso/acción. Deriva solo de `permisos$`, así que se
   * recalcula al recargar y no en cada tecleo del buscador.
   */
  private readonly filas$ = this.permisos$.pipe(
    map((permisos) => this.indexar(permisos)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Búsqueda (por código y descripción, y también por los rótulos de recurso y acción: los códigos están en
   * inglés y la pantalla se lee en español), filtros, orden, paginado y estado de carga en cliente.
   */
  readonly lista = new ListaCliente<PermisoFilaVM, FiltrosDePermisos, ExtrasDePermisos>({
    fuente$: this.filas$,
    cargar: () => this.facade.loadPermisos(),
    buscarEn: (p) => [p.codigo, p.descripcion, p.recursoLabel, p.accionLabel],
    comparar: compararPorTexto((fila, columna) =>
      (columna === 'codigo' ? fila.codigo : columna === 'recurso' ? fila.recursoLabel : columna === 'descripcion' ? fila.descripcion : '')),
    filtros$: combineLatest([this.recurso$, this.filtro$]).pipe(
      map(([recurso, accion]): FiltrosDePermisos => ({ recurso, accion })),
    ),
    filtrar: (buscadas, { recurso, accion }) => buscadas.filter((fila) =>
      (!recurso || fila.recursoKey === recurso) && (accion === TODAS || fila.accionKey === accion)),
    filtrosActivos: (filtros, filas) => this.filtrosActivos(filas, filtros),
    limpiarFiltros: () => {
      this.recursoCtrl.setValue('');
      this.filtro$.next(TODAS);
    },
    quitarFiltro: (clave) => {
      if (clave === 'recurso') this.recursoCtrl.setValue('');
      else this.filtro$.next(TODAS);
    },
    extras: (contexto) => ({
      ...TEXTOS_DE_VACIO(contexto),
      tabs: this.tabsDeAccion(contexto.buscadas.filter((fila) => !contexto.filtros.recurso || fila.recursoKey === contexto.filtros.recurso)),
      recursos: this.recursosDe(contexto.items),
    }),
    alCargar: (lista) => this.dialogo.listaLista(lista),
  });

  columns: TableColumn<PermisoFilaVM>[] = [
    { key: 'codigo',      label: 'Código',      sortable: true, width: '32%' },
    { key: 'recurso',     label: 'Recurso',     sortable: true, width: '18%', hideOnMobile: true },
    { key: 'descripcion', label: 'Descripción', sortable: true, hideOnMobile: true },
    { key: 'acciones',    label: 'Acciones',    width: '140px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Alta y edición van en diálogo sobre la lista; el diálogo guarda y acá solo se avisa. */
  private readonly dialogo = new DialogoEnLista<PermisoVM, PermisoVM>({
    abrir: (permiso) => abrirFormDialog(this.dialog, dialogoDePermiso(this.facade, permiso)),
    buscar: async (id) => (await firstValueFrom(this.permisos$)).find((fila) => fila.id === id),
    alGuardar: (_guardado, permiso) => avisarExito(this.snackBar, permiso ? 'Permiso actualizado' : 'Permiso creado'),
    noEncontrada: 'No encontramos ese permiso. Puede que lo hayan eliminado.',
  });

  ngOnInit(): void {
    this.lista.cargar();
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    this.lista.accionDeVacio(() => this.onCreate());
  }

  onCreate(): void {
    void this.dialogo.abrir(null);
  }

  /**
   * Sin `permission`: `/api/permission` se autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE,
   * BACKEND_API_SPEC.md §4.5) y no por permiso atómico, igual que Roles. La ruta ya exige esos roles
   * (`requireRoles` en `pages.module.ts`), así que quien ve la pantalla puede operar sus filas;
   * pedir además un permiso atómico escondería las acciones a todo el mundo, porque no existe.
   */
  accionEditar(permiso: PermisoFilaVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
      ariaLabel: `Editar permiso ${permiso.codigo}`,
      run: () => this.onEdit(permiso),
    };
  }

  accionesDe(permiso: PermisoFilaVM): RowAction[] {
    return [{
      label: 'Eliminar',
      icon: 'trash',
      danger: true,
      rule: ESCRIBIR_ROLES_PERMISOS_ACCESS,
      ariaLabel: `Eliminar permiso ${permiso.codigo}`,
      run: () => this.onDelete(permiso),
    }];
  }

  onEdit(permiso: PermisoFilaVM): void {
    void this.dialogo.abrir(permiso);
  }

  onDelete(permiso: PermisoFilaVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el permiso?',
        // Cuenta la consecuencia real: el permiso es un ítem del catálogo que los roles
        // referencian, así que borrarlo cambia lo que esos roles habilitan.
        message: `Se eliminará ${permiso.codigo} del catálogo y los roles que lo tengan asignado dejarán de otorgarlo. Esta acción no se puede deshacer.`,
        highlight: permiso.codigo,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(permiso.id),
      },
      aviso: 'Permiso eliminado',
      ocupado: this.lista.ocupar(permiso.id),
      foco: { host: this.host },
    });
  }

  /**
   * Deduce recurso y acción de cada código reusando `buildPermisoGroups`, que es el único
   * punto de verdad de esa agrupación (lo comparte con Roles). Se lo llama con el set de
   * otorgados vacío porque acá no interesa quién tiene el permiso, sino a qué recurso pertenece.
   */
  private indexar(permisos: PermisoVM[]): PermisoFilaVM[] {
    const porId = new Map<string, OpcionRecurso>();
    for (const grupo of buildPermisoGroups(permisos, new Set<string>())) {
      for (const item of grupo.items) porId.set(item.id, { key: grupo.key, label: grupo.label });
    }

    return permisos.map((permiso): PermisoFilaVM => {
      const recurso = porId.get(permiso.id);
      const accionKey = permiso.codigo.split('_')[0];
      return {
        ...permiso,
        recursoKey: recurso?.key ?? '',
        recursoLabel: recurso?.label ?? '—',
        accionKey,
        accionLabel: PERMISO_ACTION_LABELS[accionKey] ?? accionKey,
      };
    });
  }

  /** Recursos presentes en el catálogo, ya ordenados por `buildPermisoGroups`. */
  private recursosDe(filas: PermisoFilaVM[]): OpcionRecurso[] {
    const porKey = new Map<string, OpcionRecurso>();
    for (const fila of filas) {
      if (!porKey.has(fila.recursoKey)) porKey.set(fila.recursoKey, { key: fila.recursoKey, label: fila.recursoLabel });
    }
    return [...porKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'es-AR'));
  }

  /**
   * Chips de acción. Solo aparecen las acciones que existen en el catálogo (no se inventan
   * chips vacíos) y en el orden del ciclo de vida de `PERMISO_ACTION_LABELS`, no alfabético.
   */
  private tabsDeAccion(filas: PermisoFilaVM[]): FilterTabOption[] {
    const conteo = new Map<string, number>();
    const etiquetas = new Map<string, string>();
    for (const fila of filas) {
      conteo.set(fila.accionKey, (conteo.get(fila.accionKey) ?? 0) + 1);
      etiquetas.set(fila.accionKey, fila.accionLabel);
    }

    const orden = Object.keys(PERMISO_ACTION_LABELS);
    const posicion = (clave: string): number => {
      const at = orden.indexOf(clave);
      return at === -1 ? orden.length : at;
    };

    const claves = [...conteo.keys()].sort((a, b) =>
      posicion(a) - posicion(b) || a.localeCompare(b, 'es-AR'));

    return [
      { value: TODAS, label: 'Todas', count: filas.length },
      ...claves.map((clave): FilterTabOption => ({
        value: clave,
        label: etiquetas.get(clave) ?? clave,
        count: conteo.get(clave) ?? 0,
      })),
    ];
  }

  private filtrosActivos(filas: PermisoFilaVM[], { recurso, accion }: FiltrosDePermisos): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    if (recurso) {
      const label = filas.find((fila) => fila.recursoKey === recurso)?.recursoLabel ?? recurso;
      activos.push({ clave: 'recurso', etiqueta: `Recurso: ${label}` });
    }
    if (accion !== TODAS) {
      const label = filas.find((fila) => fila.accionKey === accion)?.accionLabel
        ?? PERMISO_ACTION_LABELS[accion] ?? accion;
      activos.push({ clave: 'accion', etiqueta: `Acción: ${label}` });
    }
    return activos;
  }
}
