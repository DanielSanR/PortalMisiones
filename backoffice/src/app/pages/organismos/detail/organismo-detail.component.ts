import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';
import { FormConfig } from '../../../core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_ORGANISMO, FALLBACK_ORGANISMO } from '../organismo-save-error';
import { OrigenEdicionOrganismo, PARAM_ORIGEN_EDICION, origenEdicionDesde } from '../organismo-origen';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { OrganismoFormValue, OrganismoVM, OrganismosFacade } from '@features/organismos';

/** Pestañas de la entidad (diseño: mismas en la ficha y en la edición). */
type TabDetalle = 'datos' | 'tramites' | 'responsables' | 'historial';

interface Tab {
  clave: TabDetalle;
  label: string;
  /** Contador del pill. `null` cuando el dato todavía no existe en el backend. */
  contador: number | null;
}

/** Un campo de la ficha. `pendiente` marca los que el backend aún no expone. */
interface CampoFicha {
  label: string;
  valor: string | null;
  pendiente?: boolean;
}

/**
 * Ficha de organismo. Es UNA pantalla en dos modos, como el diseño: comparte
 * membrete, chip de modificación y pestañas, y la pestaña "Datos" pasa de lectura
 * a formulario según la ruta (`detalle/:id` vs `editar/:id`).
 *
 * El alta (`nuevo`) sigue en `OrganismoFormComponent`: no hay entidad todavía, así
 * que no tiene membrete, ni fecha de modificación, ni pestañas que mostrar.
 */
