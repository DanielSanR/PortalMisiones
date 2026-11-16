import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, LOCALE_ID, inject } from '@angular/core';
import { AsyncPipe, DatePipe, NgTemplateOutlet, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { abrirConfirmacion } from '../../../shared/utils/abrir-confirmacion';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions, updateFormConfigTree } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';
import { FormConfig, TreeOption } from '../../../core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { CONFLICTOS_ORGANISMO, FALLBACK_ORGANISMO } from '../organismo-save-error';
import { OrigenEdicionOrganismo, PARAM_ORIGEN_EDICION, origenEdicionDesde } from '../organismo-origen';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { OrganismoFormValue, OrganismoVM, OrganismosFacade } from '@features/organismos';

/** `ver` y `editar` muestran un organismo existente; `nuevo` es el alta (todavía no hay entidad). */
type ModoFicha = 'ver' | 'editar' | 'nuevo';

/** Pestañas de la entidad (las mismas en la ficha y en la edición; el alta no tiene). */
type TabDetalle = 'datos' | 'tramites' | 'responsables' | 'historial';

interface Tab {
  clave: TabDetalle;
  label: string;
  /** Contador del pill. `null` cuando el dato todavía no existe en el backend. */
  contador: number | null;
}

/** Un campo de la tarjeta de datos en modo lectura. */
interface CampoFicha {
  label: string;
  valor: string | null;
}

/**
 * Lo que muestra el membrete. En lectura sale del organismo guardado; editando o dando de alta
 * sale del formulario, así se actualiza mientras el usuario escribe.
 */
interface Membrete {
  nombre: string;
  /** Sigla o iniciales del nombre; vacío cuando todavía no hay nada escrito (se dibuja un ícono). */
  iniciales: string;
  activo: boolean;
  tipo: string | null;
  /** "Depende de X" u "Organismo raíz". */
  depende: string;
  localidad: string | null;
}

/** Valores del formulario que alimentan el membrete. */
interface DatosMembrete {
  nombre: string;
  acronym: string;
  typeId: string;
  parentId: string | null;
  baseLocationId: string | null;
  activo: boolean;
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);

