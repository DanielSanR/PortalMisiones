import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, EMPTY, Observable, Subject, defer, of, tap, throwError } from 'rxjs';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthUser } from '@core/models/auth.model';
import { AuthTokenService } from '@core/services/auth-token.service';

/**
 * Arnés de specs para las pantallas de lista (`pages/<sección>/list`): fija el comportamiento que VE la
 * persona (DOM, foco, avisos y llamadas al facade), no cómo está armado el componente. Lo usan los specs
 * de caracterización de cada lista; por eso no lee ninguna propiedad del componente.
 *
 *   describeLista({ titulo: 'ModalidadesListComponent', componente: ModalidadesListComponent, … });
 *
 * y, para casos propios de una lista, `montarLista(...)` + los métodos de `ListaPO`.
 */

/** Datos y respuestas del facade de la prueba: el spec arma su stub con esto. */
export class FuenteDePrueba<T extends { id: string }> {
  /** Lo que expone el facade como `xxx$`. Empieza vacío, como el real antes de cargar. */
  readonly filas$ = new BehaviorSubject<T[]>([]);
  /** Lo que devuelve el backend al cargar. */
  datos: T[];
  /** `ok`: responde con `datos`; `error`: falla; `pendiente`: no responde hasta `responder()`. */
  modo: 'ok' | 'error' | 'pendiente' = 'ok';
  /** Cuántas veces se pidió la lista. */
  cargas = 0;
  /** Ids por los que se pidió la baja, en orden. */
  readonly bajas: string[] = [];
  private pendiente$ = new Subject<T[]>();
  private baja$ = new Subject<void>();

  constructor(datos: T[]) {
    this.datos = datos;
  }

  /** `loadX()` del facade: como el real, publica la lista en `filas$` antes de avisar al que la pidió. */
  readonly cargar = (): Observable<T[]> => defer(() => {
    this.cargas++;
    if (this.modo === 'error') return throwError(() => new Error('sin conexión'));
    const origen$ = this.modo === 'pendiente' ? this.pendiente$ : of(this.datos);
    return origen$.pipe(tap((filas) => this.filas$.next(filas)));
  });

  /** La carga `pendiente` responde. */
  responder(): void {
    const pendiente$ = this.pendiente$;
    this.pendiente$ = new Subject<T[]>();
    pendiente$.next(this.datos);
    pendiente$.complete();
  }

  /** `delete(id)` (o desactivar, deshabilitar…): queda en vuelo hasta `terminarBaja()` o `fallarBaja()`. */
  readonly eliminar = (id: string): Observable<void> => defer(() => {
    this.bajas.push(id);
    this.baja$ = new Subject<void>();
    return this.baja$;
  });

  /** El backend confirmó la baja: la fila sale de la lista (salvo `conserva`) y la llamada termina. */
  terminarBaja(conserva = false): void {
    const id = this.bajas[this.bajas.length - 1];
    if (!conserva) this.filas$.next(this.filas$.value.filter((fila) => fila.id !== id));
    this.baja$.next();
    this.baja$.complete();
  }

  fallarBaja(error: unknown = new Error('falló')): void {
    this.baja$.error(error);
  }
}

export interface MontajeDeLista<C> {
  componente: Type<C>;
  providers: Provider[];
  /** Permisos atómicos de la sesión. */
  permisos?: string[];
  /** Rol canónico de la sesión (SUPERADMIN por defecto: no recorta nada por rol). */
  rol?: UserRole;
}

/** Un aviso (snackbar) pedido por la pantalla. */
export interface AvisoVisto {
  mensaje: string;
  accion: string | undefined;
  duracion: number | undefined;
  clase: unknown;
}

function usuario(permisos: string[], rol: UserRole): AuthUser {
  return {
    id: 'u-prueba', email: 'prueba@misiones.gob.ar', nombre: 'Prueba', apellido: 'Lista',
    role: rol, roles: [rol], roleCodes: [rol], permissions: permisos,
  } as AuthUser;
}

