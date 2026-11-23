import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TipoDeCargaPendiente } from '@shared/utils/carga';
import { EstadoCargaComponent } from './estado-carga.component';

@Component({
  standalone: true,
  imports: [EstadoCargaComponent],
  template: `
    <app-estado-carga class="propia" [tipo]="tipo" [noExiste]="noExiste"
        cargandoTexto="Cargando la ficha…"
        titulo="No pudimos cargar la ficha" texto="Revisá tu conexión e intentá de nuevo."
        [textoExtra]="textoExtra" [volverTexto]="volverTexto"
        (reintentar)="reintentos = reintentos + 1" (volver)="salidas = salidas + 1">
    </app-estado-carga>`,
})
class HostComponent {
  tipo: TipoDeCargaPendiente = 'cargando';
  noExiste = false;
  textoExtra = '';
  volverTexto = 'Ir al listado';
  reintentos = 0;
  salidas = 0;
}

describe('EstadoCargaComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const bloque = (): HTMLElement => fixture.nativeElement.querySelector('app-estado-carga');
  const botones = (): HTMLButtonElement[] => Array.from(bloque().querySelectorAll('button'));
  const textos = (): string[] => botones().map((b) => b.textContent!.trim());

  function con(cambios: Partial<HostComponent>): void {
    Object.assign(host, cambios);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** El envoltorio de cada estado (el host no lleva rol ni clases propias). */
  const region = (): HTMLElement => bloque().querySelector(':scope > [role]')!;

  describe('cargando', () => {
    it('un solo dibujo: un `.loading-inline` con `role="status"` y `aria-live`, ícono giratorio y el texto', () => {
      expect(region().classList).toContain('loading-inline');
      expect(region().getAttribute('role')).toBe('status');
      expect(region().getAttribute('aria-live')).toBe('polite');
      expect(region().querySelector(':scope > i.ph.ph-spinner-gap.spin[aria-hidden="true"]')).not.toBeNull();
      expect(region().querySelector(':scope > span')!.textContent).toBe('Cargando la ficha…');
      expect(bloque().querySelector('.load-state')).toBeNull();
      expect(bloque().querySelector('app-loading')).toBeNull();
    });

    it('el host no lleva rol ni las clases de estado, y conserva las que le pone la página', () => {
      expect(bloque().hasAttribute('role')).toBeFalse();
      expect(bloque().hasAttribute('aria-live')).toBeFalse();
      expect(bloque().classList).not.toContain('loading-inline');
      expect(bloque().classList).toContain('propia');
    });
  });

  describe('de cargando a error', () => {
    it('no muta la región de carga: la quita y monta otra, nueva, con `role="alert"` y su contenido', () => {
      const deCarga = region();
      con({ tipo: 'error' });

      expect(deCarga.isConnected).toBeFalse();
      expect(region()).not.toBe(deCarga);
      expect(region().getAttribute('role')).toBe('alert');
      expect(bloque().querySelectorAll('[role]').length).toBe(1);
      expect(bloque().hasAttribute('role')).toBeFalse();
      expect(bloque().classList).not.toContain('load-state');
    });
  });

  describe('error', () => {
    beforeEach(() => con({ tipo: 'error' }));

    it('un `.load-state` con `role="alert"`: ícono de nube, título y texto', () => {
      expect(region().classList).toContain('load-state');
      expect(region().getAttribute('role')).toBe('alert');
      expect(region().getAttribute('aria-live')).toBeNull();
      expect(bloque().querySelector('.loading-inline')).toBeNull();
      expect(region().querySelector(':scope > .load-state__icono[aria-hidden="true"] > i.ph.ph-cloud-slash')).not.toBeNull();
      expect(region().querySelector(':scope > h2.load-state__titulo')!.textContent).toBe('No pudimos cargar la ficha');
      expect(Array.from(region().querySelectorAll(':scope > p.load-state__texto')).map((p) => p.textContent))
        .toEqual(['Revisá tu conexión e intentá de nuevo.']);
    });

    it('ofrece "Reintentar" (primario) y la salida (secundario), en ese orden', () => {
      expect(textos()).toEqual(['Reintentar', 'Ir al listado']);
      expect(botones()[0].hasAttribute('mat-flat-button')).toBeTrue();
      expect(botones()[0].querySelector('i.ph-arrow-clockwise')).not.toBeNull();
      expect(botones()[1].hasAttribute('mat-stroked-button')).toBeTrue();
      expect(botones()[1].querySelector('i.ph-list-dashes')).not.toBeNull();
      expect(botones().every((b) => b.type === 'button')).toBeTrue();
      expect(region().querySelector(':scope > .load-state__acciones')).not.toBeNull();
    });

    it('cada botón avisa a la página', () => {
      botones()[0].click();
      botones()[1].click();
      botones()[1].click();

      expect(host.reintentos).toBe(1);
      expect(host.salidas).toBe(2);
    });

    it('sin texto de salida solo queda "Reintentar"', () => {
      con({ volverTexto: '' });
      expect(textos()).toEqual(['Reintentar']);
    });

    it('el texto de la salida lo decide la página', () => {
      con({ volverTexto: 'Ir a Trámites del organismo' });
      expect(textos()).toEqual(['Reintentar', 'Ir a Trámites del organismo']);
    });

    it('un segundo párrafo opcional va debajo del primero', () => {
      con({ textoExtra: 'Reintentá o volvé a la lista; no se modificó nada.' });
      expect(Array.from(bloque().querySelectorAll('p.load-state__texto')).map((p) => p.textContent))
        .toEqual(['Revisá tu conexión e intentá de nuevo.', 'Reintentá o volvé a la lista; no se modificó nada.']);
    });

    it('si la entidad no existe: ícono de archivo y sin "Reintentar"', () => {
      con({ noExiste: true });

      expect(region().getAttribute('role')).toBe('alert');
      expect(bloque().querySelector('.load-state__icono i.ph-file-x')).not.toBeNull();
      expect(bloque().querySelector('.load-state__icono i.ph-cloud-slash')).toBeNull();
      expect(textos()).toEqual(['Ir al listado']);
    });
  });
});
