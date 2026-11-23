import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ContentChildren, DestroyRef, ElementRef, EventEmitter, Input,
  OnChanges, OnInit, Output, QueryList, SimpleChanges, TemplateRef, ViewChild, inject, isDevMode,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, merge, takeUntil } from 'rxjs';
import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { CampoPropioDirective, ContextoDeCampoPropio } from '@shared/directives/campo-propio.directive';
import { CommonModule, DOCUMENT } from '@angular/common';
import { DynamicFormFieldComponent } from '../dynamic-form-field/dynamic-form-field.component';
import { FormActionsComponent } from '../form-actions/form-actions.component';
import { FormErrorBannerComponent } from '../form-error-banner/form-error-banner.component';
import { getControlErrorMessage, resumenDeErrores } from '../dynamic-form-field/form-error-messages.util';
import {
  NO_CONTROL_TYPES, PanelVista, claseDeCelda, entraAlResumen, esGrupoCorrido, idsRepetidos, llevaEtiquetaExterna, mismoValor, resolverPaneles,
} from './dynamic-form.estructura';
import { RechazoDelServidor, reglaDeRechazo, validadoresDe } from './dynamic-form.validadores';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    FormActionsComponent,
    FormErrorBannerComponent,
  ],
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() fields: FieldConfig[] = [];
  /** Para `escribir` de una `vista`: un campo `readonly` de los `fields` actuales no se escribe. Referencia estable. */
  readonly esCampoFijo = (name: string): boolean => this.fields.some((f) => f.name === name && !!f.readonly);
  @Input() submitButtonText = 'Guardar';
  /** Texto del botón mientras `saving` (se conserva junto al spinner). */
  @Input() savingButtonText = 'Guardando…';
  @Input() cancelButtonText = 'Cancelar';
  @Input() initialData?: Record<string, unknown> | null;
  @Input() hideButtons = false;
  @Input() saving = false;
  /**
   * Deshabilita "Guardar" mientras no haya cambios (`flows/saving-changes`, paso 2).
   *
   * Es opt-in y no default: aplica a la EDICIÓN, donde un guardado sin cambios es un
   * request al pedo y una fecha de modificación falsa. En un alta no corresponde —un
   * formulario con todo por defecto sería imposible de enviar—, así que las pantallas
   * lo atan a su propio `isEdit`.
   */
  @Input() requireChanges = false;
  /**
   * Mensaje devuelto por el backend al fallar el guardado. El contrato actual solo trae
   * `{code, message}` —sin errores por campo—, así que se muestra como banner general;
   * anclarlo a un campo puntual requeriría que el backend informe cuál falló.
   */
  @Input() serverError = '';
  @Input() helpText = 'Los cambios se publican al guardar.';
  /**
   * Variante para diálogos: grilla más ceñida y rótulos de sección chicos con un filete al lado, sin la
   * barra de acento de la página (ver `dynamic-form--compacto` en los estilos del motor).
   */
  @Input() compacto = false;
  /**
   * `id` del `<form>`, para que un botón de envío que vive FUERA del formulario (el pie de un diálogo,
   * con `hideButtons`) lo dispare con `form="…"` y Enter siga enviando.
   */
  @Input() formId = '';
  /**
   * Layout de dos paneles (formulario de página): la tarjeta `.ficha-paneles` con una sección por panel y el
   * pie de guardar integrado. Sin esto, la grilla de siempre. Ver `PanelDeFormulario`.
   */
  @Input() paneles: PanelDeFormulario[] | null = null;
  /** Los dos paneles pesan lo mismo (datos | permisos) en vez de principal ancho + lateral. */
  @Input() panelesIguales = false;

  @Output() formSubmit = new EventEmitter<Record<string, unknown>>();
  @Output() formCancel = new EventEmitter<void>();
  /**
   * Valor completo del formulario (`getRawValue()`, incluye deshabilitados) cada vez que cambia un
   * control: por el usuario o por un `setValue` de la página. Es para que la página reaccione a un
   * campo (rol → organismo) recalculando `fields` y volviéndolos a entregar.
   *
   * NO emite al re-entregar `fields` ni al aplicar `initialData`: las dos cosas las origina la
   * página, que ya conoce esos valores, y emitir en pleno `ngOnChanges` la haría cambiar su estado
   * durante la detección de cambios. Tampoco emite si el valor no cambió: `FormGroup.valueChanges`
   * también dispara por revalidaciones (p. ej. el `[required]` de un input al cambiar `fields`).
   */
  @Output() valueChanges = new EventEmitter<Record<string, unknown>>();

  form!: FormGroup;
  /** `paneles` con sus campos resueltos; `null` sin layout de paneles. */
  panelesVista: PanelVista[] | null = null;
  /** `name` del `select-multiple` con la lista abierta: uno solo a la vez. */
  seleccionAbierta: string | null = null;

  /** Templates `appCampoPropio` que proyecta la página, por `name` de campo. */
  @ContentChildren(CampoPropioDirective) private propios?: QueryList<CampoPropioDirective>;
  /** true luego del primer intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /**
   * Se incrementa al enviar: `markAllAsTouched()` no emite eventos ni cambia inputs, así que los
   * campos (OnPush) no se revisarían y sus errores no aparecerían. Viaja como `[revision]`.
   */
  revision = 0;

  /**
   * Banner de resumen de validación: se enfoca al enviar un formulario inválido. Por template ref y no por
   * tipo: `@ViewChild(FormErrorBannerComponent)` tomaba el PRIMER banner, que con un error de guardado a la
   * vista es el del servidor (`role="alert"`, no enfocable), y el resumen no recibía el foco ni se leía.
   */
  @ViewChild('resumen') private resumen?: FormErrorBannerComponent;

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  /** true mientras se aplica `initialData`: ese `patchValue` no se reemite por `valueChanges`. */
  private aplicandoInitialData = false;
  /** Último valor conocido del formulario: `valueChanges` solo emite si difiere de este. */
  private ultimoValor: Record<string, unknown> = {};
  /** Corta las suscripciones entre campos (`derivado`, `validarCon`) cada vez que se rearman con `fields`. */
  private readonly recableado$ = new Subject<void>();
  /**
   * Valores que el backend rechazó, por campo (`setErrors({ server })` + `refrescarErrores`). El error `server`
   * es un validador más del control (`reglaDeRechazo`): sobrevive a cualquier revalidación mientras el valor no
   * cambie, y se va al editarlo.
   */
  private readonly rechazos = new Map<string, RechazoDelServidor>();

  /** "Guardar" bloqueado porque es edición sin cambios (`requireChanges`). */
  get sinCambios(): boolean {
    return this.requireChanges && !!this.form?.pristine;
  }

  ngOnInit() {
    this.initForm();
    this.panelesVista = resolverPaneles(this.paneles, this.fields);
  }

  ngOnChanges(changes: SimpleChanges) {
    // Antes de `ngOnInit` (primer cambio) el form todavía no existe: lo arma `initForm`.
    if (!this.form) return;

    if (changes['fields']) {
      this.syncControls();
    }
    if (changes['fields'] || changes['paneles']) this.panelesVista = resolverPaneles(this.paneles, this.fields);
    if (changes['initialData'] && changes['initialData'].currentValue) {
      this.applyInitialData(changes['initialData'].currentValue);
    }
  }

  ngAfterViewInit(): void {
    if (isDevMode()) this.advertirIdsRepetidos();
  }

  /** En desarrollo avisa si un id de este formulario ya existe afuera (ver `idsRepetidos`). */
  private advertirIdsRepetidos(): void {
    const repetidos = idsRepetidos(this.document, this.host, this.fields);
    if (!repetidos.length) return;
    console.warn(
      `[app-dynamic-form] Ids repetidos en el documento: ${repetidos.join(', ')}. Ya hay otro elemento con ese id fuera de `
      + 'este formulario (¿un diálogo de formulario sobre una página con formulario embebido que comparte nombres de '
      + 'campo?). Las etiquetas quedan asociadas al campo equivocado: cambiá el `name` de uno de los dos.',
    );
  }

  /** Template `appCampoPropio` de un campo `custom` o `vista`, si la página lo proyectó. */
  plantillaDe(field: FieldConfig): TemplateRef<ContextoDeCampoPropio> | null {
    if (field.type !== 'custom' && field.type !== 'vista') return null;
    return this.propios?.find((propio) => propio.appCampoPropio === field.name)?.template ?? null;
  }

  /** Abre la lista de un `select-multiple` (cerrando la que estuviera abierta) o cierra la suya. */
  alternarSeleccion(nombre: string, abrir: boolean): void {
    this.seleccionAbierta = abrir ? nombre : this.seleccionAbierta === nombre ? null : this.seleccionAbierta;
  }

  /** `trackBy` del `*ngFor`: sin esto, cada `fields` nuevo recrea el DOM y se pierde el foco. */
  trackByName(_index: number, field: FieldConfig): string {
    return field.name;
  }

  private initForm() {
    const group = this.fb.group({});

    this.fields.forEach(field => {
      if (NO_CONTROL_TYPES.includes(field.type)) return;
      group.addControl(field.name, this.createControl(field));
    });

    this.form = group;
    this.form.markAsPristine();

    // El grupo es el mismo durante toda la vida del componente (`syncControls` lo conserva).
    this.ultimoValor = this.form.getRawValue();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Un `setValue` hecho por la página (campo `custom`) no pasa por un evento de esta vista:
        // sin esto "Guardar" (`sinCambios`) y los campos no se enterarían del cambio.
        this.cdr.markForCheck();
        const valor: Record<string, unknown> = this.form.getRawValue();
        const cambio = !mismoValor(valor, this.ultimoValor);
        this.ultimoValor = valor;
        if (cambio && !this.aplicandoInitialData) this.valueChanges.emit(valor);
      });
    this.cablearDependencias();
  }

  /**
   * Lo que un campo le debe a otro: el valor `derivado` que sigue a su origen y la revalidación de una
   * regla `validarCon`. Se rearma con cada `fields` (los controles pueden haber cambiado).
   */
  private cablearDependencias(): void {
    this.recableado$.next();
    const hasta = <T>() => takeUntil<T>(this.recableado$);
    for (const field of this.fields) {
      const control = this.form.get(field.name);
      if (!control) continue;

      const derivado = field.derivado;
      const origen = derivado?.seguir ? this.form.get(derivado.de) : null;
      if (derivado && origen) {
        origen.valueChanges.pipe(hasta(), takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
          // `setValue` no marca dirty: el campo sigue "sin tocar" y continúa acompañando al origen.
          if (control.pristine) control.setValue(derivado.transform(String(valor ?? '')));
        });
        // Vaciarlo a mano es pedir el derivado de nuevo: vuelve a quedar "sin tocar" y a acompañar al origen.
        control.valueChanges.pipe(hasta(), takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
          if (control.dirty && !String(valor ?? '').trim()) control.markAsPristine();
        });
      }

      const cruzada = field.readonly ? undefined : field.validations?.validarCon;
      const otros = (cruzada?.campos ?? []).map((nombre) => this.form.get(nombre)).filter((otro): otro is AbstractControl => !!otro);
      if (otros.length) {
        merge(...otros.map((otro) => otro.valueChanges)).pipe(hasta(), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
          // Recalcula los errores desde los validadores: el rechazo del servidor (`setErrors({ server })`) se olvida,
          // porque dependía de este otro campo (documentado en `FieldValidations.validarCon`).
          this.rechazos.delete(field.name);
          control.updateValueAndValidity({ emitEvent: false });
          // Con valor cargado, el error se muestra ya: lo provocó mover el otro campo, no hay que tocar este.
          if (control.value !== null && control.value !== '') control.markAsTouched();
          this.refrescarErrores();
        });
      }
    }
  }

  private createControl(field: FieldConfig) {
    const initialValue = this.initialData?.[field.name] ?? field.value ?? '';
    return this.fb.control({ value: initialValue, disabled: !!field.disabled }, this.validadoresDelControl(field));
  }

  /**
   * Los del campo y el del rechazo del servidor. Un campo `readonly` no lleva ninguno (la persona no podría
   * corregirlo y el formulario quedaría inválido sin salida: el rechazo lo cuenta el banner).
   */
  private validadoresDelControl(field: FieldConfig) {
    if (field.readonly) {
      this.rechazos.delete(field.name);
      return [];
    }
    return [...validadoresDe(field), reglaDeRechazo(this.rechazos, field.name)];
  }

  /** Anota el error `server` que el host puso en cada control, con el valor rechazado (ver `rechazos`). */
  private anotarRechazos(): void {
    for (const [nombre, control] of Object.entries(this.form.controls)) {
      const mensaje: unknown = control.errors?.['server'];
      if (mensaje !== undefined) this.rechazos.set(nombre, { valor: control.value, mensaje });
    }
  }

  /**
   * Reconciliación de controles cuando cambia `fields` después del primer render (típicamente
   * `updateFormConfigOptions` al llegar un catálogo async). Antes se rehacía el `FormGroup`
   * entero y se perdía lo tipeado —más el estado dirty/touched— mientras cargaban las opciones.
   * Ahora se conserva el mismo grupo y los mismos controles: solo se agregan los de campos
   * nuevos, se quitan los que ya no están y se actualizan validadores y `disabled`. Nada de
   * esto cambia el valor ni marca dirty, así que `requireChanges` y el guard no se ven afectados.
   *
   * Revalidar recalcula los errores desde los validadores: el `server` que marcó `aplicarErrorDeGuardado` sigue
   * porque es un validador más (`reglaDeRechazo`), atado al valor rechazado. La página re-entrega `fields` por un
   * cambio en OTRO campo (el alcance de un rol, las categorías de una plantilla, el rol de un usuario) y ese valor
   * sigue ahí. Se limpia al editar el campo y cuando un `validarCon` lo revalida porque cambió el campo del que
   * depende; no rige si el campo pasó a `readonly` o `disabled`.
   */
  private syncControls() {
    this.anotarRechazos();
    const conControl = this.fields.filter((field) => !NO_CONTROL_TYPES.includes(field.type));
    const nombres = new Set(conControl.map((field) => field.name));

    Object.keys(this.form.controls)
      .filter((nombre) => !nombres.has(nombre))
      .forEach((nombre) => {
        this.rechazos.delete(nombre);
        this.form.removeControl(nombre, { emitEvent: false });
      });

    conControl.forEach((field) => {
      const control = this.form.get(field.name);
      if (!control) {
        this.form.addControl(field.name, this.createControl(field), { emitEvent: false });
        return;
      }
      control.setValidators(this.validadoresDelControl(field));
      if (field.disabled && control.enabled) control.disable({ emitEvent: false });
      if (!field.disabled && control.disabled) control.enable({ emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });
    this.form.updateValueAndValidity({ emitEvent: false });
    // Controles agregados o quitados cambian el valor crudo sin que nadie haya editado nada.
    this.ultimoValor = this.form.getRawValue();
    this.cablearDependencias();
  }

  /**
   * Precarga lo que trae `initialData` y deja pristine solo esos controles: un `initialData`
   * parcial (p. ej. el padre preseleccionado en un alta) no debe borrar el dirty de lo que el
   * usuario ya escribió en los demás campos.
   */
  private applyInitialData(data: Record<string, unknown>) {
    this.aplicandoInitialData = true;
    try {
      this.form.patchValue(data);
    } finally {
      this.aplicandoInitialData = false;
    }
    Object.keys(data).forEach((nombre) => this.form.get(nombre)?.markAsPristine());
  }

  /** El campo ocupa una celda de la grilla (todos salvo `custom`, que lo dibuja la página). */
  seDibuja(field: FieldConfig): boolean {
    return field.type !== 'custom';
  }

  /** El campo lleva label overline externo (todos salvo tip/section-header/checkbox/custom). */
  showExternalLabel(field: FieldConfig): boolean {
    return llevaEtiquetaExterna(field);
  }

  /** Mensajes "Label (motivo)" de los campos inválidos y tocados — banner resumen. */
  invalidFieldMessages(): string[] {
    if (!this.form) return [];
    return resumenDeErrores(
      this.form,
      this.fields.filter(entraAlResumen),
      (control, field) => getControlErrorMessage(control, field),
    );
  }

  /** Grupo de un panel `'grupos'` de borde a borde (ver `esGrupoCorrido`). */
  grupoCorrido(grupo: FieldConfig[]): boolean {
    return esGrupoCorrido(grupo);
  }

  getFieldCssClass(field: FieldConfig): string {
    return claseDeCelda(field);
  }

  /**
   * Quien hospeda el formulario marcó un error en un control desde afuera (`setErrors` + `markAsTouched`
   * tras un rechazo del backend): eso no cambia ningún input, así que los campos OnPush no se revisarían.
   */
  refrescarErrores(): void {
    this.anotarRechazos();
    this.revision++;
    this.cdr.markForCheck();
  }

  submit() {
    if (this.form.valid) {
      this.submitted = false;
      this.formSubmit.emit(this.form.getRawValue());
    } else {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.revision++;
      // Render del banner y recién después el foco (sin esto `focus()` corre con el banner aún ausente).
      this.cdr.detectChanges();
      this.resumen?.focus();
    }
  }
}
