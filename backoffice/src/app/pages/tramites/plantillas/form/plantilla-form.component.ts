import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { PlantillaCatalogos, PlantillaFormData, PlantillasFacade } from '@features/plantillas';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { CampoPropioDirective } from '@shared/directives/campo-propio.directive';
import { PuedeTenerCambiosSinGuardar } from '@shared/guards/unsaved-changes.guard';
import { ErrorDeCargaDePagina, formularioDePagina } from '@shared/utils/formulario-de-pagina';
import {
  CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA, TEXTOS_PLANTILLA_INEXISTENTE, esPlantillaInexistente,
} from '../plantilla-save-error';
import { PLANTILLA_SIN_TITULO } from '../plantilla-textos';
import { RUTA_DETALLE_PLANTILLA, RUTA_LISTA_PLANTILLAS } from '../plantillas.rutas';
import {
  ResumenDePlantilla, ValorDePlantilla, aPlantillaFormValue, camposDePlantilla, claveDeCampos, conSeleccionados,
  leerValorDePlantilla, panelesDePlantilla, resumenDePlantilla, totalElegidas, valorInicialDePlantilla,
} from './plantilla-campos';

/**
 * Alta y edición de una plantilla provincial: `app-dynamic-form` con dos paneles (datos | clasificación),
 * descrito en `plantilla-campos.ts`, sobre el marco de formulario de página (carga, guardado, salida).
 *
 * Nada se dibuja hasta que `getFormData()` resolvió, para no pisar una plantilla con un formulario vacío.
 */
@Component({
  selector: 'app-plantilla-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSnackBarModule, DynamicFormComponent, CampoPropioDirective, EstadoCargaComponent, MembreteComponent],
  templateUrl: './plantilla-form.component.html',
  styleUrl: './plantilla-form.component.scss',
})
export class PlantillaFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(PlantillasFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly marco = formularioDePagina<PlantillaFormData>();
  readonly sinTitulo = PLANTILLA_SIN_TITULO;

  esEdicion = false;
  /** Catálogos de los campos, con lo elegido que ya no está en el catálogo agregado como "No disponible". */
  catalogos: PlantillaCatalogos | null = null;
  /** Valor con el que se abrió el formulario (`initialData` del motor). La referencia no cambia mientras se edita. */
  valorInicial: ValorDePlantilla | null = null;
  campos: FieldConfig[] = [];
  paneles: PanelDeFormulario[] = [];
  /** El formulario en vivo, resumido: membrete e indicador de datos recomendados. */
  resumen: ResumenDePlantilla | null = null;

  @ViewChild(DynamicFormComponent) private motor?: DynamicFormComponent;

  private id: string | null = null;
  /** De qué valores salieron `campos` y `paneles`: solo se rearman cuando cambian. */
  private claveDeCampos = '';
  private total = '';
  /** Slug que el backend rechazó por repetido: al cambiarlo, el banner de ese intento deja de ser cierto. */
  private slugRechazado: string | null = null;

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'] ?? null;
    this.esEdicion = !!this.id;
    void this.cargar();
  }

  /** Catálogos + plantilla en un solo pedido: un estado de carga y uno de error. También es "Reintentar". */
  async cargar(): Promise<void> {
    const datos = await this.marco.cargar(this.facade.getFormData(this.id), (err) => this.aErrorDeCarga(err));
    if (!datos) return;
    this.catalogos = datos.plantilla ? conSeleccionados(datos.catalogos, datos.plantilla) : datos.catalogos;
    this.valorInicial = valorInicialDePlantilla(datos.plantilla);
    this.claveDeCampos = '';
    this.total = '';
    this.reflejar(this.valorInicial);
    this.cdr.markForCheck();
  }

  /**
   * El formulario cambió (`valueChanges` del motor): se rearma lo que depende del valor. La categoría
   * principal (opciones, bloqueo y ayuda) sale de las categorías elegidas, así que `campos` se vuelve a
   * entregar cuando cambian ellas o la principal; con cualquier otro cambio se conserva la referencia.
   */
  alCambiar(crudo: Record<string, unknown>): void {
    const valor = leerValorDePlantilla(crudo);
    if (this.slugRechazado !== null && valor.slug !== this.slugRechazado) {
      this.slugRechazado = null;
      this.marco.limpiarErrorDeGuardado();
    }
    this.reflejar(valor);
  }

  async onSubmit(crudo: Record<string, unknown>): Promise<void> {
    const form = aPlantillaFormValue(crudo);
    const accion = this.id ? 'actualizada' : 'creada';
    await this.marco.guardar({
      peticion$: this.id ? this.facade.update(this.id, form) : this.facade.create(form),
      form: this.motor?.form,
      motor: this.motor,
      conflictos: CONFLICTOS_PLANTILLA,
      fallback: FALLBACK_PLANTILLA,
      aviso: (guardada) => ({
        texto: guardada.activa ? `Plantilla ${accion}` : `Plantilla ${accion}. Está desactivada: no aparece en el listado`,
        opciones: { duracion: 4000 },
      }),
      destino: (guardada) => [RUTA_DETALLE_PLANTILLA, guardada.id],
      esAlta: !this.id,
      siNoNavega: 'La plantilla ya se creó, pero no pudimos abrir la pantalla siguiente. Buscala en la lista.',
    });
    this.slugRechazado = this.motor?.form.get('slug')?.hasError('server') ? form.slug : null;
  }

  cancelar(): void {
    if (this.id) {
      void this.router.navigate([RUTA_DETALLE_PLANTILLA, this.id]);
      return;
    }
    this.volverAlListado();
  }

  volverAlListado(): void {
    void this.router.navigate([RUTA_LISTA_PLANTILLAS]);
  }

  /** Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla. */
  tieneCambiosSinGuardar(): boolean {
    return this.marco.tieneCambiosSinGuardar(this.motor?.form);
  }

  private reflejar(valor: ValorDePlantilla): void {
    if (!this.catalogos) return;
    const clave = claveDeCampos(valor);
    if (clave !== this.claveDeCampos || !this.campos.length) {
      this.claveDeCampos = clave;
      this.campos = camposDePlantilla(this.catalogos, valor, this.esEdicion);
    }
    const total = totalElegidas(valor);
    if (total !== this.total) {
      this.total = total;
      this.paneles = panelesDePlantilla(this.esEdicion, total);
    }
    this.resumen = resumenDePlantilla(valor, this.catalogos);
  }

  private aErrorDeCarga(err: unknown): ErrorDeCargaDePagina {
    if (this.esEdicion && esPlantillaInexistente(err)) {
      return { noExiste: true, ...TEXTOS_PLANTILLA_INEXISTENTE };
    }
    return {
      noExiste: false,
      titulo: this.esEdicion ? 'No pudimos cargar la plantilla' : 'No pudimos cargar el formulario',
      texto: 'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
    };
  }
}