@Component({
  selector: 'app-organismo-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    DynamicFormComponent,
    HasPermissionDirective,
    PageActionsDirective,
    UnavailableDirective,
  ],
  templateUrl: './organismo-detail.component.html',
  styleUrls: ['./organismo-detail.component.scss'],
})
export class OrganismoDetailComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(OrganismosFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  /** `editar` lo fija la ruta; sin eso, la ficha se muestra en lectura. */
  modo: 'ver' | 'editar' = 'ver';

  organismo: OrganismoVM | null = null;
  tipoNombre: string | null = null;
  parentNombre: string | null = null;
  localidadNombre: string | null = null;

  loading = true;
  error = false;
  saving = false;
  serverError = '';

  config: FormConfig = getFormConfig('ORGANISMO');
  initialData: Record<string, unknown> | null = null;

  readonly tab$ = new BehaviorSubject<TabDetalle>('datos');

  /**
   * Los contadores van en `null` porque el backend no expone ni los trámites por
   * organismo ni sus responsables. Mostrar un 0 sería afirmar que no tiene.
   */
  readonly tabs: Tab[] = [
    { clave: 'datos', label: 'Datos', contador: null },
    { clave: 'tramites', label: 'Trámites', contador: null },
    { clave: 'responsables', label: 'Responsables', contador: null },
    { clave: 'historial', label: 'Historial', contador: null },
  ];

  /** Pestañas que se muestran: editando no hay "Trámites" (el diseño tiene Datos / Responsables / Historial). */
  tabsVisibles: Tab[] = this.tabs;

  private id = '';

  /** Adónde vuelve la edición al guardar o cancelar (ver `organismo-origen.ts`). */
  private origen: OrigenEdicionOrganismo = 'ficha';

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'] ?? '';
    this.modo = this.route.snapshot.data['modo'] === 'editar' ? 'editar' : 'ver';
    this.tabsVisibles = this.modo === 'editar' ? this.tabs.filter((t) => t.clave !== 'tramites') : this.tabs;
    this.origen = origenEdicionDesde(this.route.snapshot.queryParamMap.get(PARAM_ORIGEN_EDICION));
    this.cargar();
  }

  /**
   * Una sola llamada para los dos modos: `getFormData` ya trae el organismo y los
   * catálogos, así que sirve tanto para resolver los nombres de la ficha como para
   * poblar los selects del formulario.
   */
  cargar(): void {
    this.loading = true;
    this.error = false;
    this.facade.getFormData(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tipos, localidades, organismos, organismo }) => {
          this.organismo = organismo;
          this.tipoNombre = tipos.find((t) => t.id === organismo?.typeId)?.nombre ?? null;
          this.parentNombre = organismo?.parentId
            ? organismos.find((o) => o.id === organismo.parentId)?.nombre ?? null
            : null;
          this.localidadNombre = organismo?.baseLocationId
            ? localidades.find((l) => l.id === organismo.baseLocationId)?.nombre ?? null
            : null;

          if (this.modo === 'editar' && organismo) {
            this.prepararFormulario(tipos, localidades, organismos, organismo);
          }

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  private prepararFormulario(
    tipos: { id: string; nombre: string }[],
    localidades: { id: string; nombre: string }[],
    organismos: OrganismoVM[],
    organismo: OrganismoVM,
  ): void {
    this.config = updateFormConfigOptions(this.config, 'typeId',
      tipos.map((t) => ({ id: t.id, name: t.nombre })));

    const noElegibles = this.idsNoElegiblesComoPadre(organismos);
    this.config = updateFormConfigOptions(this.config, 'parentId', [
      { id: '', name: 'Ninguno (raíz)' },
      ...organismos
        .filter((o) => !noElegibles.has(o.id)) // sin auto-referencia ni descendientes: evita ciclos
        .map((o) => ({ id: o.id, name: o.nombre })),
    ]);

    this.config = updateFormConfigOptions(this.config, 'baseLocationId', [
      { id: '', name: 'Sin localidad' },
      ...localidades.map((l) => ({ id: l.id, name: l.nombre })),
    ]);

    this.initialData = {
      nombre: organismo.nombre,
      acronym: organismo.acronym,
      typeId: organismo.typeId,
      parentId: organismo.parentId ?? '',
      baseLocationId: organismo.baseLocationId ?? '',
      activo: organismo.activo,
    };
  }

  /**
   * Ids que NO pueden ser padre del organismo en edición: él mismo y toda su descendencia.
   * Elegir un descendiente como padre generaría un ciclo, y la regla de borrado
   * («tiene organismos hijos activos») asume que la jerarquía es un árbol.
   *
   * Recorre en oleadas en vez de bajar recursivamente porque los datos ya existentes
   * pueden contener ciclos creados antes de este control: al marcar cada id una sola vez,
   * el bucle termina siempre.
   */
  private idsNoElegiblesComoPadre(organismos: OrganismoVM[]): Set<string> {
    const noElegibles = new Set<string>();
    if (!this.id) return noElegibles;

    noElegibles.add(this.id);
    let huboCambios = true;
    while (huboCambios) {
      huboCambios = false;
      for (const o of organismos) {
        if (o.parentId && noElegibles.has(o.parentId) && !noElegibles.has(o.id)) {
          noElegibles.add(o.id);
          huboCambios = true;
        }
      }
    }
    return noElegibles;
  }

  /** Campos de la ficha en modo lectura, en el orden del diseño. */
  get campos(): CampoFicha[] {
    return [
      { label: 'Sigla', valor: this.organismo?.acronym || null },
      { label: 'Tipo de organismo', valor: this.tipoNombre },
      { label: 'Organismo superior', valor: this.parentNombre ?? 'Sin organismo superior' },
      { label: 'Localidad base', valor: this.localidadNombre },
      { label: 'Jurisdicción', valor: null, pendiente: true },
      { label: 'CUIT', valor: null, pendiente: true },
      { label: 'Domicilio', valor: null, pendiente: true },
      { label: 'Teléfono', valor: null, pendiente: true },
      { label: 'Correo institucional', valor: null, pendiente: true },
      { label: 'Sitio web', valor: null, pendiente: true },
      { label: 'Código SIGAF', valor: null, pendiente: true },
    ];
  }

  /**
   * La pestaña es navegación DENTRO de la entidad: no cambia el modo. Antes, elegir
   * "Trámites" mientras se editaba mandaba a la ficha, y al volver a "Datos" el
   * formulario ya no estaba: se perdía el modo edición —y lo escrito— sin avisar.
   * El formulario se oculta, no se destruye (ver el template).
   */
  seleccionarTab(clave: TabDetalle): void {
    this.tab$.next(clave);
  }

  /**
   * Teclado del tablist (patrón APG, activación automática): ←/→ recorren las pestañas con vuelta,
   * Inicio/Fin saltan a la primera/última. El foco acompaña a la selección (tabindex móvil).
   */
  onTabsKeydown(event: KeyboardEvent): void {
    const claves = this.tabsVisibles.map((t) => t.clave);
    const actual = claves.indexOf(this.tab$.value);
    const ultimo = claves.length - 1;
    let destino: number;
    switch (event.key) {
      case 'ArrowRight': destino = actual >= ultimo ? 0 : actual + 1; break;
      case 'ArrowLeft': destino = actual <= 0 ? ultimo : actual - 1; break;
      case 'Home': destino = 0; break;
      case 'End': destino = ultimo; break;
      default: return;
    }
    event.preventDefault();
    this.seleccionarTab(claves[destino]);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#orgdet-tab-${claves[destino]}`)?.focus();
  }

  /** Iniciales del membrete: la sigla si existe, si no las del nombre. */
  get iniciales(): string {
    const sigla = (this.organismo?.acronym ?? '').replace(/[^\p{L}]/gu, '');
    if (sigla.length >= 2) return sigla.slice(0, 3).toLocaleUpperCase('es-AR');

    const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);
    const palabras = (this.organismo?.nombre ?? '')
      .split(/\s+/)
      .filter((p) => /\p{L}/u.test(p) && !conectores.has(p.toLocaleLowerCase('es-AR')));
    if (palabras.length === 0) return '—';
    const letras = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras.slice(0, 2).map((p) => p[0]).join('');
    return letras.toLocaleUpperCase('es-AR');
  }

  volver(): void {
    this.router.navigate(['/dashboard/organismos/lista']);
  }

  onEditar(): void {
    this.router.navigate(['/dashboard/organismos/editar', this.id], {
      queryParams: { [PARAM_ORIGEN_EDICION]: 'ficha' },
    });
  }

  onVerFicha(): void {
    this.router.navigate(['/dashboard/organismos/detalle', this.id]);
  }

  /** Cierra la edición (guardado o cancelación) volviendo a donde el usuario la abrió. */
  salirDeLaEdicion(): void {
    if (this.origen === 'lista') {
      this.volver();
    } else {
      this.onVerFicha();
    }
  }

  /** Lo dispara el botón del header; el form vive en el hijo. */
  guardarDesdeElHeader(): void {
    this.dynamicForm?.submit();
  }

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';
    const form: OrganismoFormValue = {
      typeId: String(data['typeId'] ?? ''),
      parentId: (data['parentId'] as string) || null,
      baseLocationId: (data['baseLocationId'] as string) || null,
      nombre: String(data['nombre'] ?? ''),
      acronym: String(data['acronym'] ?? ''),
      activo: data['activo'] !== false,
    };

    this.facade.update(this.id, form)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Organismo actualizado', 'OK',
            { duration: 3000, panelClass: 'snackbar-success' });
          this.salirDeLaEdicion();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_ORGANISMO, FALLBACK_ORGANISMO);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Lo consulta `unsavedChangesGuard`. Durante un guardado en curso `saving` sigue en
   * true hasta que la navegación de éxito ocurre, así que un guardado exitoso no
   * dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return this.modo === 'editar' && !this.saving && !!this.dynamicForm?.form?.dirty;
  }

  onDelete(): void {
    const organismo = this.organismo;
    if (!organismo) return;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el organismo?',
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        confirmAction: () => this.facade.delete(organismo.id),
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.volver();
      });
  }
}
