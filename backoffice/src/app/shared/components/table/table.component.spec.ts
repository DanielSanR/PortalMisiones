import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { VentanaEscritorio, abrirVentanaEscritorio } from '@shared/utils/testing/ventana-escritorio.testing';
import { SharedTableComponent, TableCellDirective } from './table.component';
import { TableColumn } from './table-column.model';

interface Fila { id: string; nombre: string }

const FILAS: Fila[] = [{ id: 'o-1', nombre: 'Ministerio de Salud' }];

/** Una tabla con avatar de 30px en la celda (como Organismos y Usuarios) y otra solo de texto. */
@Component({
  standalone: true,
  imports: [SharedTableComponent, TableCellDirective],
  template: `
    <app-shared-table class="con-avatar" [columns]="columnas" [data]="filas">
      <ng-template appTableCell="nombre" let-row>
        <div class="cell-person">
          <span class="cell-avatar" aria-hidden="true">MS</span>
          <div class="cell-name"><span class="cell-name__principal">{{ row.nombre }}</span></div>
        </div>
      </ng-template>
    </app-shared-table>
    <app-shared-table class="solo-texto" [columns]="columnas" [data]="filas"></app-shared-table>
  `,
})
class TablasHost {
  readonly columnas: TableColumn<Fila>[] = [{ key: 'nombre', label: 'Nombre' }];
  readonly filas = FILAS;
}

/** Alto real de las filas según la densidad de Preferencias (clase `densidad-compacta` en `<html>`). */
describe('SharedTableComponent — densidad', () => {
  let fixture: ComponentFixture<TablasHost>;
  let ventana: VentanaEscritorio | null;

  const altoDeFila = (tabla: string): number =>
    (fixture.nativeElement as HTMLElement).querySelector(`.${tabla} .mat-mdc-row`)!.getBoundingClientRect().height;

  beforeEach(() => {
    ventana = null;
    TestBed.configureTestingModule({
      imports: [TablasHost, NoopAnimationsModule],
      providers: [{
        provide: AuthTokenService,
        useValue: { getCurrentUser$: () => of(null), can: () => true, canAccess: () => true },
      }],
    });
    fixture = TestBed.createComponent(TablasHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    ventana?.cerrar();
    document.documentElement.classList.remove('densidad-compacta');
    (fixture.nativeElement as HTMLElement).remove();
  });

  describe('en escritorio', () => {
    beforeEach(async () => {
      ventana = await abrirVentanaEscritorio(fixture.nativeElement);
    });

    it('en cómoda la fila con avatar de 30px mide 56px, igual que la de solo texto', () => {
      expect(altoDeFila('con-avatar')).toBe(56);
      expect(altoDeFila('solo-texto')).toBe(56);
    });

    it('en compacta la fila con avatar de 30px mide 44px: el padding vertical de la celda también se achica', () => {
      ventana!.densidadCompacta(true);

      expect(altoDeFila('con-avatar')).toBe(44);
      expect(altoDeFila('solo-texto')).toBe(44);
    });
  });

  // El viewport de Karma (~750px) es `mobile`: ahí la fila queda en 48px para el toque, con cualquier densidad.
  it('en mobile la fila sigue en 48px aunque la densidad sea compacta', () => {
    document.body.append(fixture.nativeElement);
    document.documentElement.classList.add('densidad-compacta');

    expect(altoDeFila('con-avatar')).toBe(48);
    expect(altoDeFila('solo-texto')).toBe(48);
  });
});
