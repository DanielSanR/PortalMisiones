import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, Subscription, forkJoin, map, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormActionsComponent } from '@shared/components/form-actions/form-actions.component';
import { FormErrorBannerComponent } from '@shared/components/form-error-banner/form-error-banner.component';
import { FormErrorMessageDirective } from '@shared/components/dynamic-form-field/FormErrorMessage.directive';
import { getControlErrorMessage, resumenDeErrores } from '@shared/components/dynamic-form-field/form-error-messages.util';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { TreeSelectComponent } from '@shared/components/tree-select/tree-select.component';
import { EstadoBadgeComponent } from '@shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { PuedeTenerCambiosSinGuardar } from '@shared/guards/unsaved-changes.guard';
import { avisarExito } from '@shared/utils/avisos';
import { formularioDePagina } from '@shared/utils/formulario-de-pagina';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import {
  DespublicacionFallidaError, FichaAdopcionResumen, FichaCambiadaError, FichaFormData, FichaLocalVM, FichasLocalesFacade,
} from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '@pages/tramites/adopciones/adopciones.rutas';
import { TEXTO_DESPUBLICACION_FALLIDA, mensajeErrorGuardado } from '../ficha-save-error';
import { textoExito } from '../ficha-textos';
import { RUTA_DETALLE_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
import { PuntosAtencionPanelComponent } from '../components/puntos-atencion-panel/puntos-atencion-panel.component';
import { leerAdopcion } from './ficha-form-adopciones';
import { CAMPOS, FichaForm, controlesDeFicha } from './ficha-form-campos';
import { FichaFormEstado } from './ficha-form-estado';
import { ERROR_FICHA_SIN_CONTENIDO, ErrorCarga, aErrorDeCarga, textoDeGuardada } from './ficha-form-vista';

/** Título del banner de error del guardado cuando nada se guardó. */
const TITULO_NO_SE_GUARDO = 'No se pudo guardar';

/** Dónde va el foco cuando aparece cada cosa (WCAG 2.4.3: no dejarlo en `body`). */
const SELECTOR_AVISO_CAMBIO = '[data-aviso="ficha-cambiada"], [data-aviso="ficha-actualizada"]';
const SELECTOR_ERROR_SERVIDOR = '[data-banner="error-servidor"] .form-error-banner';
const SELECTOR_TITULO = '.membrete__titulo';

/**
 * Alta y edición de una ficha por localidad. Formulario reactivo propio, con el layout de ficha del
 * design system (como Plantilla): membrete en vivo y una tarjeta de dos paneles (datos | puntos de atención,
 * o "qué sigue" en el alta) con el pie de guardar compartido. Los puntos se guardan aparte, con su propio flujo.
 *
 * Acá viven los comandos (cargar, guardar, foco y navegación); el resto está en las piezas de esta carpeta:
 * - `ficha-form-estado`: lo leído y lo que el template deriva de ahí (esta clase la extiende).
 * - `ficha-form-campos`: campos, validadores (reglas en `@features/fichas-locales`) y valor a guardar.
 * - `ficha-form-adopciones`: en el alta sin `?adopcion=`, elegir el trámite del organismo (solo los VIGENTES).
 * - `ficha-form-conflicto`: la ficha cambió en el servidor mientras se editaba → el form se rebasa, no pisa.
 * - `ficha-form-vista`: membrete, textos del pie y errores de carga.
 *
 * - Sin estado: guardar no cambia el estado de publicación (el backend lo conserva); eso es del workflow, en el detalle.
 *   Única excepción, siempre avisada (antes, con un aviso; después, en el snackbar): una ficha que figura PUBLICADA
 *   pero está desactivada se despublica al guardarla sin reactivar (lo completa el facade).
 * - Editar una ficha PUBLICADA cambia el portal al guardar (P-6): se avisa. Y no se desactiva desde acá: el
 *   interruptor "Ficha activa" queda bloqueado y remite a "Desactivar" del detalle (ese camino, DELETE, además la
 *   despublica; el PUT del form conserva el estado y la dejaría inactiva pero PUBLICADO).
 *
 * Nada se dibuja hasta que `getFormData()` resolvió, para no pisar una ficha con un form vacío. Por lo mismo, si el
 * servidor entrega la ficha sin su contenido (`sinContenido`: backend anterior a `586b670`, compatibilidad temporal),
 * el form no se dibuja: se explica por qué no se puede editar.
 */
@Component({
  selector: 'app-ficha-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MembreteComponent,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormActionsComponent,
    FormErrorBannerComponent,
    FormErrorMessageDirective,
    EstadoCargaComponent,
    TreeSelectComponent,
    EstadoBadgeComponent,
    HasPermissionDirective,
    UnavailableDirective,
    PuntosAtencionPanelComponent,
  ],
  templateUrl: './ficha-form.component.html',
  styleUrl: './ficha-form.component.scss',
})
export class FichaFormComponent extends FichaFormEstado implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** La fuente es simulada: lo que se guarde no llega al servidor (aviso persistente). */
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  /** Los validadores de duplicados leen `isEdit` y `datos` de la pantalla en cada validación. */
  readonly form: FichaForm = new FormGroup(controlesDeFicha(() => this));

  /**
   * Del marco común de formulario de página se usa lo que no toca el conflicto por versión: el estado
   * `guardando` / `errorDeGuardado` (con `empezarGuardado`, `terminarGuardado` y `fallo`), la salida tras guardar (`salir`) y la respuesta al
   * guard. NO `marco.guardar` ni `marco.cargar`: un guardado rechazado puede ser un rebase (sin error que mostrar)
   * o un guardado a medias (la base cambia), y la carga se cancela al reintentar y puede no dibujarse (`sinContenido`).
   */
  readonly marco = formularioDePagina<never>();

  cargando = true;
  errorCarga: ErrorCarga | null = null;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /** Título del banner de `marco.errorDeGuardado`: cambia cuando los cambios SÍ se guardaron y falló el paso siguiente. */
  serverErrorTitulo = TITULO_NO_SE_GUARDO;

  private readonly adopcionElegida$ = new Subject<string>();
  /** Carga en vuelo: reintentar la cancela, para que una respuesta vieja no pise a la nueva. */
  private carga: Subscription | null = null;
  /** La próxima carga la pidió el usuario desde un aviso que desaparece con ella: al terminar, el foco va al título. */
  private enfocarTituloAlCargar = false;

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    const motivo = this.motivoSinAdopcion;
    const resumen = resumenDeErrores(this.form, Object.values(CAMPOS), (control, campo) => getControlErrorMessage(control, campo));
    return motivo ? [`${CAMPOS.adopcion.label} (${motivo})`, ...resumen] : resumen;
  }

  ngOnInit(): void {
    this.iniciar(this.route.snapshot.params['id'] ?? null, this.route.snapshot.queryParamMap.get('adopcion') || null);

    if (this.eligeAdopcion) {
      // Hasta elegir el trámite no se sabe qué localidades están ocupadas: la localidad espera.
      this.form.controls.localidadId.disable({ emitEvent: false });
      this.form.controls.adopcion.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((id) => this.adopcionElegida$.next(id));
      this.adopcionElegida$.pipe(
        tap(() => {
          this.soltarTramite();
          this.cdr.markForCheck();
        }),
        switchMap((id) => leerAdopcion(id, (adopcionId) => this.facade.getFormData(null, adopcionId))),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((lectura) => {
        this.tramiteLeido(lectura);
        this.cdr.markForCheck();
      });
    } else {
      this.form.controls.adopcion.disable({ emitEvent: false });
    }

    this.form.controls.localidadId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.seguirLocalidad());

    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.olvidarCambioAjeno();
    this.marco.limpiarErrorDeGuardado();
    this.serverErrorTitulo = TITULO_NO_SE_GUARDO;
    this.submitted = false;
    this.cdr.markForCheck();

    this.carga?.unsubscribe();
    // Alta sin `?adopcion=`: además del formulario se leen los trámites del organismo que se pueden elegir.
    const carga$ = this.eligeAdopcion
      ? forkJoin({ datos: this.facade.getFormData(null, null), adopciones: this.facade.getAdopcionesParaFicha() })
      : this.facade.getFormData(this.editId, this.adopcionId).pipe(map((datos) => ({ datos, adopciones: [] as FichaAdopcionResumen[] })));
    this.carga = carga$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ datos, adopciones }) => this.alCargar(datos, adopciones),
      // El error de carga es `role="alert"`: se anuncia solo.
      error: (err: unknown) => this.noDibujar(aErrorDeCarga(err, this.isEdit, this.isEdit || this.eligeAdopcion)),
    });
  }

  private alCargar(datos: FichaFormData, adopciones: FichaAdopcionResumen[]): void {
    if (datos.ficha?.sinContenido) {
      this.noDibujar(ERROR_FICHA_SIN_CONTENIDO);
      return;
    }
    this.recibir(datos, adopciones);
    this.cargando = false;
    this.cdr.markForCheck();
    if (this.enfocarTituloAlCargar) {
      this.enfocarTituloAlCargar = false;
      this.enfocar(SELECTOR_TITULO);
    }
  }

  /** La pantalla no se puede dibujar: se muestra el motivo en lugar del form. */
  private noDibujar(error: ErrorCarga): void {
    this.cargando = false;
    this.enfocarTituloAlCargar = false;
    this.errorCarga = error;
    this.cdr.markForCheck();
  }

  /** Reintenta leer el trámite elegido (falló la lectura de sus localidades ocupadas). */
  reintentarAdopcion(): void {
    this.adopcionElegida$.next(this.form.controls.adopcion.value);
  }

  async onSubmit(): Promise<void> {
    if (this.marco.guardando || !this.datos) return;
    if (this.motivoSinAdopcion || this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.detectChanges();
      // El trámite es el primer campo y de él depende el resto: ahí va el foco.
      if (this.motivoSinAdopcion || this.form.controls.adopcion.invalid) {
        this.host.nativeElement.querySelector<HTMLElement>('#adopcion')?.focus();
      }
      return;
    }

    // `||` y no `??`: un `adopcionId` vacío tampoco sirve.
    const adopcionId = this.ficha?.adopcionId || this.adopcionId;
    if (!adopcionId) {
      // No debería pasar (el alta exige el trámite y una ficha sin contenido no llega a dibujar el form), pero
      // un envío que no hace nada y no dice nada es peor que cualquier mensaje.
      this.mostrarError('No se pudo determinar el trámite del organismo de esta ficha. Recargá la página e intentá de nuevo.');
      return;
    }

    this.submitted = false;
    this.marco.empezarGuardado();
    this.serverErrorTitulo = TITULO_NO_SE_GUARDO;
    // `conflicto` NO se apaga acá: su aviso (y el botón que tiene el foco) sigue hasta saber cómo terminó.
    this.fichaActualizada = null;
    const valor = this.valorAGuardar(adopcionId);

    // Guardado one-shot (`unaVez`), igual que en Plantilla: el único rechazo que se ignora es que la pantalla
    // ya no exista; cualquier otro apaga `guardando` y se muestra en el formulario.
    let guardada: FichaLocalVM;
    let despublicada = false;
    try {
      if (this.isEdit) {
        const resultado = await unaVez(this.facade.update(this.editId!, valor, this.base ?? undefined), this.destroyRef);
        guardada = resultado.ficha;
        despublicada = resultado.despublicada;
      } else {
        guardada = await unaVez(this.facade.create(valor), this.destroyRef);
      }
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.marco.terminarGuardado();
      this.alFallarElGuardado(err);
      return;
    }

    // El aviso de despublicación es más largo: queda más tiempo.
    avisarExito(this.snackBar, textoExito(textoDeGuardada(this.isEdit, guardada, despublicada), this.fuenteSimulada), {
      duracion: despublicada ? 8000 : 4000,
    });
    // Si la navegación no ocurre (un guard la frena, o falla al resolver), el form no queda bloqueado: el marco
    // deja la edición disponible y sin cambios, y la pantalla sigue sobre lo guardado (un alta pasa a edición).
    const navego = await this.marco.salir([RUTA_DETALLE_FICHA, guardada.id], { esAlta: !this.isEdit, form: this.form });
    if (!navego) this.seguirEnPantalla(guardada);
  }

  private alFallarElGuardado(err: unknown): void {
    if (err instanceof FichaCambiadaError) {
      // No se guardó nada: la ficha ya no es la que se leyó. El form se rebasa sobre la actual y se avisa.
      this.rebasarSobre(err.actual);
      this.enfocar(SELECTOR_AVISO_CAMBIO);
    } else if (err instanceof DespublicacionFallidaError) {
      // El PUT sí se guardó: la base pasa a ser lo guardado (si no, reintentar daría un falso "cambió").
      this.adoptar(err.ficha);
      this.mostrarError(TEXTO_DESPUBLICACION_FALLIDA, 'Se guardó, pero la ficha no se despublicó');
    } else {
      this.mostrarError(mensajeErrorGuardado(err, this.form));
    }
  }

  /** El banner está arriba de la tarjeta y el botón abajo: el foco (y el scroll) van al motivo. */
  private mostrarError(texto: string, titulo = TITULO_NO_SE_GUARDO): void {
    this.serverErrorTitulo = titulo;
    this.marco.fallo(texto);
    this.enfocar(SELECTOR_ERROR_SERVIDOR);
  }

  /** Se guardó, pero la navegación al detalle no ocurrió: la pantalla sigue, sobre lo guardado. */
  private seguirEnPantalla(guardada: FichaLocalVM): void {
    // En un alta el marco no vuelve a habilitar el guardado (crearía otra): acá sí, porque pasa a ser una edición.
    this.marco.terminarGuardado();
    this.conflicto = null;
    this.activaRestablecida = false;
    this.form.markAsPristine();
    if (!this.isEdit) {
      // Un alta que no navegó deja de ser alta: la ficha ya existe, así que la pantalla pasa a editarla.
      // Sin esto, otro clic en "Crear ficha" la crearía por segunda vez.
      this.pasarAEdicion(guardada.id);
      this.enfocarTituloAlCargar = true;
      this.cargar();
    } else {
      // Lo guardado es la nueva base del próximo guardado.
      this.adoptar(guardada);
      // El aviso de conflicto (si lo había, con el foco en su botón) ya no está.
      this.enfocar(SELECTOR_TITULO);
    }
    this.cdr.markForCheck();
  }

  /** Conflicto: descarta lo escrito y vuelve a leer la ficha. Al terminar, el foco va al título. */
  descartarMisCambios(): void {
    if (this.marco.guardando) return;
    this.enfocarTituloAlCargar = true;
    this.cargar();
  }

  /**
   * Conflicto: guarda lo escrito sobre la ficha actual (el form ya está rebasado, así que solo viajan como
   * cambio los campos editados acá). No toca la base: si el form no valida no se envía nada y todo queda igual;
   * y si la ficha vuelve a cambiar antes del PUT, el facade lo detecta de nuevo.
   */
  guardarMisCambios(): Promise<void> {
    return this.onSubmit();
  }

  /**
   * Dibuja lo pendiente y lleva el foco a `selector`, a la vista. Los avisos y errores salen arriba de la
   * tarjeta y el botón que los provoca está abajo (o desaparece): sin esto el foco queda en `body`.
   */
  private enfocar(selector: string): void {
    this.cdr.detectChanges();
    const destino = this.host.nativeElement.querySelector<HTMLElement>(selector);
    if (!destino) return;
    destino.focus({ preventScroll: true });
    destino.scrollIntoView({ block: 'center' });
  }

  cancelar(): void {
    if (this.isEdit && this.editId) this.router.navigate([RUTA_DETALLE_FICHA, this.editId]);
    else if (this.adopcionFija) this.router.navigate([RUTA_DETALLE_ADOPCION, this.adopcionFija]);
    else this.router.navigate([RUTA_LISTA_FICHAS]);
  }

  volver(): void {
    this.router.navigate([this.errorCarga?.volverA === 'adopciones' ? RUTA_LISTA_ADOPCIONES : RUTA_LISTA_FICHAS]);
  }

  /** Lo consulta `unsavedChangesGuard` (mientras guarda, y hasta que navega, no pregunta). */
  tieneCambiosSinGuardar(): boolean {
    return this.marco.tieneCambiosSinGuardar(this.form);
  }
}
