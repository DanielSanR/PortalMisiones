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
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { conCarga } from '@shared/utils/carga';
import { formularioDePagina } from '@shared/utils/formulario-de-pagina';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { FormConfig } from '@core/models/field.interface';
import {
  FALLBACK_ORGANISMO, TEXTOS_ORGANISMO_INEXISTENTE, conflictosDeOrganismo, errorDeEliminarOrganismo, esOrganismoInexistente,
} from '../organismo-save-error';
import {
  OrigenEdicionOrganismo, PARAM_ORIGEN_EDICION, RUTA_DETALLE_ORGANISMO, RUTA_EDITAR_ORGANISMO, RUTA_LISTA_ORGANISMOS,
  origenEdicionDesde,
} from '../organismos.rutas';
import { aValorDeOrganismo, camposConCatalogos, camposDeOrganismo, valorInicialDe } from './organismo-campos';
import { TABS, TabDetalle, tabTrasTecla } from './organismo-pestanas';
import {
  CampoFicha, CatalogosDeOrganismo, Membrete, SIN_CATALOGOS, camposDeLectura, catalogosDe, datosDeMembrete, membreteDesde,
} from './organismo-vista';
import { PuedeTenerCambiosSinGuardar } from '@shared/guards/unsaved-changes.guard';
import { OrganismoVM, OrganismosFacade } from '@features/organismos';

