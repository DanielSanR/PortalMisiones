import { ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { NavigationExtras, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { OpcionesDeAviso, avisarAdvertencia, avisarExito } from './avisos';
import { TipoDeCargaPendiente } from './carga';

/** Por qué la página no pudo dibujar el formulario, ya traducido a lo que ve la persona (`<app-estado-carga>`). */
export interface ErrorDeCargaDePagina {
  titulo: string;
  texto: string;
  /** Segundo párrafo opcional (qué puede hacer la persona). */
  textoExtra?: string;
  /** La entidad no existe: reintentar no sirve, la única salida es el listado. */
  noExiste: boolean;
}

/** A dónde ir tras guardar: los comandos de `router.navigate` y, si hacen falta, sus extras. */
export type DestinoTrasGuardar = unknown[] | { comandos: unknown[]; extras?: NavigationExtras };

/** Lo que decide qué pasa si la navegación de salida tras guardar no ocurre (ver `FormularioDePagina.salir`). */
export type SalidaTrasGuardar = Pick<GuardadoDePagina<unknown>, 'esAlta' | 'form' | 'siNoNavega'>;

/** Lo que hace falta para un guardado. `R` es lo que devuelve el facade. */
export interface GuardadoDePagina<R> {
  /** La escritura (`facade.create(...)` / `facade.update(...)`). Se suscribe una sola vez (`unaVez`). */
  peticion$: Observable<R>;
  /** El `FormGroup` donde se marca el campo que rechazó el backend (`motor.form` con el dynamic form). */
  form: FormGroup | undefined;
  /** Conflictos por código de negocio y texto de respaldo (`<x>-save-error.ts`). */
  conflictos: ConflictoDeCampo[];
  fallback: string;
  /** El motor, para que sus campos (OnPush) muestren el error marcado desde afuera. */
  motor?: { refrescarErrores(): void } | null;
  /** Aviso de éxito ("Rol creado correctamente"), que puede depender de lo guardado. */
  aviso: (guardado: R) => string | { texto: string; opciones: OpcionesDeAviso };
  /**
   * Salir tras guardar: a dónde. Sin `destino` el guardado es "en el lugar": la página se queda, `guardando`
   * se apaga y `alQuedarse` recibe lo guardado (para mostrarlo sin volver a pedirlo).
   */
  destino?: (guardado: R) => DestinoTrasGuardar;
  alQuedarse?: (guardado: R) => void;
  /**
   * Es un alta. Si la navegación de salida no ocurre, un alta NO vuelve a quedar disponible (la entidad ya se
   * creó: habilitar "Crear" de nuevo la duplicaría): se avisa con `siNoNavega`. Una edición sí: queda sin cambios.
   */
  esAlta: boolean;
  /** "El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí." */
  siNoNavega?: string;
}

/**
 * Marco común de un formulario de PÁGINA (`form/` o `detail/` en modo nuevo / editar): el ciclo
 * `cargar → editar → guardar con unaVez → error por código (aplicarErrorDeGuardado) → salir tras guardar o
 * quedarse`, con el estado que leen `<app-estado-carga>` y `<app-dynamic-form>`. Es un helper, no una clase
 * base: la pantalla lo crea en un inicializador de campo (usa `inject()`) y le delega.
 *
 *   readonly marco = formularioDePagina<RolFormData>();
 *
 *   cargar(): void {
 *     void this.marco.cargar(this.facade.getFormData(this.id), (err) => errorDeCargaDeRol(err, this.esEdicion));
 *   }
 *   onSubmit(valor: Record<string, unknown>): void {
 *     void this.marco.guardar({ peticion$: …, form: this.motor?.form, motor: this.motor, conflictos: CONFLICTOS_ROL,
 *       fallback: FALLBACK_ROL, aviso: () => 'Rol actualizado', destino: () => [RUTA_LISTA_ROLES], esAlta: !this.id });
 *   }
 *   tieneCambiosSinGuardar(): boolean { return this.marco.tieneCambiosSinGuardar(this.motor?.form); }
 *
 *   @if (marco.pendiente; as tipo) {
 *     <app-estado-carga [tipo]="tipo" [noExiste]="!!marco.errorDeCarga?.noExiste" [titulo]="marco.errorDeCarga?.titulo ?? ''" …>
 *   } @else if (marco.datos) {
 *     <app-dynamic-form [saving]="marco.guardando" [serverError]="marco.errorDeGuardado" …>
 *   }
 *
 * La ruta lleva `canDeactivate: [unsavedChangesGuard]`. El resumen de validación con foco y el botón de un
 * solo nodo los ponen el motor y `<app-form-actions>`. Ejemplo real: `pages/roles/form/role-form.component.ts`.
 */
export class FormularioDePagina<D> {
  /** Lo que devolvió la carga (entidad + catálogos); `null` hasta que resuelve. */
  datos: D | null = null;
  cargando = true;
  errorDeCarga: ErrorDeCargaDePagina | null = null;
  private _guardando = false;
  private _errorDeGuardado = '';

  /**
   * Hay un guardado en curso. Sigue en `true` tras un guardado que navega, hasta que la pantalla se va: el guard
   * no pregunta. Solo de lectura: lo mueven `guardar` y, para una pantalla que guarda por su cuenta,
   * `empezarGuardado` / `terminarGuardado`.
   */
  get guardando(): boolean {
    return this._guardando;
  }

  /**
   * Motivo del último fallo de guardado, para el banner del formulario. Nunca el `message` del backend. Solo de
   * lectura: lo ponen `guardar` o `fallo`, y lo borran `empezarGuardado` y `limpiarErrorDeGuardado`.
   */
  get errorDeGuardado(): string {
    return this._errorDeGuardado;
  }

  constructor(
    private readonly destroyRef: DestroyRef,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
  ) {}

  /** Qué muestra `<app-estado-carga>`; `null` cuando ya se puede dibujar el formulario. */
  get pendiente(): TipoDeCargaPendiente | null {
    if (this.cargando) return 'cargando';
    return this.errorDeCarga ? 'error' : null;
  }

  /**
   * Carga los datos del formulario (también es el "Reintentar"). Devuelve lo cargado, o `undefined` si falló
   * (queda `errorDeCarga`) o la pantalla se destruyó antes. Sin datos el formulario no se dibuja: guardar
   * pisaría la entidad con una pantalla vacía.
   */
  async cargar(fuente$: Observable<D>, aError: (err: unknown) => ErrorDeCargaDePagina): Promise<D | undefined> {
    this.cargando = true;
    this.errorDeCarga = null;
    this.cdr.markForCheck();
    try {
      this.datos = await unaVez(fuente$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return undefined;
      this.datos = null;
      this.errorDeCarga = aError(err);
    }
    this.cargando = false;
    this.cdr.markForCheck();
    return this.datos ?? undefined;
  }

  /**
   * Guarda una sola vez (dos envíos seguidos no crean dos entidades). Si el backend rechaza, marca el campo
   * del conflicto y deja el texto en `errorDeGuardado`; si sale bien avisa y sale (`destino`) o se queda.
   * Devuelve lo guardado, o `undefined` si no se guardó.
   */
  async guardar<R>(guardado: GuardadoDePagina<R>): Promise<R | undefined> {
    if (this._guardando) return undefined;
    this.empezarGuardado();

    let resultado: R;
    try {
      resultado = await unaVez(guardado.peticion$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return undefined; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this._guardando = false;
      this._errorDeGuardado = aplicarErrorDeGuardado(err, guardado.form, guardado.conflictos, guardado.fallback);
      guardado.motor?.refrescarErrores();
      this.cdr.markForCheck();
      return undefined;
    }

    const aviso = guardado.aviso(resultado);
    if (typeof aviso === 'string') avisarExito(this.snackBar, aviso);
    else avisarExito(this.snackBar, aviso.texto, aviso.opciones);

    if (guardado.destino) {
      await this.salir(guardado.destino(resultado), guardado);
    } else {
      guardado.alQuedarse?.(resultado);
      this.terminarGuardado();
    }
    return resultado;
  }

  /**
   * Empieza un guardado que la pantalla hace por su cuenta (la ficha por localidad: su rechazo puede ser un rebase
   * sin error que mostrar). Bloquea el formulario y borra el error del intento anterior. Con `guardar` no hace falta.
   */
  empezarGuardado(): void {
    this._guardando = true;
    this._errorDeGuardado = '';
    this.cdr.markForCheck();
  }

  /** Libera el formulario tras un guardado propio que no navegó (falló, o se queda en la pantalla). */
  terminarGuardado(): void {
    this._guardando = false;
    this.cdr.markForCheck();
  }

  /** El guardado propio falló: `texto` (ya traducido, nunca el `message` del backend) va al banner. */
  fallo(texto: string): void {
    this._errorDeGuardado = texto;
    this.cdr.markForCheck();
  }

  /** Se corrigió lo que el backend había rechazado: el banner del intento anterior deja de ser cierto. */
  limpiarErrorDeGuardado(): void {
    if (!this._errorDeGuardado) return;
    this._errorDeGuardado = '';
    this.cdr.markForCheck();
  }

  /**
   * Lo que responde la pantalla a `unsavedChangesGuard`. Durante un guardado `guardando` sigue en `true`
   * hasta que la navegación de éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(form: AbstractControl | null | undefined): boolean {
    return !this.guardando && !!form?.dirty;
  }

  /**
   * Navega tras guardar (lo usa `guardar` con `destino`). Si la navegación no ocurre (otro guard la frena, o
   * falla), una edición vuelve a quedar disponible y sin cambios; un alta NO, y se le dice a la persona dónde
   * encontrar lo que creó (`siNoNavega`). Devuelve `false` solo en ese caso.
   *
   * Es público para la pantalla cuyo guardado no entra en `guardar` (ficha por localidad: conflicto por versión)
   * y lo lleva con `empezarGuardado` / `terminarGuardado` / `fallo`: sale con esto y, si devuelve `false`, decide
   * cómo sigue sobre lo guardado.
   */
  async salir(destino: DestinoTrasGuardar, salida: SalidaTrasGuardar): Promise<boolean> {
    const { comandos, extras } = Array.isArray(destino) ? { comandos: destino, extras: undefined } : destino;
    let navego: boolean | undefined;
    try {
      // Sin extras no se pasa el segundo argumento: es la misma llamada que hacía cada pantalla a mano.
      navego = await (extras ? this.router.navigate(comandos, extras) : this.router.navigate(comandos));
    } catch {
      navego = false;
    }
    if (navego !== false) return true;
    if (!salida.esAlta) {
      this._guardando = false;
      salida.form?.markAsPristine();
    } else if (salida.siNoNavega) {
      avisarAdvertencia(this.snackBar, salida.siNoNavega);
    }
    this.cdr.markForCheck();
    return false;
  }
}

/** Crea el marco de un formulario de página. Llamar en un inicializador de campo del componente (usa `inject()`). */
export function formularioDePagina<D>(): FormularioDePagina<D> {
  return new FormularioDePagina<D>(inject(DestroyRef), inject(ChangeDetectorRef), inject(Router), inject(MatSnackBar));
}
