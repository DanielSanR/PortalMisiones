import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FichaLocalVM, FichasDeAdopcion, FichasLocalesFacade } from '@features/fichas-locales';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { FichasDeAdopcionComponent } from './fichas-de-adopcion.component';

/** Gating por permiso: siempre dibuja. */
@Directive({ selector: '[appHasPermission]', standalone: true })
class HasPermissionStub {
  @Input() appHasPermission: unknown;
  constructor() {
    inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef<unknown>));
  }
}

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'obtener-licencia-posadas', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: null, requisitos: null, costos: null,
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

describe('FichasDeAdopcionComponent', () => {
  let fixture: ComponentFixture<FichasDeAdopcionComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function crear(resultado: FichasDeAdopcion): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [FichasDeAdopcionComponent],
      providers: [
        provideRouter([]),
        { provide: FichasLocalesFacade, useValue: { fuenteSimulada: false, getDeAdopcion: () => of(resultado) } },
      ],
    })
      .overrideComponent(FichasDeAdopcionComponent, {
        remove: { imports: [HasPermissionDirective] },
        add: { imports: [HasPermissionStub] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(FichasDeAdopcionComponent);
    fixture.componentRef.setInput('adopcionId', 'a-1');
    fixture.detectChanges();
  }

  it('lista las fichas de la adopción', async () => {
    await crear({ fichas: [FICHA], motivoNoVigente: null, sinContenido: false });
    expect(el().querySelectorAll('.fichasadop-item').length).toBe(1);
    expect(el().querySelector('[data-aviso="sin-contenido"]')).toBeNull();
  });

  it('sin fichas (y con el servidor al día) el vacío es real', async () => {
    await crear({ fichas: [], motivoNoVigente: null, sinContenido: false });
    expect(el().textContent).toContain('Todavía no se ofrece en ninguna localidad');
  });

  it('backend viejo (fichas sin su adopción): lo avisa en vez de afirmar que no se ofrece en ninguna localidad', async () => {
    await crear({ fichas: [], motivoNoVigente: null, sinContenido: true });
    expect(el().querySelector('[data-aviso="sin-contenido"]')!.textContent).toContain('El servidor todavía no dice a qué trámite del organismo pertenece cada ficha');
    expect(el().textContent).not.toContain('Todavía no se ofrece en ninguna localidad');
  });
});
