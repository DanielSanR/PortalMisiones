import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FieldConfig } from '@core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { UnavailableDirective } from '../../directives/unavailable.directive';
import { cierreConConfirmacion } from '../../utils/cierre-con-confirmacion';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FormErrorBannerComponent } from '../form-error-banner/form-error-banner.component';
import { LoadingComponent } from '../loading/loading.component';

/** Lo que entrega una carga exitosa: los campos del formulario y, en edición, sus valores iniciales. */
export interface FormDialogCarga {
  fields: FieldConfig[];
  initialData?: Record<string, unknown> | null;
}

/** Cómo se cuenta una carga fallida (o un formulario que no se puede abrir). */
export interface FormDialogErrorCarga {
  titulo: string;
  texto: string;
  /** Segundo párrafo opcional (qué se puede hacer en su lugar). */
  ayuda?: string;
  /** Con `true` ofrece "Reintentar"; con `false` solo "Cerrar" (ej. "no disponible"). */
  reintentable: boolean;
}

/**
 * Qué formulario muestra el diálogo y cómo se carga, se recalcula y se guarda. `R` es lo que devuelve
 * `guardar`, que es también lo que emite `afterClosed()` (`undefined` si se cerró sin guardar).
 */
export interface FormDialogData<R = unknown> {
  titulo: string;
  /** Línea opcional bajo el título: para qué sirve lo que se carga, o sobre quién se actúa. */
  subtitulo?: string;
  /** Texto del botón de guardar ("Crear usuario", "Guardar cambios"). */
  textoGuardar: string;
  /** Texto del botón mientras guarda. Por defecto "Guardando…". */
  textoGuardando?: string;
  /** Edición: "Guardar" queda bloqueado (con motivo) hasta que cambie algo. */
  requiereCambios?: boolean;
  /**
   * Texto de la confirmación de descarte. Cerrar con cambios sin guardar (X, Cancelar, Escape, clic afuera)
   * siempre la pide (`cierreConConfirmacion`); sin cambios cierra directo.
   */
  mensajeDescartar?: string;
  /** Id del `<form>` del motor: el botón del pie (fuera del form) lo envía con `form="…"`. */
  formId?: string;
  /** Campos e iniciales. Se vuelve a llamar en cada "Reintentar". */
  cargar: () => Observable<FormDialogCarga>;
  /** Traduce el fallo de `cargar`. Por defecto: "No pudimos cargar el formulario" con "Reintentar". */
  errorDeCarga?: (err: unknown) => FormDialogErrorCarga;
  /**
   * El usuario cambió algo: devuelve los campos recalculados, o `null` si no cambian (así no se recrea
   * el array ni se pierde el foco).
   */
  alCambiar?: (valor: Record<string, unknown>) => FieldConfig[] | null;
  guardar: (valor: Record<string, unknown>) => Observable<R>;
  /** Marca el rechazo en su campo y devuelve el texto del banner. Por defecto, el mensaje del backend. */
  errorDeGuardado?: (err: unknown, form: FormGroup | undefined) => string;
}

const FORM_ID_POR_DEFECTO = 'form-dialog-form';
const FALLBACK_GUARDADO = 'No se pudo guardar. Intentá de nuevo.';
const ERROR_DE_CARGA: FormDialogErrorCarga = {
  titulo: 'No pudimos cargar el formulario',
  texto: 'Revisá tu conexión e intentá de nuevo.',
  reintentable: true,
};

/**
 * Marco de "formulario en diálogo sobre una lista": cabecera con título y X, cuerpo con scroll que
 * hospeda `app-dynamic-form`, estados de carga y de error de carga, banner de error de guardado y pie
 * con Cancelar + Guardar. No conoce ninguna entidad: todo llega por `MAT_DIALOG_DATA` ({@link FormDialogData}).
 *
 * Se abre con `abrirFormDialog` (`panelClass: 'custom-modal-panel'`, `autoFocus: 'dialog'`: el foco pasa al
 * primer campo cuando termina de cargar). Todo cierre pasa por `cierreConConfirmacion`.
 */