/** `ver` y `editar` muestran un organismo existente; `nuevo` es el alta (todavía no hay entidad). */
type ModoFicha = 'ver' | 'editar' | 'nuevo';

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
    EstadoCargaComponent,
    MembreteComponent,
    HasPermissionDirective,
    PageActionsDirective,
    UnavailableDirective,
  ],
  templateUrl: './organismo-detail.component.html',
  styleUrl: './organismo-detail.component.scss',
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
  /** El error de carga es "ese organismo no existe" (404): sin "Reintentar", con "Ir al listado". */
  noExiste = false;
  readonly textosInexistente = TEXTOS_ORGANISMO_INEXISTENTE;
  /**
   * Guardado (alta y edición) y cambios sin guardar: el marco común de formulario de página. La carga NO va por
   * el marco: la misma lectura sirve al modo `ver`, que no es un formulario (ver `cargar`).
   */
  readonly marco = formularioDePagina<never>();

  config: FormConfig = camposDeOrganismo();
  initialData: Record<string, unknown> | null = null;
  /** Texto a la izquierda de los botones del formulario. */
  ayudaDelForm = '';

  readonly tabs = TABS;
  readonly tab$ = new BehaviorSubject<TabDetalle>('datos');
  readonly membrete$ = new BehaviorSubject<Membrete>(membreteDesde(null, SIN_CATALOGOS));

  private id = '';

  /** Adónde vuelve la edición al guardar o cancelar (ver `organismos.rutas.ts`). */
  private origen: OrigenEdicionOrganismo = 'ficha';

  /** Nombres de los catálogos por id, para el membrete y la tarjeta de lectura. */
  private catalogos: CatalogosDeOrganismo = SIN_CATALOGOS;

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

  /** Campos de la tarjeta de datos en modo lectura: solo lo que el backend guarda. */
  get campos(): CampoFicha[] {
    return camposDeLectura(this.organismo, this.catalogos);
  }

  /**
   * Una sola llamada para los tres modos: `getFormData` trae los catálogos y, si hay id, el
   * organismo. Sirve tanto para resolver los nombres de la ficha como para poblar el formulario.
   */
  cargar(): void {
    this.facade.getFormData(this.id || undefined)
      // "No existe" solo tiene sentido con un organismo pedido: en el alta un 404 sería de un catálogo.
      .pipe(conCarga((err) => !!this.id && esOrganismoInexistente(err)), takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => {
        this.loading = estado.tipo === 'cargando';
        this.error = estado.tipo === 'error';
        this.noExiste = estado.tipo === 'error' && estado.noExiste;

        if (estado.tipo === 'ok') {
          const { organismo } = estado.valor;
          this.organismo = organismo;
          this.catalogos = catalogosDe(estado.valor);
          this.membrete$.next(membreteDesde(organismo, this.catalogos));

          if (this.editando) {
            this.config = camposConCatalogos(this.config, estado.valor, this.id);
            if (organismo) this.initialData = valorInicialDe(organismo);
            this.ayudaDelForm = organismo?.updatedAt
              ? `Última modificación: ${formatDate(organismo.updatedAt, 'dd/MM/yyyy HH:mm', this.locale)}`
              : 'Los campos con * son obligatorios.';
          }
        }
        this.cdr.markForCheck();
      });
  }

  /** El formulario cambió: el membrete acompaña lo que se está escribiendo. */
  onFormValue(valor: Record<string, unknown>): void {
    this.membrete$.next(membreteDesde(datosDeMembrete(valor), this.catalogos));
  }

  /**
   * La pestaña es navegación DENTRO de la entidad: no cambia el modo. Editando, el formulario
   * se oculta en vez de destruirse (ver el template), así no se pierde lo escrito.
   */
  seleccionarTab(clave: TabDetalle): void {
    this.tab$.next(clave);
  }

  /** Teclado del tablist (ver `tabTrasTecla`). El foco acompaña a la selección (tabindex móvil). */
  onTabsKeydown(event: KeyboardEvent): void {
    const destino = tabTrasTecla(event.key, this.tab$.value, this.tabs);
    if (!destino) return;
    event.preventDefault();
    this.seleccionarTab(destino);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`#orgdet-tab-${destino}`)?.focus();
  }

  volver(): void {
    this.router.navigate([RUTA_LISTA_ORGANISMOS]);
  }

  onEditar(): void {
    this.router.navigate([RUTA_EDITAR_ORGANISMO, this.id], {
      queryParams: { [PARAM_ORIGEN_EDICION]: 'ficha' },
    });
  }

  /** Cancelación del formulario: sale a donde también lleva el guardado. */
  salirDelFormulario(): void {
    this.router.navigate(this.destinoDelFormulario());
  }

  /** A dónde se sale del formulario: el alta vuelve a la lista; la edición, a donde el usuario la abrió. */
  private destinoDelFormulario(): unknown[] {
    return this.modo === 'nuevo' || this.origen === 'lista' ? [RUTA_LISTA_ORGANISMOS] : [RUTA_DETALLE_ORGANISMO, this.id];
  }

  async onSubmit(data: Record<string, unknown>): Promise<void> {
    // Guarda síncrona: dos envíos seguidos (doble clic, Enter repetido) no crean dos organismos.
    if (this.marco.guardando) return;
    const valor = aValorDeOrganismo(data);
    const esAlta = this.modo === 'nuevo';

    // `marco.guardando` sigue en true hasta que la navegación ocurre: así el guard no pregunta por cambios sin guardar.
    await this.marco.guardar({
      peticion$: esAlta ? this.facade.create(valor) : this.facade.update(this.id, valor),
      form: this.dynamicForm?.form,
      motor: this.dynamicForm,
      conflictos: conflictosDeOrganismo({ esAlta, tieneSuperior: valor.parentId !== null }),
      fallback: FALLBACK_ORGANISMO,
      aviso: () => (esAlta ? 'Organismo creado correctamente' : 'Organismo actualizado'),
      destino: () => this.destinoDelFormulario(),
      esAlta,
      siNoNavega: 'El organismo ya se creó, pero no pudimos abrir la lista. Buscalo ahí.',
    });
  }

  /** Lo consulta `unsavedChangesGuard` (en modo `ver` no hay formulario). */
  tieneCambiosSinGuardar(): boolean {
    return this.editando && this.marco.tieneCambiosSinGuardar(this.dynamicForm?.form);
  }

  onDelete(): void {
    const organismo = this.organismo;
    if (!organismo) return;

    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Eliminar el organismo?',
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando…',
        confirmAction: () => this.facade.delete(organismo.id),
        errorDeAccion: errorDeEliminarOrganismo,
      },
      aviso: 'Organismo eliminado',
      alConfirmar: () => this.volver(),
    });
  }
}