/** Monta la lista en el documento (el foco solo existe en nodos conectados) con una sesión con esos permisos. */
export function montarLista<C>(montaje: MontajeDeLista<C>): ListaPO<C> {
  TestBed.configureTestingModule({
    imports: [montaje.componente],
    providers: [provideRouter([]), provideNoopAnimations(), ...montaje.providers],
  });
  TestBed.inject(AuthTokenService).setUserData(usuario(montaje.permisos ?? [], montaje.rol ?? UserRole.SUPERADMIN));
  const avisos: AvisoVisto[] = [];
  // Por el prototipo: una pantalla que importa `MatSnackBarModule` recibe su propia instancia del servicio.
  spyOn(MatSnackBar.prototype, 'open').and.callFake((mensaje: string, accion?: string, config?) => {
    avisos.push({ mensaje, accion, duracion: config?.duration, clase: config?.panelClass });
    return { onAction: () => EMPTY, dismiss: () => undefined } as unknown as MatSnackBarRef<TextOnlySnackBar>;
  });
  const fixture = TestBed.createComponent(montaje.componente);
  document.body.append(fixture.nativeElement);
  return new ListaPO(fixture, avisos);
}

/** Lo que hay que deshacer después de cada caso: la pantalla, los diálogos y la sesión guardada. */
export function desmontarLista(po: ListaPO<unknown> | undefined): void {
  TestBed.inject(MatDialog).closeAll();
  po?.fixture.destroy();
  po?.fixture.nativeElement.remove();
  TestBed.inject(AuthTokenService).clearTokens();
}

const txt = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** La lista tal como la ve y la usa una persona. Los métodos que esperan (`buscar`, `asentar`) van dentro de `fakeAsync`. */
export class ListaPO<C> {
  constructor(readonly fixture: ComponentFixture<C>, readonly avisos: AvisoVisto[]) {}

  get host(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  /** Re-render tras un cambio. */
  render(): void {
    this.fixture.detectChanges();
  }

  /** Deja pasar timers y microtareas (debounce del buscador, cierre de diálogos, foco diferido) y re-renderiza. */
  asentar(ms = 0): void {
    this.fixture.detectChanges();
    tick(ms);
    this.fixture.detectChanges();
    tick();
    this.fixture.detectChanges();
  }

  // ── Tabla ──
  filas(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('tr.mat-mdc-row'));
  }

  /** Texto que identifica a cada fila visible (`selector` dentro de la fila; por defecto su primera celda). */
  nombres(selector?: string): string[] {
    return this.filas().map((fila) => txt(selector ? fila.querySelector(selector) : fila.querySelector('td')));
  }

  cargando(): boolean {
    return this.host.querySelectorAll('.shared-table__skeleton-row').length > 0;
  }

  contador(): string {
    return txt(this.host.querySelector('.list-toolbar__count'));
  }

  /** Estado vacío de la tabla, o `null` si no está a la vista. */
  vacio(): { titulo: string; texto: string; cta: HTMLButtonElement | null } | null {
    const panel = this.host.querySelector('.shared-table .state-panel[role="status"]');
    if (!panel) return null;
    return {
      titulo: txt(panel.querySelector('.state-panel__title')),
      texto: txt(panel.querySelector('.state-panel__text')),
      cta: panel.querySelector<HTMLButtonElement>('.state-panel__cta'),
    };
  }

  /** Estado de error de la tabla, o `null`. */
  error(): { titulo: string; texto: string; reintentar: HTMLButtonElement } | null {
    const panel = this.host.querySelector('.shared-table .state-panel[role="alert"]');
    if (!panel) return null;
    return {
      titulo: txt(panel.querySelector('.state-panel__title')),
      texto: txt(panel.querySelector('.state-panel__text')),
      reintentar: panel.querySelector<HTMLButtonElement>('.state-panel__cta')!,
    };
  }