@Component({
  selector: 'app-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    LoadingComponent,
    FormErrorBannerComponent,
    DynamicFormComponent,
    UnavailableDirective,
  ],
  templateUrl: './form-dialog.component.html',
  styleUrl: './form-dialog.component.scss',
})
export class FormDialogComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject<MatDialogRef<FormDialogComponent, unknown>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly data = inject<FormDialogData>(MAT_DIALOG_DATA);

  readonly formId = this.data.formId ?? FORM_ID_POR_DEFECTO;

  fields: FieldConfig[] = [];
  initialData: Record<string, unknown> | null = null;
  guardando = false;
  loading = true;
  /** Motivo del último fallo de guardado, junto a las acciones (siempre a la vista). */
  serverError = '';
  /** La carga falló: sin esto el formulario quedaría vacío y en silencio. */
  errorCarga: FormDialogErrorCarga | null = null;
  /** El usuario ya cambió algo (en edición habilita "Guardar"). */
  hayCambios = false;

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  /** El diálogo ya se destruyó: nada de tocar la vista ni mover el foco. */
  private destroyed = false;

  /** Camino de cierre único (X, Cancelar, Escape, clic afuera): confirma si hay cambios sin guardar. */
  private readonly cerrarConConfirmacion = cierreConConfirmacion({
    dialog: this.dialog,
    dialogRef: this.dialogRef,
    destroyRef: this.destroyRef,
    hayCambios: () => !!this.dynamicForm?.form?.dirty,
    ocupado: () => this.guardando,
    mensaje: this.data.mensajeDescartar,
  });

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  /** Reintento del estado de error de carga. */
  reintentar(): void {
    void this.cargar();
  }

  /** "Guardar" bloqueado: es edición y todavía no cambió nada. */
  get sinCambios(): boolean {
    return !!this.data.requiereCambios && !this.hayCambios;
  }

  private async cargar(): Promise<void> {
    this.loading = true;
    this.errorCarga = null;
    this.cdr.markForCheck();

    try {
      const carga = await unaVez(this.data.cargar(), this.destroyRef);
      this.initialData = carga.initialData ?? null;
      this.fields = carga.fields;
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.errorCarga = this.data.errorDeCarga?.(err) ?? ERROR_DE_CARGA;
    } finally {
      if (!this.destroyed) {
        this.loading = false;
        this.cdr.markForCheck();
        this.enfocarInicial();
      }
    }
  }

  /** El usuario cambió algo: la configuración puede recalcular los campos. */
  onValueChanges(valor: Record<string, unknown>): void {
    this.hayCambios = !!this.dynamicForm?.form?.dirty;
    const campos = this.data.alCambiar?.(valor);
    if (campos) this.fields = campos;
  }

  async onSubmit(valor: Record<string, unknown>): Promise<void> {
    if (this.guardando) return;
    this.guardando = true;
    this.serverError = '';
    this.cdr.markForCheck();

    // `unaVez`: si el diálogo se destruye con el guardado en vuelo, el request se cancela y no hay
    // nada que mostrar. Cualquier otro rechazo (también un stream que completa vacío) es un fallo de
    // guardado y tiene que liberar el formulario.
    let guardado: unknown;
    try {
      guardado = await unaVez(this.data.guardar(valor), this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return;
      this.guardando = false;
      const form = this.dynamicForm?.form;
      this.serverError = this.data.errorDeGuardado
        ? this.data.errorDeGuardado(err, form)
        : aplicarErrorDeGuardado(err, form, [], FALLBACK_GUARDADO);
      this.dynamicForm?.refrescarErrores();
      this.cdr.detectChanges();
      // El rechazo más común es un valor repetido: el foco va a ese campo, que ya muestra el motivo.
      // Cualquier tipo de control, no solo `input` (un `mat-select` también lleva `ng-invalid` y es enfocable).
      this.host.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid')?.focus();
      return;
    }
    this.dialogRef.close(guardado);
  }

  /** Camino de cierre de la X y de Cancelar: con cambios sin guardar pregunta antes de descartarlos. */
  intentarCerrar(): Promise<void> {
    return this.cerrarConConfirmacion();
  }

  /**
   * Lleva el foco a donde se puede actuar: el primer campo editable, o —en los estados de error—
   * el botón de salida. Sin esto el foco quedaría en el contenedor mientras cargaba.
   */
  private enfocarInicial(): void {
    if (this.destroyed) return;
    this.cdr.detectChanges();
    const cuerpo = this.host.querySelector<HTMLElement>('.dialogo-formulario__cuerpo');
    const destino = this.errorCarga
      ? cuerpo?.querySelector<HTMLElement>('.state-panel__cta')
      : cuerpo?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), mat-select:not([aria-disabled="true"])');
    destino?.focus();
  }
}
