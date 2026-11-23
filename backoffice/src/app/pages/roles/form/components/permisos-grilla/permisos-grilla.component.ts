import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, defer, map, of, startWith, switchMap } from 'rxjs';
import { PermisoVM } from '@features/permisos';
import { ListSearchComponent } from '@shared/components/list-search/list-search.component';
import { GrupoPermisosVista, VistaDeGrilla, alternarGrupo, alternarPermiso, vistaDeGrilla } from './permisos-grilla.vista';

/**
 * Grilla de permisos del formulario de rol: buscador, grupos por recurso con su contador y su "Marcar todos",
 * y un chip por permiso. El valor vive en el control que recibe (`permissionsIds`, un `string[]` del formulario
 * que la hospeda): otorgar o quitar un permiso lo escribe ahí y lo marca como editado, así "Guardar" y el aviso
 * de cambios sin guardar lo ven. La búsqueda sí es propia: escribir ahí no es un cambio del rol.
 *
 * Va dentro de un panel `acotado` de `.ficha-paneles`: el buscador queda fijo y los grupos se desplazan
 * (`.ficha-paneles__desplazable`). Por eso el host no genera caja (ver el `.scss`).
 */
@Component({
  selector: 'app-permisos-grilla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, ListSearchComponent],
  templateUrl: './permisos-grilla.component.html',
  styleUrl: './permisos-grilla.component.scss',
})
export class PermisosGrillaComponent {
  private readonly permisos$ = new BehaviorSubject<PermisoVM[]>([]);
  private readonly control$ = new BehaviorSubject<AbstractControl | null>(null);

  /** Catálogo completo de permisos. */
  @Input({ required: true }) set permisos(valor: PermisoVM[]) {
    this.permisos$.next(valor);
  }

  /** Control con los ids otorgados (`string[]`). */
  @Input({ required: true }) set control(valor: AbstractControl | null) {
    this.control$.next(valor);
  }

  readonly busqueda = new FormControl('', { nonNullable: true });

  readonly vista$: Observable<VistaDeGrilla> = defer(() =>
    combineLatest([
      this.permisos$,
      this.control$.pipe(switchMap((control) => (control ? control.valueChanges.pipe(startWith(null), map(() => idsDe(control))) : of([])))),
      this.busqueda.valueChanges.pipe(startWith(this.busqueda.value)),
    ]),
  ).pipe(map(([permisos, otorgados, busqueda]) => vistaDeGrilla(permisos, otorgados, busqueda)));

  alternarPermiso(permisoId: string): void {
    this.escribir((otorgados) => alternarPermiso(otorgados, permisoId));
  }

  alternarGrupo(grupo: GrupoPermisosVista): void {
    this.escribir((otorgados) => alternarGrupo(otorgados, grupo));
  }

  /**
   * Parte del valor que el control tiene AHORA (dos clics seguidos no se pisan). `setValue` no ensucia el
   * control: se marca antes, para que quien escucha el cambio ya lo vea editado.
   */
  private escribir(cambio: (otorgados: string[]) => string[]): void {
    const control = this.control$.value;
    if (!control) return;
    control.markAsDirty();
    control.setValue(cambio(idsDe(control)));
  }
}

function idsDe(control: AbstractControl): string[] {
  const valor: unknown = control.value;
  return Array.isArray(valor) ? valor.map(String) : [];
}