  ordenarPor(columna: string): void {
    const th = Array.from(this.host.querySelectorAll<HTMLElement>('th.mat-mdc-header-cell'))
      .find((celda) => txt(celda) === columna);
    if (!th) throw new Error(`No hay una columna "${columna}"`);
    (th.querySelector<HTMLElement>('.mat-sort-header-container') ?? th).click();
    this.asentar();
  }

  // ── Paginador ──
  rango(): string {
    return txt(this.host.querySelector('.shared-table__paginador-rango'));
  }

  paginaActiva(): string {
    return txt(this.host.querySelector('.shared-table__pagina.is-active'));
  }

  irAPagina(etiqueta: string): void {
    const boton = this.host.querySelector<HTMLButtonElement>(`.shared-table__pagina[aria-label="${etiqueta}"]`);
    if (!boton) throw new Error(`No hay un botón de paginado "${etiqueta}"`);
    boton.click();
    this.asentar();
  }

  // ── Buscador, tabs y chips ──
  buscador(): HTMLInputElement {
    return this.host.querySelector<HTMLInputElement>('.list-search__input')!;
  }

  buscar(termino: string): void {
    const input = this.buscador();
    input.value = termino;
    input.dispatchEvent(new Event('input'));
    this.asentar(250);
  }

  tabs(): { etiqueta: string; activa: boolean; boton: HTMLButtonElement }[] {
    return Array.from(this.host.querySelectorAll<HTMLButtonElement>('.filter-tabs__tab')).map((boton) => ({
      etiqueta: txt(boton),
      activa: boton.getAttribute('aria-checked') === 'true',
      boton,
    }));
  }

  /** Elige la tab cuyo rótulo empieza con `etiqueta` (el contador va pegado al rótulo). */
  elegirTab(etiqueta: string): void {
    const tab = this.tabs().find((t) => t.etiqueta.startsWith(etiqueta));
    if (!tab) throw new Error(`No hay una tab "${etiqueta}"`);
    tab.boton.click();
    this.asentar();
  }

  chips(): string[] {
    return Array.from(this.host.querySelectorAll('.active-filters__chip')).map(txt);
  }

  quitarChip(indice: number): void {
    this.host.querySelectorAll<HTMLButtonElement>('.active-filters__quitar')[indice].click();
    this.asentar(250);
  }

  limpiarTodo(): void {
    this.host.querySelector<HTMLButtonElement>('.active-filters__limpiar')!.click();
    this.asentar(250);
  }

  // ── Acciones de fila ──
  accionPrincipal(fila: number): HTMLButtonElement | null {
    return this.filas()[fila].querySelector<HTMLButtonElement>('.row-action:not(.row-action--icon)');
  }

  disparadorDelMenu(fila: number): HTMLButtonElement | null {
    return this.filas()[fila].querySelector<HTMLButtonElement>('.row-action--icon');
  }

  /** Abre el menú "⋮" de la fila (con el foco en su disparador, como al usarlo) y devuelve sus opciones. */
  abrirMenu(fila: number): HTMLButtonElement[] {
    const disparador = this.disparadorDelMenu(fila);
    if (!disparador) return [];
    disparador.focus();
    disparador.click();
    this.asentar();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel .mat-mdc-menu-item'));
  }

  /** Rótulos del menú de la fila; lo deja cerrado. */
  opcionesDelMenu(fila: number): string[] {
    const rotulos = this.abrirMenu(fila).map(txt);
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    this.asentar();
    flush();
    return rotulos;
  }

  elegirDelMenu(fila: number, opcion: string): void {
    const item = this.abrirMenu(fila).find((boton) => txt(boton) === opcion);
    if (!item) throw new Error(`La fila ${fila} no ofrece "${opcion}"`);
    item.click();
    this.asentar();
  }

