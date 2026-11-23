import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';

/** Un dato de la línea meta del membrete (bajo el título), separado del siguiente por un filete. */
export interface MembreteDato {
  texto: string;
  /** Ícono Phosphor sin el prefijo `ph-` (`map-pin`). Un dato `codigo` no lleva. */
  icono?: string;
  /** Identificador técnico (slug, código de rol): va en monoespaciada, como `<code>`. */
  codigo?: boolean;
}

/**
 * Membrete de una entidad: tile con ícono, título, estado y línea meta, con las acciones a la derecha. Es el
 * mismo en el detalle y en el formulario de página (que lo arma en vivo con lo que se escribe). Dibuja el
 * `.detail-header` global (`shared-styles/_components.scss`); no hay que escribir ese `<header>` a mano en
 * una pantalla (`npm run check:structure` lo rechaza).
 *
 * Contenido proyectado:
 * - `[membretePill]`: estado junto al título (una `.pill`, `<app-estado-badge>`…).
 * - `[membreteTile]`: reemplaza el tile del ícono (p. ej. el avatar con iniciales de un organismo).
 * - `[membretePie]`: franja bajo el cuerpo, dentro de la tarjeta (las pestañas de un organismo).
 * - el resto: acciones a la derecha (botones del detalle, o la pill "Editando" / "Nuevo" del formulario).
 *
 * Ejemplo real: `pages/roles/form/role-form.component.html`.
 */
@Component({
  selector: 'app-membrete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membrete.component.html',
  styleUrl: './membrete.component.scss',
})
export class MembreteComponent {
  /** Ícono Phosphor del tile, sin el prefijo `ph-` (`shield-star`). Sin ícono se espera un `[membreteTile]`. */
  @Input() icono = '';
  @Input() titulo: string | null | undefined = '';
  /** Lo que se muestra, atenuado, mientras no hay título ("Rol sin descripción"). */
  @Input() tituloVacio = '';
  @Input() datos: MembreteDato[] = [];
  /** Aviso bajo la línea meta ("Está desactivada: no aparece en el listado…"). Vacío: no se dibuja. */
  @Input() aviso = '';
  /**
   * Variante "ficha" del membrete (`.detail-header--ficha`: ícono más grande, meta más ceñida). Es la de todas
   * las pantallas salvo Organismo, que lleva avatar con iniciales y pestañas.
   */
  @Input() ficha = true;
  /**
   * Anuncia los cambios del título y la línea meta (`aria-live="polite"`). Solo donde cambian poco; en un
   * formulario que los arma con cada tecla, no: el lector ya lee el campo que se está editando.
   */
  @Input() vivo = false;
  /** El título puede recibir el foco por código (`enfocarTitulo`): le pone `tabindex="-1"`. */
  @Input() tituloEnfocable = false;

  @ViewChild('tituloRef', { static: true }) private tituloRef!: ElementRef<HTMLElement>;

  /** Lleva el foco al título (destino del foco cuando lo que lo tenía desaparece, p. ej. tras recargar). */
  enfocarTitulo(): void {
    this.tituloRef.nativeElement.focus();
  }
}
