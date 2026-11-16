import { DestroyRef, Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';

/** Clave de `localStorage` de la preferencia "Atajos de teclado" (`'1'` encendido, `'0'` apagado). */
export const ATAJOS_STORAGE_KEY = 'atajos_teclado';

/** Foco en un campo editable: ahí las teclas son para escribir (WCAG 2.1.4). */
const SELECTOR_EDITABLE =
  'input, textarea, select, mat-select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="textbox"]';

/**
 * Overlay con backdrop activo (menú, select, etc.) o menú lateral abierto sobre el contenido (mobile):
 * los atajos no deben disparar por debajo.
 */
const SELECTOR_BACKDROP = '.cdk-overlay-backdrop-showing, .mat-drawer-backdrop.mat-drawer-shown';

/** Alta de un atajo. Lo usa la directiva `appAtajo` y, para el shell, el código directo. */
export interface AtajoRegistro {
  /** Teclas que lo disparan (la primera es la "principal" que se muestra). Ej.: `['n', '+']`. */
  teclas: readonly string[];
  /** Texto para el diálogo de ayuda; puede ser una función para leerlo recién al listar. */
  descripcion: string | (() => string);
  accion: () => void;
  /** Elemento que dispara (si lo hay): el atajo solo vale mientras esté conectado, visible y habilitado. */
  elemento?: HTMLElement | null;
}

/** Un atajo vigente, listo para mostrar. */
export interface AtajoVisible {
  teclas: readonly string[];
  descripcion: string;
}

/** `true` si el elemento está en el DOM, se ve y no está deshabilitado (nativo o `aria-disabled`). */
export function elementoDisponible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if ((el as HTMLButtonElement).disabled === true) return false;
  if (el.getAttribute('aria-disabled') === 'true') return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkVisibilityCSS: true });
  return el.getClientRects().length > 0;
}

/**
 * Atajos de teclado de una tecla, transversales al backoffice. UN solo listener de `keydown` en `document`;
 * las directivas (`appAtajo`) y el shell se registran y desregistran. Sin modificadores, fuera de campos
 * editables, sin diálogos/menús abiertos y apagables por el usuario (WCAG 2.1.4 Character Key Shortcuts).
 */
@Injectable({ providedIn: 'root' })
export class AtajosService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private readonly registros: AtajoRegistro[] = [];
  private readonly habilitadosSubject = new BehaviorSubject<boolean>(this.leerPreferencia());

  /** Preferencia "Atajos de teclado" (default encendido). */
  readonly habilitados$: Observable<boolean> = this.habilitadosSubject.asObservable();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => {
      fromEvent<KeyboardEvent>(this.document, 'keydown')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => this.alPresionar(event));
    });
  }

  /** Valor actual de la preferencia (lectura síncrona para las directivas). */
  get habilitados(): boolean {
    return this.habilitadosSubject.value;
  }

  setHabilitados(valor: boolean): void {
    this.habilitadosSubject.next(valor);
    try {
      this.document.defaultView?.localStorage.setItem(ATAJOS_STORAGE_KEY, valor ? '1' : '0');
    } catch {
      // Storage bloqueado o lleno: la preferencia rige igual durante la sesión.
    }
  }

  /** Registra un atajo; devuelve la función que lo desregistra. */
  registrar(registro: AtajoRegistro): () => void {
    this.registros.push(registro);
    return () => {
      const i = this.registros.indexOf(registro);
      if (i !== -1) this.registros.splice(i, 1);
    };
  }

  /** Atajos vigentes ahora (conectados, visibles y habilitados). Si dos comparten tecla, solo el último. */
  listar(): AtajoVisible[] {
    if (!this.habilitados) return [];
    const vistos = new Set<string>();
    const resultado: AtajoVisible[] = [];
    for (let i = this.registros.length - 1; i >= 0; i--) {
      const r = this.registros[i];
      if (!this.vigente(r)) continue;
      const claves = r.teclas.map((t) => this.normalizar(t));
      if (claves.every((c) => vistos.has(c))) continue;
      claves.forEach((c) => vistos.add(c));
      resultado.push({
        teclas: r.teclas,
        descripcion: typeof r.descripcion === 'function' ? r.descripcion() : r.descripcion,
      });
    }
    return resultado.reverse();
  }

  private vigente(r: AtajoRegistro): boolean {
    return !r.elemento || elementoDisponible(r.elemento);
  }

  private normalizar(tecla: string): string {
    return tecla.length === 1 ? tecla.toLocaleLowerCase('es-AR') : tecla;
  }

  private alPresionar(event: KeyboardEvent): void {
    if (!this.habilitados || this.registros.length === 0) return;
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    // Shift solo donde la tecla lo requiere (`?`, `+`, `/` según el teclado): una letra con Shift no es el atajo.
    if (event.shiftKey && /\p{L}/u.test(event.key)) return;
    if (this.hayEditableEnFoco(event.target)) return;
    if (this.dialog.openDialogs.length > 0 || this.document.querySelector(SELECTOR_BACKDROP)) return;

    const tecla = this.normalizar(event.key);
    for (let i = this.registros.length - 1; i >= 0; i--) {
      const r = this.registros[i];
      if (!r.teclas.some((t) => this.normalizar(t) === tecla) || !this.vigente(r)) continue;
      event.preventDefault();
      this.zone.run(() => r.accion());
      return;
    }
  }

  private hayEditableEnFoco(target: EventTarget | null): boolean {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    return !!el.closest(SELECTOR_EDITABLE) || (el as HTMLElement).isContentEditable === true;
  }

  private leerPreferencia(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    try {
      return this.document.defaultView?.localStorage.getItem(ATAJOS_STORAGE_KEY) !== '0';
    } catch {
      return true;
    }
  }
}