  filaOcupada(fila: number): boolean {
    return this.accionPrincipal(fila)?.getAttribute('aria-busy') === 'true'
      || !!this.disparadorDelMenu(fila)?.disabled;
  }

  // ── Confirmación (diálogo real, en el overlay) ──
  confirmacion(): { titulo: string; texto: string; error: string; confirmar: HTMLButtonElement; cancelar: HTMLButtonElement } | null {
    const dialogo = document.querySelector('app-confirm-dialog');
    if (!dialogo) return null;
    const botones = dialogo.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button');
    return {
      titulo: txt(dialogo.querySelector('.form-dialog__titulo')),
      texto: txt(dialogo.querySelector('.form-dialog__texto')),
      error: txt(dialogo.querySelector('.form-dialog__error')),
      cancelar: botones[0],
      confirmar: botones[1],
    };
  }

  /** Pulsa un botón de la confirmación y deja que el diálogo termine lo que tenga que hacer. */
  pulsar(boton: HTMLButtonElement): void {
    boton.click();
    this.asentar();
  }

  mensajesDeAviso(): string[] {
    return this.avisos.map((aviso) => aviso.mensaje);
  }
}

/**
 * Reemplaza `MatDialog.open` por un diálogo de mentira para probar alta y edición sin montar el formulario:
 * devuelve lo que se abrió (`data`) y deja cerrarlo con o sin resultado.
 */
export function espiarDialogos(): { abiertos: { data: unknown }[]; cerrar: (resultado?: unknown) => void } {
  const abiertos: { data: unknown }[] = [];
  let cierre$ = new Subject<unknown>();
  spyOn(TestBed.inject(MatDialog), 'open').and.callFake(((_componente: unknown, config?: { data?: unknown }) => {
    abiertos.push({ data: config?.data });
    cierre$ = new Subject<unknown>();
    const actual$ = cierre$;
    return { afterClosed: () => actual$, close: () => actual$.complete() } as unknown as MatDialogRef<unknown>;
  }) as never);
  return {
    abiertos,
    cerrar: (resultado?: unknown) => {
      cierre$.next(resultado);
      cierre$.complete();
    },
  };
}

// ───────────────────────────── Suite estándar ─────────────────────────────

export interface CasoDeLista<T extends { id: string }> {
  titulo: string;
  componente: Type<unknown>;
  /** Providers del facade de la lista, armados sobre la fuente de la prueba. */
  facade: (fuente: FuenteDePrueba<T>) => Provider[];
  /** Al menos 12 filas (más de una página), en el orden en que las devuelve el backend. */
  filas: T[];
  /** Texto que identifica a la fila en la tabla. */
  nombre: (fila: T) => string;
  /** Dónde está ese texto dentro de la fila (por defecto `.cell-name__principal`). */
  selectorNombre?: string;
  /** Sesión que puede todo en la pantalla. */
  permisos: string[];
  rol?: UserRole;
  /** Texto del contador del toolbar para `n` filas. */
  contador: (n: number) => string;
  errorTitulo: string;
  /** Vacío sin filtros. `cta: null` = no se ofrece ninguna acción. */
  vacio: { titulo: string; cta: string | null };
  /** Sesión que ve la lista pero no puede crear: el vacío no ofrece la acción. Omitir si no aplica. */
  sinCrear?: { permisos: string[]; rol?: UserRole };
  /** Vacío por filtros. */
  sinResultados: { texto: string; cta: string };
  /** Búsqueda que deja entre 1 y 10 filas. */
  busqueda: { termino: string; esperadas: (fila: T) => boolean };
  /** Columna de texto que se ordena por `nombre` (rótulo del encabezado). */
  ordenPorNombre?: string;
  /** La lista no pagina (muestra todas las filas). Las demás paginan de a 10. */
  sinPaginado?: boolean;
  /** Acción principal de la fila (rótulo) y opciones del menú con todos los permisos. */
  acciones: { principal: string | null; menu: string[] };
  /** Sesión que solo puede leer: qué queda de las acciones de la fila. */
  soloLectura?: { permisos: string[]; rol?: UserRole; principal: string | null; menu: string[] };
  /** Baja con confirmación desde el menú de la fila. */
  baja?: {
    opcion: string;
    titulo: string;
    confirmar: string;
    aviso: string;
    /** El foco pasa a la fila que ocupa el lugar. `false`: la pantalla no mueve el foco. */
    foco: boolean;
    /** La fila sigue en la lista después de la baja (p. ej. un rol desactivado). */
    conservaFila?: boolean;
  };
}

