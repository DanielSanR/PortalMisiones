import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { Observable, map, of, startWith } from 'rxjs';
import { VistaDeCampo } from '@core/models/field.interface';
import { CategoriaVM } from '@features/categorias';

/** Lo que la franja necesita además del formulario. */
export interface DatosDeUbicacion {
  /** Listado plano completo: de acá sale la ruta de ancestros. */
  categorias: CategoriaVM[];
  esEdicion: boolean;
}

/** Lo que muestra la franja "dónde queda", derivado del formulario. */
interface Ubicacion {
  /** Nombres de los ancestros, de la raíz hacia abajo. */
  ruta: string[];
  nombre: string;
  slug: string;
}

/** Nombres desde la raíz hasta `parentId` inclusive. Corta si encuentra un ciclo. */
export function rutaHasta(categorias: CategoriaVM[], parentId: string): string[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const ruta: string[] = [];
  const vistos = new Set<string>();
  let actual = parentId ? porId.get(parentId) : undefined;
  while (actual && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    ruta.unshift(actual.nombre);
    actual = actual.parentId ? porId.get(actual.parentId) : undefined;
  }
  return ruta;
}

/**
 * Franja "dónde queda" del diálogo de categoría: la ruta en el árbol, el nombre y el slug, armándose con
 * lo que se escribe. Es un campo `vista` del dynamic form (`categoria-dialogo.ts`): solo lee el formulario.
 */
@Component({
  selector: 'app-categoria-ubicacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe],
  templateUrl: './categoria-ubicacion.component.html',
  styleUrl: './categoria-ubicacion.component.scss',
})
export class CategoriaUbicacionComponent implements OnChanges, VistaDeCampo {
  @Input({ required: true }) grupo!: FormGroup;
  @Input() datos?: DatosDeUbicacion;

  ubicacion$: Observable<Ubicacion | null> = of(null);

  ngOnChanges(): void {
    const grupo = this.grupo;
    const categorias = this.datos?.categorias ?? [];
    this.ubicacion$ = grupo.valueChanges.pipe(
      startWith(null),
      map(() => {
        const valor: Record<string, unknown> = grupo.getRawValue();
        return {
          ruta: rutaHasta(categorias, String(valor['parentId'] ?? '')),
          nombre: String(valor['nombre'] ?? '').trim(),
          slug: String(valor['slug'] ?? ''),
        };
      }),
    );
  }
}
