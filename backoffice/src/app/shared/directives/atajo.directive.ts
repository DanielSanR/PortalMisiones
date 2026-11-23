import { DestroyRef, Directive, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AtajosService } from '@core/services/atajos.service';

/** Alias que se suman a la tecla principal sin repetirlos en cada pantalla (`N` → también `+`). */
const ALIAS_POR_DEFECTO: Readonly<Record<string, readonly string[]>> = { n: ['+'] };

/**
 * Atajo de teclado de una tecla sobre un botón o campo existente (ver `AtajosService`).
 *
 *   <button mat-raised-button appAtajo="n" (click)="onCreate()" *appHasPermission="'CREATE_USER'">Nuevo usuario</button>
 *   <input appAtajo="f" atajoDescripcion="Buscar en la lista" … />
 *
 * Al dispararse hace `click()` sobre botones/links y `focus()` sobre campos de texto. Como el atajo vive en
 * el propio elemento, hereda sus permisos (si `*appHasPermission` no lo renderiza, no hay atajo) y no
 * dispara si el host está deshabilitado o `aria-disabled` (`appUnavailable`).
 * Con la tecla vacía/nula queda inactivo (así un componente puede encenderlo por `@Input`).
 *
 * Descubrimiento: `aria-keyshortcuts` en el host y, en los botones, la tecla en el tooltip
 * ("Nuevo usuario (N)"). El host NO debe tener ya `matTooltip` ni `appUnavailable` (comparten tooltip).
 */
@Directive({
  selector: '[appAtajo]',
  standalone: true,
  hostDirectives: [MatTooltip],
})
export class AtajoDirective implements OnInit, OnChanges, OnDestroy {
  /** Tecla principal (`n`, `f`, `?`…). Vacío/nulo = inactivo. */
  @Input() appAtajo: string | null | undefined = '';
  /** Teclas adicionales; `n` ya trae `+`. */
  @Input() atajoAlias: string | readonly string[] | null | undefined;
  /** Texto para el diálogo de ayuda. Por defecto, el `aria-label` o el texto del host. */
  @Input() atajoDescripcion: string | null | undefined;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly atajos = inject(AtajosService);
  private readonly tooltip = inject(MatTooltip, { self: true });
  private readonly destroyRef = inject(DestroyRef);

  private desregistrar?: () => void;
  private habilitado = true;
  private iniciado = false;

  constructor() {
    this.atajos.habilitados$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((h) => {
        this.habilitado = h;
        this.sincronizarHost();
      });
  }

  ngOnInit(): void {
    this.iniciado = true;
    this.registrar();
  }

  ngOnChanges(): void {
    if (this.iniciado) this.registrar();
  }

  ngOnDestroy(): void {
    this.desregistrar?.();
  }

  /** El texto del host puede cambiar ("Expandir"/"Colapsar"): se relee justo antes de mostrar el tooltip. */
  @HostListener('mouseenter')
  @HostListener('focus')
  refrescarTooltip(): void {
    this.sincronizarHost();
  }

  private get teclas(): string[] {
    const principal = (this.appAtajo ?? '').trim();
    if (!principal) return [];
    const extra = this.atajoAlias == null ? [] : typeof this.atajoAlias === 'string' ? [this.atajoAlias] : [...this.atajoAlias];
    const porDefecto = ALIAS_POR_DEFECTO[principal.toLocaleLowerCase('es-AR')] ?? [];
    return [...new Set([principal, ...porDefecto, ...extra].filter(Boolean))];
  }

  private get esCampo(): boolean {
    const el = this.host;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
    return el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(el.type);
  }

  private descripcion(): string {
    const explicita = this.atajoDescripcion?.trim();
    if (explicita) return explicita;
    const aria = this.host.getAttribute('aria-label')?.trim();
    if (aria) return aria;
    return (this.host.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private registrar(): void {
    this.desregistrar?.();
    this.desregistrar = undefined;
    const teclas = this.teclas;
    if (teclas.length > 0) {
      this.desregistrar = this.atajos.registrar({
        teclas,
        descripcion: () => this.descripcion(),
        elemento: this.host,
        accion: () => (this.esCampo ? this.host.focus() : this.host.click()),
      });
    }
    this.sincronizarHost();
  }

  /** `aria-keyshortcuts` y tooltip solo mientras el atajo existe y los atajos están encendidos. */
  private sincronizarHost(): void {
    const teclas = this.teclas;
    const activo = this.habilitado && teclas.length > 0;
    if (activo) {
      // En ARIA el "+" une modificadores: la tecla "más" se declara `Plus`.
      this.host.setAttribute('aria-keyshortcuts', teclas
        .map((t) => (t === '+' ? 'Plus' : t.length === 1 ? t.toLocaleUpperCase('es-AR') : t))
        .join(' '));
    } else {
      this.host.removeAttribute('aria-keyshortcuts');
    }
    // En campos de texto un tooltip al enfocar estorba al escribir: el descubrimiento va por aria + diálogo `?`.
    const conTooltip = activo && !this.esCampo;
    this.tooltip.disabled = !conTooltip;
    if (conTooltip) {
      const texto = this.descripcion();
      const tecla = teclas[0].length === 1 ? teclas[0].toLocaleUpperCase('es-AR') : teclas[0];
      this.tooltip.message = texto ? `${texto} (${tecla})` : tecla;
    }
  }
}