/** Casos que toda lista en cliente cumple. Cada spec agrega después los propios. */
export function describeLista<T extends { id: string }>(caso: CasoDeLista<T>): void {
  describe(`${caso.titulo} · lista`, () => {
    let fuente: FuenteDePrueba<T>;
    let po: ListaPO<unknown>;
    const selector = caso.selectorNombre ?? '.cell-name__principal';
    const nombres = (filas: T[]): string[] => filas.map(caso.nombre);
    const tamano = caso.sinPaginado ? caso.filas.length : 10;
    const rotulo = (boton: HTMLButtonElement | null): string | null => (boton ? txt(boton) : null);

    function montar(opciones: { permisos?: string[]; rol?: UserRole; datos?: T[]; modo?: FuenteDePrueba<T>['modo'] } = {}): void {
      fuente = new FuenteDePrueba<T>(opciones.datos ?? caso.filas);
      fuente.modo = opciones.modo ?? 'ok';
      po = montarLista({
        componente: caso.componente,
        providers: caso.facade(fuente),
        permisos: opciones.permisos ?? caso.permisos,
        rol: opciones.rol ?? caso.rol,
      });
      po.asentar();
    }

    afterEach(() => desmontarLista(po));

    it('mientras carga muestra el esqueleto; al llegar los datos, las filas y el contador', fakeAsync(() => {
      montar({ modo: 'pendiente' });
      expect(po.cargando()).toBeTrue();
      expect(po.filas().length).toBe(0);
      expect(po.vacio()).toBeNull();
      expect(po.error()).toBeNull();

      fuente.responder();
      po.asentar();

      expect(po.cargando()).toBeFalse();
      expect(po.nombres(selector)).toEqual(nombres(caso.filas.slice(0, tamano)));
      expect(po.contador()).toBe(caso.contador(caso.filas.length));
      expect(fuente.cargas).toBe(1);
      flush();
    }));

    it('si la carga falla lo dice con "Reintentar", y reintentar vuelve a pedir la lista', fakeAsync(() => {
      montar({ modo: 'error' });
      const error = po.error()!;
      expect(error.titulo).toBe(caso.errorTitulo);
      expect(error.texto).toBe('Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.');
      expect(po.vacio()).toBeNull();

      fuente.modo = 'ok';
      error.reintentar.click();
      po.asentar();

      expect(fuente.cargas).toBe(2);
      expect(po.error()).toBeNull();
      expect(po.filas().length).toBe(tamano);
      flush();
    }));

    it('sin datos invita a crear (si la sesión puede)', fakeAsync(() => {
      montar({ datos: [] });
      const vacio = po.vacio()!;
      expect(vacio.titulo).toBe(caso.vacio.titulo);
      expect(rotulo(vacio.cta)).toBe(caso.vacio.cta);
      expect(po.contador()).toBe(caso.contador(0));
      flush();
    }));

    if (caso.sinCrear) {
      const sinCrear = caso.sinCrear;
      it('sin datos y sin poder crear no ofrece la acción', fakeAsync(() => {
        montar({ datos: [], permisos: sinCrear.permisos, rol: sinCrear.rol ?? caso.rol });
        const vacio = po.vacio()!;
        expect(vacio.titulo).toBe(caso.vacio.titulo);
        expect(vacio.cta).toBeNull();
        flush();
      }));
    }

    it('una búsqueda sin coincidencias dice "Sin resultados" y su acción limpia la búsqueda', fakeAsync(() => {
      montar();
      po.buscar('zzzz-nada');
      const vacio = po.vacio()!;
      expect(vacio.titulo).toBe('Sin resultados');
      expect(vacio.texto).toBe(caso.sinResultados.texto);
      expect(rotulo(vacio.cta)).toBe(caso.sinResultados.cta);
      expect(po.chips()).toEqual(['Búsqueda: zzzz-nada']);
      expect(po.contador()).toBe(caso.contador(0));

      vacio.cta!.click();
      po.asentar(250);

      expect(po.buscador().value).toBe('');
      expect(po.chips()).toEqual([]);
      expect(po.filas().length).toBe(tamano);
      flush();
    }));

    it('buscar filtra las filas, ajusta el contador y deja un chip que se puede quitar', fakeAsync(() => {
      montar();
      const esperadas = caso.filas.filter(caso.busqueda.esperadas);
      po.buscar(caso.busqueda.termino);
      expect(po.nombres(selector)).toEqual(nombres(esperadas));
      expect(po.contador()).toBe(caso.contador(esperadas.length));
      expect(po.chips()).toEqual([`Búsqueda: ${caso.busqueda.termino}`]);

      po.quitarChip(0);
      expect(po.buscador().value).toBe('');
      expect(po.contador()).toBe(caso.contador(caso.filas.length));

      po.buscar(caso.busqueda.termino);
      po.limpiarTodo();
      expect(po.buscador().value).toBe('');
      expect(po.chips()).toEqual([]);
      flush();
    }));

    if (caso.ordenPorNombre) {
      const columna = caso.ordenPorNombre;
      it('ordena por la columna al tocar su encabezado: ascendente, descendente y de vuelta al orden original', fakeAsync(() => {
        montar();
        const orden = [...caso.filas].sort((a, b) =>
          caso.nombre(a).localeCompare(caso.nombre(b), 'es-AR', { sensitivity: 'base' }));

        po.ordenarPor(columna);
        expect(po.nombres(selector)).toEqual(nombres(orden.slice(0, tamano)));

        po.ordenarPor(columna);
        expect(po.nombres(selector)).toEqual(nombres([...orden].reverse().slice(0, tamano)));

        po.ordenarPor(columna);
        expect(po.nombres(selector)).toEqual(nombres(caso.filas.slice(0, tamano)));
        flush();
      }));
    }

    if (caso.sinPaginado) {
      it('no pagina: muestra todas las filas', fakeAsync(() => {
        montar();
        expect(po.filas().length).toBe(caso.filas.length);
        expect(po.host.querySelector('.shared-table__paginador')).toBeNull();
        flush();
      }));
    } else {
      it('pagina de a 10 y deja ir a la página siguiente', fakeAsync(() => {
        montar();
        expect(po.rango()).toBe(`1–10 de ${caso.filas.length}`);
        po.irAPagina('Página siguiente');
        expect(po.rango()).toBe(`11–${caso.filas.length} de ${caso.filas.length}`);
        expect(po.nombres(selector)).toEqual(nombres(caso.filas.slice(10)));
        flush();
      }));

      it('buscar vuelve a la primera página, y al quitar la búsqueda sigue en la primera', fakeAsync(() => {
        montar();
        po.irAPagina('Página siguiente');
        expect(po.paginaActiva()).toBe('2');

        po.buscar(caso.busqueda.termino);
        expect(po.paginaActiva()).toBe('1');
        expect(po.nombres(selector)).toEqual(nombres(caso.filas.filter(caso.busqueda.esperadas)));

        po.irAPagina('Página siguiente');
        po.quitarChip(0);
        expect(po.paginaActiva()).toBe('1');
        expect(po.nombres(selector)).toEqual(nombres(caso.filas.slice(0, 10)));
        flush();
      }));

      if (caso.ordenPorNombre) {
        const columna = caso.ordenPorNombre;
        it('ordenar vuelve a la primera página', fakeAsync(() => {
          montar();
          po.irAPagina('Página siguiente');
          expect(po.paginaActiva()).toBe('2');

          po.ordenarPor(columna);
          expect(po.paginaActiva()).toBe('1');
          flush();
        }));
      }

      it('una recarga de los datos conserva la página, y si esa página dejó de existir muestra la última', fakeAsync(() => {
        montar();
        po.irAPagina('Página siguiente');

        fuente.filas$.next(caso.filas.slice(1));
        po.asentar();
        expect(po.paginaActiva()).toBe('2');
        expect(po.nombres(selector)).toEqual(nombres(caso.filas.slice(11)));

        fuente.filas$.next(caso.filas.slice(0, 10));
        po.asentar();
        expect(po.paginaActiva()).toBe('1');
        expect(po.filas().length).toBe(10);
        flush();
      }));
    }

    it('las acciones de la fila son las que la sesión puede ejecutar', fakeAsync(() => {
      montar();
      expect(rotulo(po.accionPrincipal(0))).toBe(caso.acciones.principal);
      expect(po.opcionesDelMenu(0)).toEqual(caso.acciones.menu);
      flush();
    }));

    if (caso.soloLectura) {
      const lectura = caso.soloLectura;
      it('con una sesión de solo lectura la fila no ofrece las acciones de escritura', fakeAsync(() => {
        montar({ permisos: lectura.permisos, rol: lectura.rol ?? caso.rol });
        expect(rotulo(po.accionPrincipal(0))).toBe(lectura.principal);
        expect(po.disparadorDelMenu(0) ? po.opcionesDelMenu(0) : []).toEqual(lectura.menu);
        flush();
      }));
    }

    if (caso.baja) {
      const baja = caso.baja;

      it(`"${baja.opcion}" pide confirmación; al confirmar llama al facade, bloquea la fila y avisa${baja.foco ? ', con el foco en la fila que ocupa su lugar' : ''}`, fakeAsync(() => {
        montar();
        po.elegirDelMenu(1, baja.opcion);
        const confirmacion = po.confirmacion()!;
        expect(confirmacion.titulo).toBe(baja.titulo);
        expect(rotulo(confirmacion.confirmar)).toBe(baja.confirmar);
        expect(fuente.bajas).toEqual([]);

        po.pulsar(confirmacion.confirmar);
        expect(fuente.bajas).toEqual([caso.filas[1].id]);
        expect(po.filaOcupada(1)).toBeTrue();
        expect(po.confirmacion()).not.toBeNull();
        expect(po.mensajesDeAviso()).toEqual([]);

        fuente.terminarBaja(!!baja.conservaFila);
        po.asentar();
        flush();
        po.render();

        expect(po.confirmacion()).toBeNull();
        expect(po.avisos).toEqual([{ mensaje: baja.aviso, accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
        if (!baja.conservaFila) expect(po.nombres(selector)[1]).toBe(caso.nombre(caso.filas[2]));
        expect(po.filaOcupada(1)).toBeFalse();
        if (baja.foco) {
          expect(po.filas()[1].contains(document.activeElement)).withContext('foco en la fila que ocupa el lugar').toBeTrue();
        }
        flush();
      }));

      it(`cancelar "${baja.opcion}" no llama al facade ni avisa`, fakeAsync(() => {
        montar();
        po.elegirDelMenu(1, baja.opcion);
        po.pulsar(po.confirmacion()!.cancelar);
        flush();
        po.render();

        expect(po.confirmacion()).toBeNull();
        expect(fuente.bajas).toEqual([]);
        expect(po.mensajesDeAviso()).toEqual([]);
        expect(po.filas().length).toBe(tamano);
        flush();
      }));

      it(`si "${baja.opcion}" falla, el error queda en la confirmación, la fila se libera y no se avisa`, fakeAsync(() => {
        montar();
        po.elegirDelMenu(1, baja.opcion);
        po.pulsar(po.confirmacion()!.confirmar);
        fuente.fallarBaja();
        po.asentar();

        const confirmacion = po.confirmacion()!;
        expect(confirmacion.error).not.toBe('');
        expect(po.filaOcupada(1)).toBeFalse();
        expect(po.mensajesDeAviso()).toEqual([]);

        po.pulsar(confirmacion.cancelar);
        flush();
        expect(po.mensajesDeAviso()).toEqual([]);
        expect(po.filas().length).toBe(tamano);
        flush();
      }));
    }
  });
}

export interface CasoDeDialogo<T extends { id: string }, C> {
  titulo: string;
  componente: Type<C>;
  facade: (fuente: FuenteDePrueba<T>) => Provider[];
  filas: T[];
  permisos: string[];
  rol?: UserRole;
  /** El botón "Nuevo…" vive en el header del shell (`appPageActions`): se dispara su handler. */
  crear: (componente: C) => void;
  nuevo: { titulo: string; aviso: string };
  editar: { titulo: string; aviso: string };
}

/** Alta y edición en diálogo sobre la lista (`DialogoEnLista` + `abrirFormDialog`), con el diálogo de mentira. */
export function describeDialogoDeLista<T extends { id: string }, C>(caso: CasoDeDialogo<T, C>): void {
  describe(`${caso.titulo} · alta y edición en diálogo`, () => {
    let po: ListaPO<C>;
    const tituloDe = (abierto: { data: unknown }): string => (abierto.data as { titulo: string }).titulo;

    beforeAll(async () => {
      // El diálogo se carga en diferido: con el módulo ya bajado, abrirlo solo necesita microtareas.
      await import('@shared/components/form-dialog/form-dialog.component');
    });

    function montar(): ReturnType<typeof espiarDialogos> {
      const fuente = new FuenteDePrueba<T>(caso.filas);
      po = montarLista({ componente: caso.componente, providers: caso.facade(fuente), permisos: caso.permisos, rol: caso.rol });
      const dialogos = espiarDialogos();
      po.asentar();
      return dialogos;
    }

    afterEach(() => desmontarLista(po));

    it(`el alta abre "${caso.nuevo.titulo}" y, al guardar, avisa "${caso.nuevo.aviso}"`, fakeAsync(() => {
      const dialogos = montar();
      caso.crear(po.fixture.componentInstance);
      po.asentar();

      expect(dialogos.abiertos.map(tituloDe)).toEqual([caso.nuevo.titulo]);

      dialogos.cerrar({ id: 'nueva' });
      po.asentar();
      expect(po.avisos).toEqual([{ mensaje: caso.nuevo.aviso, accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
      flush();
    }));

    it(`"Editar" abre "${caso.editar.titulo}" y, al guardar, avisa "${caso.editar.aviso}"`, fakeAsync(() => {
      const dialogos = montar();
      po.accionPrincipal(0)!.click();
      po.asentar();

      expect(dialogos.abiertos.map(tituloDe)).toEqual([caso.editar.titulo]);

      dialogos.cerrar(caso.filas[0]);
      po.asentar();
      expect(po.avisos).toEqual([{ mensaje: caso.editar.aviso, accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
      flush();
    }));

    it('cerrar el diálogo sin guardar no avisa, y con uno abierto no se abre otro', fakeAsync(() => {
      const dialogos = montar();
      po.accionPrincipal(0)!.click();
      po.asentar();
      po.accionPrincipal(1)!.click();
      po.asentar();
      expect(dialogos.abiertos.length).toBe(1);

      dialogos.cerrar();
      po.asentar();
      expect(po.mensajesDeAviso()).toEqual([]);
      flush();
    }));
  });
}
