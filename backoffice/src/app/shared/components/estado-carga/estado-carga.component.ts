import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TipoDeCargaPendiente } from '@shared/utils/carga';

/**
 * Lo que una PÁGINA (detalle o formulario) muestra mientras no tiene qué dibujar: "cargando", o el error de
 * carga con sus salidas ("Reintentar" y/o volver al listado). Es el bloque que cada página copiaba; se pinta
 * con las clases globales `.loading-inline` y `.load-state*` (`shared-styles/_components.scss`), que van en
 * un envoltorio interno por estado (el host no lleva rol ni clases propias).
 *
 *   @if (estado.tipo !== 'ok') {
 *     <app-estado-carga [tipo]="estado.tipo" [noExiste]="estado.tipo === 'error' && estado.noExiste"
 *         cargandoTexto="Cargando plantilla…"
 *         [titulo]="…" [texto]="…" volverTexto="Ir al listado"
 *         (reintentar)="reintentar()" (volver)="volverAlListado()">
 *     </app-estado-carga>
 *   }
 *
 * No es para listas (`app-shared-table` trae sus estados) ni para un bloque dentro de una tarjeta o un
 * diálogo (`.state-panel`). El skeleton de un listado propio es `app-loading variant="skeleton"`.
 *
 * "Cargando" tiene UN solo dibujo, con `role="status"` + `aria-live="polite"`; el error y "no existe" van en
 * OTRO envoltorio, con `role="alert"`. Son dos regiones distintas a propósito: si el host cambiara de `status` a
 * `alert` y recibiera el texto en la misma pasada, NVDA y JAWS lo anuncian de forma desigual (a veces nada).
 * Toda página con `:id` distingue "no existe" (`[noExiste]`: texto propio e "Ir al listado", sin "Reintentar").
 */
@Component({
  selector: 'app-estado-carga',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  templateUrl: './estado-carga.component.html',
  styleUrl: './estado-carga.component.scss',
})
export class EstadoCargaComponent {
  /** Qué se muestra: el aviso de carga o el error. */
  @Input({ required: true }) tipo!: TipoDeCargaPendiente;

  // ── Cargando ──
  /** Un solo dibujo para toda página (detalle o formulario): ícono giratorio + este texto, anunciado (`aria-live`). */
  @Input() cargandoTexto = 'Cargando…';

  // ── Error ──
  /** La entidad no existe: ícono de archivo y sin "Reintentar" (volver a pedirla no sirve). */
  @Input() noExiste = false;
  @Input() titulo = '';
  @Input() texto = '';
  /** Segundo párrafo opcional (qué puede hacer la persona). */
  @Input() textoExtra = '';
  /** Texto del botón para salir ("Ir al listado"). Vacío = no se ofrece. */
  @Input() volverTexto = '';

  @Output() reintentar = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
}
