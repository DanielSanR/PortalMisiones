import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, map, of, scan, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { EscrituraDeVista, VistaDeCampo } from '@core/models/field.interface';
import { Coordenadas, EncuadreDeMapa, mismasCoordenadas } from '@core/models/ubicacion.model';
import { GeocodificacionFacade, LugarVM } from '@features/geocodificacion';
import { MapaUbicacionComponent } from '@shared/components/mapa-ubicacion/mapa-ubicacion.component';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { formatearCoordenada, parsearCoordenada, urlMapa } from '../coordenadas';
import {
  TEXTO_ALTERNATIVA, TEXTO_BUSCAR_SIN_DIRECCION, TEXTO_BUSQUEDA_FALLIDA, TEXTO_GEOCODIFICACION_NO_DISPONIBLE, TEXTO_SIN_MAPA,
  TEXTO_SIN_RESULTADOS, textoDeResultados,
} from './punto-ubicacion-textos';

/** Lo que el diálogo le pasa a la vista (`vista.datos`). */
export interface DatosDeUbicacion {
  /** Localidad de la ficha: completa la búsqueda y centra el mapa en un alta. */
  localidad: string | null;
}

/** Estado de "Ubicar en el mapa". */
export type Busqueda =
  | { tipo: 'inicial' }
  | { tipo: 'buscando' }
  | { tipo: 'mensaje'; texto: string; error: boolean }
  | { tipo: 'resultados'; lugares: LugarVM[]; elegido: string; texto: string };

interface Vista {
  ubicacion: Coordenadas | null;
  encuadre: EncuadreDeMapa | null;
  enlace: string | null;
  busqueda: Busqueda;
}

/**
 * Ubicación del punto de atención dentro de su diálogo: "Ubicar en el mapa" (geocodifica la dirección escrita
 * con la localidad de la ficha) y el mapa interactivo para marcarlo. Es un campo `vista` que ESCRIBE
 * (`vista.escribe: ['latitud', 'longitud']`, ver `FieldVista` en `@core/models/field.interface`): los campos
 * Latitud y Longitud siguen en el formulario como forma alternativa de cargarla, y todo va y viene:
 *
 * - marcar o mover el marcador, o elegir un resultado de la búsqueda, completa las coordenadas (6 decimales);
 * - coordenadas escritas a mano y válidas mueven el marcador; inválidas no lo tocan (el error se ve en el campo);
 *   vaciar las dos lo quita.
 *
 * El mapa (`app-mapa-ubicacion`, que baja Leaflet en diferido) va en un `@defer`: no viaja con el panel.
 * "Abrir en OpenStreetMap" queda como verificación externa: sirve también cuando el mapa no puede cargar
 * (p. ej. una CSP que todavía no permite los tiles).
 */
@Component({
  selector: 'app-punto-ubicacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, MatButtonModule, MapaUbicacionComponent, UnavailableDirective],
  templateUrl: './punto-ubicacion.component.html',
  styleUrl: './punto-ubicacion.component.scss',
})
export class PuntoUbicacionComponent implements OnInit, VistaDeCampo {
  @Input({ required: true }) grupo!: FormGroup;
  @Input() datos?: DatosDeUbicacion;
  @Input() escribir?: EscrituraDeVista;