/**
 * Ficha de organismo. Es UNA pantalla en tres modos, como el diseño ("Ver / Editar / Nuevo
 * organismo" de «Pantallas · Backoffice Misiones»): comparten membrete y grilla, y la tarjeta
 * "Datos institucionales" pasa de lectura a formulario según la ruta
 * (`detalle/:id`, `editar/:id`, `nuevo`).
 *
 * El alta no tiene pestañas ni los bloques de la entidad (trámites, resumen, responsables,
 * actividad): todavía no existe. En su lugar la columna lateral dice qué se puede hacer después.
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
  private readonly locale = inject(LOCALE_ID);

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  /** Lo fija la ruta; sin dato, la ficha se muestra en lectura. */
  modo: ModoFicha = 'ver';

  organismo: OrganismoVM | null = null;

  loading = true;
  error = false;
  saving = false;
  serverError = '';

  config: FormConfig = getFormConfig('ORGANISMO');
  initialData: Record<string, unknown> | null = null;
  /** Texto a la izquierda de los botones del formulario. */
  ayudaDelForm = '';

  readonly tab$ = new BehaviorSubject<TabDetalle>('datos');
  readonly membrete$ = new BehaviorSubject<Membrete>(this.membreteDesde(null));

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

  private id = '';

  /** Adónde vuelve la edición al guardar o cancelar (ver `organismo-origen.ts`). */
  private origen: OrigenEdicionOrganismo = 'ficha';

  /** Nombres de los catálogos por id, para el membrete y la tarjeta de lectura. */
  private tiposPorId = new Map<string, string>();
  private organismosPorId = new Map<string, string>();
  private localidadesPorId = new Map<string, string>();

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'] ?? '';
    const modo = this.route.snapshot.data['modo'];
    this.modo = modo === 'editar' || modo === 'nuevo' ? modo : 'ver';
    this.origen = origenEdicionDesde(this.route.snapshot.queryParamMap.get(PARAM_ORIGEN_EDICION));
    this.cargar();
  }

  get editando(): boolean {
    return this.modo !== 'ver';
  }

  /**
   * Una sola llamada para los tres modos: `getFormData` trae los catálogos y, si hay id, el
   * organismo. Sirve tanto para resolver los nombres de la ficha como para poblar el formulario.
   */
  cargar(): void {
    this.loading = true;
    this.error = false;
    this.facade.getFormData(this.id || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tipos, localidades, organismos, organismo }) => {
          this.organismo = organismo;
          this.tiposPorId = new Map(tipos.map((t) => [t.id, t.nombre]));
          this.organismosPorId = new Map(organismos.map((o) => [o.id, o.nombre]));
          this.localidadesPorId = new Map(localidades.map((l) => [l.id, l.nombre]));
          this.membrete$.next(this.membreteDesde(organismo));

          if (this.editando) {
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
    organismo: OrganismoVM | null,
  ): void {
    this.config = updateFormConfigOptions(this.config, 'typeId',
      tipos.map((t) => ({ id: t.id, name: t.nombre })));

    this.config = updateFormConfigTree(this.config, 'parentId', {
      nodes: this.nodosDelArbol(organismos),
      self: {
        id: this.id || null,
        label: organismo?.nombre ?? 'Nuevo organismo',
        tag: 'Este organismo',
      },
    });

    this.config = updateFormConfigOptions(this.config, 'baseLocationId', [
      { id: '', name: 'Sin localidad' },
      ...localidades.map((l) => ({ id: l.id, name: l.nombre })),
    ]);

    if (organismo) {
      this.initialData = {
        nombre: organismo.nombre,
        acronym: organismo.acronym,
        typeId: organismo.typeId,
        parentId: organismo.parentId ?? '',
        baseLocationId: organismo.baseLocationId ?? '',
        activo: organismo.activo,
      };
    }

    this.ayudaDelForm = organismo?.updatedAt
      ? `Última modificación: ${formatDate(organismo.updatedAt, 'dd/MM/yyyy HH:mm', this.locale)}`
      : 'Los campos con * son obligatorios.';
  }

  /**
   * Organismos del desplegable "Organismo superior". Los que no se pueden elegir se muestran con
   * su motivo en vez de ocultarse: el propio organismo queda afuera (el árbol lo dibuja aparte,
   * como "Este organismo"), su descendencia va como "Depende de este" y los inactivos como tales
   * (el backend rechaza un padre inactivo con 409 `4071`).
   */
  private nodosDelArbol(organismos: OrganismoVM[]): TreeOption[] {
    const dependientes = this.idsNoElegiblesComoPadre(organismos);
    return organismos
      .filter((o) => o.id !== this.id)
      .map((o) => ({
        id: o.id,
        label: o.nombre,
        meta: this.tiposPorId.get(o.typeId) ?? '',
        parentId: o.parentId,
        keywords: o.acronym,
        disabledReason: dependientes.has(o.id) ? 'Depende de este' : !o.activo ? 'Inactivo' : undefined,
      }));
  }

  /**
   * Ids que NO pueden ser padre del organismo en edición: él mismo y toda su descendencia.
   * Elegir un descendiente como padre generaría un ciclo, y la regla de borrado
   * («tiene organismos hijos activos») asume que la jerarquía es un árbol.
   *
   * Recorre en oleadas en vez de bajar recursivamente porque los datos ya existentes
   * pueden contener ciclos creados antes de este control: al marcar cada id una sola vez,
   * el bucle termina siempre. En alta (sin id) no hay nada que excluir.
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

  /** Campos de la tarjeta de datos en modo lectura: solo lo que el backend guarda. */
  get campos(): CampoFicha[] {
    const o = this.organismo;
    return [
      { label: 'Sigla', valor: o?.acronym || null },
      { label: 'Tipo de organismo', valor: o ? this.tiposPorId.get(o.typeId) ?? null : null },
      { label: 'Organismo superior', valor: (o?.parentId && this.organismosPorId.get(o.parentId)) || 'Sin organismo superior' },
      { label: 'Localidad base', valor: (o?.baseLocationId && this.localidadesPorId.get(o.baseLocationId)) || null },
    ];
  }

  /** El formulario cambió: el membrete acompaña lo que se está escribiendo. */
  onFormValue(valor: Record<string, unknown>): void {
    this.membrete$.next(this.membreteDesde({
      nombre: String(valor['nombre'] ?? ''),
      acronym: String(valor['acronym'] ?? ''),
      typeId: String(valor['typeId'] ?? ''),
      parentId: (valor['parentId'] as string) || null,
      baseLocationId: (valor['baseLocationId'] as string) || null,
      activo: valor['activo'] !== false,
    }));
  }

  private membreteDesde(datos: DatosMembrete | null): Membrete {
    const padre = datos?.parentId ? this.organismosPorId.get(datos.parentId) : undefined;
    return {
      nombre: datos?.nombre.trim() ?? '',
      iniciales: inicialesDe(datos?.acronym ?? '', datos?.nombre ?? ''),
      activo: datos?.activo ?? true,
      tipo: (datos?.typeId && this.tiposPorId.get(datos.typeId)) || null,
      depende: padre ? `Depende de ${padre}` : 'Organismo raíz',
      localidad: (datos?.baseLocationId && this.localidadesPorId.get(datos.baseLocationId)) || null,
    };
  }

  /**
   * La pestaña es navegación DENTRO de la entidad: no cambia el modo. Editando, el formulario
   * se oculta en vez de destruirse (ver el template), así no se pierde lo escrito.
   */
  seleccionarTab(clave: TabDetalle): void {
    this.tab$.next(clave);
  }

  /**
   * Teclado del tablist (patrón APG, activación automática): ←/→ recorren las pestañas con vuelta,
   * Inicio/Fin saltan a la primera/última. El foco acompaña a la selección (tabindex móvil).
   */
  onTabsKeydown(event: KeyboardEvent): void {
    const claves = this.tabs.map((t) => t.clave);
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

  /**
   * Cierra el formulario (guardado o cancelación). El alta vuelve a la lista; la edición, a donde
   * el usuario la abrió.
   */
  salirDelFormulario(): void {
    if (this.modo === 'nuevo' || this.origen === 'lista') {
      this.volver();
    } else {
      this.onVerFicha();
    }
  }

  onSubmit(data: Record<string, unknown>): void {
    // Guarda síncrona: dos envíos seguidos (doble clic, Enter repetido) no crean dos organismos.
    if (this.saving) return;
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

    const esAlta = this.modo === 'nuevo';
    const request$ = esAlta ? this.facade.create(form) : this.facade.update(this.id, form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(esAlta ? 'Organismo creado correctamente' : 'Organismo actualizado', 'OK',
            // Variante del design system (fondo #1A1A2E) — Kitchen Sink §07.
            { duration: 3000, panelClass: 'snackbar-success' });
          this.salirDelFormulario();
        },
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = aplicarErrorDeGuardado(err, this.dynamicForm?.form, CONFLICTOS_ORGANISMO, FALLBACK_ORGANISMO);
          this.dynamicForm?.refrescarErrores();
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
    return this.editando && !this.saving && !!this.dynamicForm?.form?.dirty;
  }

  onDelete(): void {
    const organismo = this.organismo;
    if (!organismo) return;

    abrirConfirmacion(this.dialog, {
      data: {
        title: '¿Eliminar el organismo?',
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(organismo.id),
      },
      panelClass: 'custom-modal-panel',
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.volver();
      });
  }
}

/** Iniciales del membrete: la sigla si existe, si no las del nombre; vacío si no hay ninguna. */
function inicialesDe(acronym: string, nombre: string): string {
  const sigla = acronym.replace(/[^\p{L}]/gu, '');
  if (sigla.length >= 2) return sigla.slice(0, 3).toLocaleUpperCase('es-AR');

  const palabras = nombre
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !CONECTORES.has(p.toLocaleLowerCase('es-AR')));
  if (palabras.length === 0) return '';
  const letras = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras.slice(0, 2).map((p) => p[0]).join('');
  return letras.toLocaleUpperCase('es-AR');
}
