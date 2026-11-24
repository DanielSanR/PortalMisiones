import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable, combineLatest, map } from 'rxjs';
import {
  Densidad,
  DuracionDeAvisos,
  FilasPorPagina,
  OPCIONES_AVISOS,
  OPCIONES_DENSIDAD,
  OPCIONES_FILAS_POR_PAGINA,
  Preferencias,
} from '@core/models/preferencias.model';
import { CuentaFacade } from '@features/cuenta';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';

interface VistaDePreferencias {
  preferencias: Preferencias;
  deFabrica: boolean;
  atajos: boolean;
  correo: string;
}

interface Opcion<T> {
  valor: T;
  titulo: string;
  ayuda: string;
}

const TEXTOS_DENSIDAD: Record<Densidad, Omit<Opcion<Densidad>, 'valor'>> = {
  comoda: { titulo: 'Cómoda', ayuda: 'Filas de 56 px, más aire' },
  compacta: { titulo: 'Compacta', ayuda: 'Filas de 44 px, entran más' },
};

const TEXTOS_AVISOS: Record<DuracionDeAvisos, Omit<Opcion<DuracionDeAvisos>, 'valor'>> = {
  normal: { titulo: 'Normal', ayuda: 'Los de éxito se ven 3 s, los de error 5 s y las advertencias 8 s.' },
  largo: { titulo: 'Más tiempo', ayuda: 'El doble: 6 s, 10 s y 16 s.' },
  fijo: { titulo: 'Hasta que lo cierre', ayuda: 'Quedan en pantalla hasta que tocás "Cerrar".' },
};

/** Atajos que muestra la tabla de "Teclado" (fija: son los transversales, no los que estén registrados ahora). */
const ATAJOS: readonly { tecla: string; accion: string; donde: string }[] = [
  { tecla: '/', accion: 'Buscar en el menú lateral', donde: 'En todo el backoffice' },
  { tecla: '?', accion: 'Ver los atajos de la pantalla', donde: 'En todo el backoffice' },
  { tecla: 'N', accion: 'Crear (Nuevo organismo, Nueva etiqueta…)', donde: 'Listas donde podés crear' },
  { tecla: 'F', accion: 'Ir al buscador de la lista', donde: 'Listas con buscador' },
];

/** Total de la vista previa de "Listas y tablas" ("1–10 de 68"): un número de ejemplo, no un dato real. */
const TOTAL_DE_EJEMPLO = 68;

/**
 * "Preferencias": lo que se ajusta en este navegador (atajos, listas, avisos, menú, correo recordado). Todo vive en
 * `localStorage`; no hay backend ni cuenta detrás.
 *
 * Excepción a `formularios-dynamic-form.md`: no usa `app-dynamic-form` porque no es un formulario de envío. No hay
 * "Guardar": cada control aplica y guarda al momento (`CuentaFacade.actualizarPreferencias`), así que no hay
 * `FormGroup`, cambios sin guardar ni error de guardado. Los controles son de Material, sin formularios reactivos.
 */
@Component({
  selector: 'app-preferencias-form',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatRadioModule,
    MatSlideToggleModule,
    UnavailableDirective,
  ],
  templateUrl: './preferencias-form.component.html',
  styleUrl: './preferencias-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferenciasFormComponent {
  private readonly cuenta = inject(CuentaFacade);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Bloque del correo recordado: recibe el foco cuando "Olvidar" (que tenía el foco) desaparece. */
  @ViewChild('bloqueCorreo') private bloqueCorreo?: ElementRef<HTMLElement>;

  readonly atajos = ATAJOS;
  readonly opcionesFilas = OPCIONES_FILAS_POR_PAGINA;
  readonly opcionesDensidad: Opcion<Densidad>[] = OPCIONES_DENSIDAD.map((valor) => ({ valor, ...TEXTOS_DENSIDAD[valor] }));
  readonly opcionesAvisos: Opcion<DuracionDeAvisos>[] = OPCIONES_AVISOS.map((valor) => ({ valor, ...TEXTOS_AVISOS[valor] }));
  /** Cinco filas de muestra: alcanzan para que se note el alto de fila. */
  readonly filasDeMuestra = [1, 2, 3, 4, 5];
  readonly totalDeEjemplo = TOTAL_DE_EJEMPLO;
  /** Ejemplos de "Idioma y formato": se formatean con el `LOCALE_ID` de la app (es-AR). */
  readonly hoy = new Date();
  readonly numeroDeEjemplo = 1284.5;

  readonly vista$: Observable<VistaDePreferencias> = combineLatest([
    this.cuenta.preferencias$,
    this.cuenta.preferenciasDeFabrica$,
    this.cuenta.atajosHabilitados$,
    this.cuenta.correoRecordado$,
  ]).pipe(map(([preferencias, deFabrica, atajos, correo]) => ({ preferencias, deFabrica, atajos, correo })));

  alCambiarAtajos(encendidos: boolean): void {
    this.cuenta.setAtajosHabilitados(encendidos);
  }

  alCambiarFilas(cambio: MatButtonToggleChange): void {
    this.cuenta.actualizarPreferencias({ filasPorPagina: cambio.value as FilasPorPagina });
  }

  alCambiarDensidad(cambio: MatRadioChange): void {
    this.cuenta.actualizarPreferencias({ densidad: cambio.value as Densidad });
  }

  alCambiarAvisos(cambio: MatRadioChange): void {
    this.cuenta.actualizarPreferencias({ avisos: cambio.value as DuracionDeAvisos });
  }

  alCambiarRecordarMenu(recordar: boolean): void {
    this.cuenta.actualizarPreferencias({ recordarMenuContraido: recordar });
  }

  /** Con valores de fábrica el botón queda `aria-disabled` (`appUnavailable` anula el clic): no llega acá. */
  restablecer(): void {
    this.cuenta.restablecerPreferencias();
  }

  olvidarCorreo(): void {
    this.cuenta.olvidarCorreo();
    // "Olvidar" deja de dibujarse: se pinta el texto nuevo y el foco va a ese bloque (no cae a <body>, WCAG 2.4.3).
    this.cdr.detectChanges();
    this.bloqueCorreo?.nativeElement.focus();
  }
}