  private readonly geocodificacion = inject(GeocodificacionFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  /** `false` (disponible) o el motivo por el que "Ubicar en el mapa" no anda en este entorno. */
  readonly motivoNoDisponible: string | false = this.geocodificacion.disponible ? false : TEXTO_GEOCODIFICACION_NO_DISPONIBLE;

  readonly textoSinMapa = TEXTO_SIN_MAPA;
  readonly textoAlternativa = TEXTO_ALTERNATIVA;

  private readonly busqueda$ = new BehaviorSubject<Busqueda>({ tipo: 'inicial' });
  vista$: Observable<Vista> = of({ ubicacion: null, encuadre: null, enlace: null, busqueda: { tipo: 'inicial' } });

  ngOnInit(): void {
    const cambios$ = this.grupo.valueChanges.pipe(startWith(null));
    const valida$ = cambios$.pipe(map(() => this.coordenadasDelFormulario()), distinctUntilChanged(mismasCoordenadas));
    // El marcador sigue a las coordenadas válidas; con una inválida a medio escribir se queda donde estaba, y se
    // quita solo si se vacían las dos.
    const marcador$ = cambios$.pipe(
      scan((previo: Coordenadas | null) => this.coordenadasDelFormulario() ?? (this.coordenadasVacias() ? null : previo), null),
      distinctUntilChanged(mismasCoordenadas),
    );
    // Solo un alta (sin coordenadas al abrir) pide dónde queda la localidad; una vez por localidad y sesión.
    const encuadre$ = this.coordenadasDelFormulario()
      ? of(null)
      : this.geocodificacion.encuadreDeLocalidad(this.datos?.localidad ?? null).pipe(startWith(null));
    this.vista$ = combineLatest([valida$, marcador$, encuadre$, this.busqueda$]).pipe(
      map(([valida, ubicacion, encuadre, busqueda]) => ({
        ubicacion,
        encuadre,
        enlace: valida ? urlMapa(valida.latitud, valida.longitud) : null,
        busqueda,
      })),
    );
  }

  /** La persona marcó o movió el punto en el mapa. */
  alMarcar(punto: Coordenadas): void {
    this.escribirCoordenadas(punto);
  }

  /** "Ubicar en el mapa": una búsqueda por clic (política de uso de Nominatim: nada de buscar mientras se escribe). */
  ubicarDireccion(): void {
    if (this.busqueda$.value.tipo === 'buscando') return;
    const direccion = String(this.grupo.get('direccion')?.value ?? '').trim();
    if (!direccion) {
      this.busqueda$.next({ tipo: 'mensaje', texto: TEXTO_BUSCAR_SIN_DIRECCION, error: true });
      return;
    }
    this.busqueda$.next({ tipo: 'buscando' });
    this.geocodificacion.buscarDireccion(direccion, this.datos?.localidad ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lugares) => {
          if (!lugares.length) {
            this.busqueda$.next({ tipo: 'mensaje', texto: TEXTO_SIN_RESULTADOS, error: true });
          } else {
            this.elegir(lugares, lugares[0]);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.busqueda$.next({ tipo: 'mensaje', texto: TEXTO_BUSQUEDA_FALLIDA, error: true });
          this.cdr.markForCheck();
        },
      });
  }

  /** Propone un resultado: mueve el marcador y completa las coordenadas. Con varios, quedan para elegir otro. */
  elegir(lugares: LugarVM[], lugar: LugarVM): void {
    this.escribirCoordenadas(lugar.coordenadas);
    this.busqueda$.next({ tipo: 'resultados', lugares, elegido: lugar.id, texto: textoDeResultados(lugares.length, lugar.nombre) });
  }

  private escribirCoordenadas(punto: Coordenadas): void {
    this.escribir?.({ latitud: formatearCoordenada(punto.latitud), longitud: formatearCoordenada(punto.longitud) });
  }

  private coordenadasVacias(): boolean {
    return ['latitud', 'longitud'].every((nombre) => !String(this.grupo.get(nombre)?.value ?? '').trim());
  }

  /** Las coordenadas del formulario, solo si las dos son válidas (si no, el mapa no se mueve). */
  private coordenadasDelFormulario(): Coordenadas | null {
    const latitud = this.grupo.get('latitud');
    const longitud = this.grupo.get('longitud');
    if (!latitud || !longitud || latitud.invalid || longitud.invalid) return null;
    const lat = parsearCoordenada(latitud.value);
    const lon = parsearCoordenada(longitud.value);
    return lat !== null && lon !== null ? { latitud: lat, longitud: lon } : null;
  }
}
