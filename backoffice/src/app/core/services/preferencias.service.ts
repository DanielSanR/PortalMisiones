import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, defer, distinctUntilChanged, map } from 'rxjs';
import {
  OPCIONES_AVISOS,
  OPCIONES_DENSIDAD,
  OPCIONES_FILAS_POR_PAGINA,
  PREFERENCIAS_DE_FABRICA,
  Preferencias,
} from '@core/models/preferencias.model';
import { AtajosService } from './atajos.service';

/** Clave de `localStorage` con las preferencias (JSON de `Preferencias`). */
export const PREFERENCIAS_STORAGE_KEY = 'preferencias_backoffice';

/** Clave de `localStorage` con el correo recordado en el login (nunca la contraseña). */
export const CLAVE_EMAIL_RECORDADO = 'backoffice.login.email';

/** Clase de `<html>` que activa la densidad compacta. */
const CLASE_DENSIDAD_COMPACTA = 'densidad-compacta';

function elegir<T>(valor: unknown, permitidos: readonly T[], fabrica: T): T {
  return permitidos.includes(valor as T) ? (valor as T) : fabrica;
}

function booleano(valor: unknown, fabrica: boolean): boolean {
  return typeof valor === 'boolean' ? valor : fabrica;
}

/**
 * Lee las preferencias guardadas. Sin storage, con storage bloqueado o con JSON roto devuelve las de fábrica;
 * un campo con un valor no permitido vuelve a su valor de fábrica sin tocar los demás.
 */
export function leerPreferencias(storage: Storage | null | undefined): Preferencias {
  let guardadas: Record<string, unknown>;
  try {
    const crudo: unknown = JSON.parse(storage?.getItem(PREFERENCIAS_STORAGE_KEY) ?? 'null');
    if (typeof crudo !== 'object' || crudo === null) return { ...PREFERENCIAS_DE_FABRICA };
    guardadas = crudo as Record<string, unknown>;
  } catch {
    return { ...PREFERENCIAS_DE_FABRICA };
  }
  const f = PREFERENCIAS_DE_FABRICA;
  return {
    filasPorPagina: elegir(guardadas['filasPorPagina'], OPCIONES_FILAS_POR_PAGINA, f.filasPorPagina),
    densidad: elegir(guardadas['densidad'], OPCIONES_DENSIDAD, f.densidad),
    avisos: elegir(guardadas['avisos'], OPCIONES_AVISOS, f.avisos),
    recordarMenuContraido: booleano(guardadas['recordarMenuContraido'], f.recordarMenuContraido),
    menuContraido: booleano(guardadas['menuContraido'], f.menuContraido),
  };
}

/**
 * `true` si todas las elecciones de la persona están como vienen. `menuContraido` no cuenta: no es una elección sino el
 * registro de cómo quedó el menú (el layout lo guarda en cada contraer / expandir).
 */
function sonDeFabrica(p: Preferencias): boolean {
  return (Object.keys(PREFERENCIAS_DE_FABRICA) as (keyof Preferencias)[])
    .filter((clave) => clave !== 'menuContraido')
    .every((clave) => p[clave] === PREFERENCIAS_DE_FABRICA[clave]);
}

/**
 * Preferencias locales del backoffice (por navegador, no por cuenta). Si `localStorage` no existe o tira
 * (modo privado, lleno), la preferencia rige igual en memoria durante la sesión.
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly atajos = inject(AtajosService);

  private readonly preferenciasSubject = new BehaviorSubject<Preferencias>(leerPreferencias(this.storage()));
  private readonly correoSubject = new BehaviorSubject<string>('');

  readonly preferencias$: Observable<Preferencias> = this.preferenciasSubject.asObservable();

  /** `true` si todo está como de fábrica, incluidos los atajos de teclado encendidos. */
  readonly esDeFabrica$: Observable<boolean> = combineLatest([this.preferencias$, this.atajos.habilitados$]).pipe(
    map(([p, atajos]) => atajos && sonDeFabrica(p)),
    distinctUntilChanged(),
  );

  /**
   * Correo que el login recuerda en este navegador (`''` si no hay). Cada suscripción arranca de lo guardado en ese
   * momento (`defer`): el servicio vive toda la sesión y el login puede haber recordado otro correo después de crearlo.
   */
  readonly correoRecordado$: Observable<string> = defer(() => {
    this.correoSubject.next(this.leerCorreo());
    return this.correoSubject.asObservable();
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.preferencias$
      .pipe(
        map((p) => p.densidad),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((densidad) =>
        this.document.documentElement.classList.toggle(CLASE_DENSIDAD_COMPACTA, densidad === 'compacta'),
      );
  }

  /** Valor actual (lectura síncrona). */
  get actual(): Preferencias {
    return this.preferenciasSubject.value;
  }

  actualizar(cambios: Partial<Preferencias>): void {
    this.guardar({ ...this.actual, ...cambios });
  }

  /**
   * Vuelve todo a fábrica, incluidos los atajos de teclado (encendidos). No toca el correo recordado ni
   * `menuContraido`, que sigue registrando cómo está el menú ahora.
   */
  restablecer(): void {
    this.guardar({ ...PREFERENCIAS_DE_FABRICA, menuContraido: this.actual.menuContraido });
    this.atajos.setHabilitados(true);
  }

  olvidarCorreo(): void {
    this.correoSubject.next('');
    try {
      this.storage()?.removeItem(CLAVE_EMAIL_RECORDADO);
    } catch {
      // Storage bloqueado: no hay nada que borrar.
    }
  }

  private guardar(preferencias: Preferencias): void {
    this.preferenciasSubject.next(preferencias);
    try {
      this.storage()?.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify(preferencias));
    } catch {
      // Storage bloqueado o lleno: la preferencia rige igual durante la sesión.
    }
  }

  private leerCorreo(): string {
    try {
      return this.storage()?.getItem(CLAVE_EMAIL_RECORDADO) ?? '';
    } catch {
      return '';
    }
  }

  /** `localStorage` del navegador, o `null` fuera del browser o si acceder tira. */
  private storage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
