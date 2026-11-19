import { Component, Directive, EventEmitter, Input, Output, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';
import { FichaDetailComponent } from './ficha-detail.component';

/** Reemplaza al panel real (trae su propio facade): solo importa dónde se dibuja y con qué inputs. */
@Component({ selector: 'app-puntos-atencion-panel', standalone: true, template: '<p class="puntos-stub">puntos</p>' })
class PuntosPanelStub {
  @Input() fichaId = '';
  @Input() cabecera = false;
  @Input() tituloId = '';
  @Input() enfocarTitulo = false;
  @Output() tituloEnfocado = new EventEmitter<void>();
}

let SIMULADA = false;
/** Lo que devuelve `FichasLocalesFacade.urlPublica` en el test en curso (`null` = la fuente no tiene). */
let URL_PUBLICA: string | null = null;

/** Gating por permiso: dibuja solo si el permiso está en `PERMISOS`. */
let PERMISOS: string[] = [];
@Directive({ selector: '[appHasPermission]', standalone: true })
class HasPermissionStub {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vc = inject(ViewContainerRef);
  @Input() set appHasPermission(valor: string | string[]) {
    const lista = Array.isArray(valor) ? valor : [valor];
    this.vc.clear();
    if (lista.some((p) => PERMISOS.includes(p))) this.vc.createEmbeddedView(this.tpl);
  }
}

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'obtener-licencia-posadas', estado: 'BORRADOR', activa: true, version: 3,
  adopcionId: 'a-1', localidadId: 'l-1', url: 'https://licencias.posadas.gob.ar',
  requisitos: 'DNI vigente', costos: 'Gratis',
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

describe('FichaDetailComponent', () => {
  beforeEach(() => { URL_PUBLICA = null; });

  let fixture: ComponentFixture<FichaDetailComponent>;
  let fragment$: BehaviorSubject<string | null>;
  let facade: jasmine.SpyObj<FichasLocalesFacade>;

  const el = (): HTMLElement => fixture.nativeElement;

  async function crear(ficha: FichaLocalVM | Error, permisos = ['UPDATE_VARIANT', 'READ_ADOPTION', 'READ_ATTENTION_POINT'], fragmento: string | null = null): Promise<void> {
    PERMISOS = permisos;
    fragment$ = new BehaviorSubject<string | null>(fragmento);
    facade = jasmine.createSpyObj<FichasLocalesFacade>('FichasLocalesFacade', ['getDetalle', 'urlPublica', 'ejecutar', 'desactivar']);
    facade.getDetalle.and.returnValue(ficha instanceof Error ? throwError(() => ficha) : of(ficha));
    facade.urlPublica.and.returnValue(URL_PUBLICA);
    Object.assign(facade, { accionesWorkflow$: of(() => []), fuenteSimulada: SIMULADA });

    await TestBed.configureTestingModule({
      imports: [FichaDetailComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: FichasLocalesFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'f-1' })), fragment: fragment$ } },
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['open']) },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']) },
      ],
    })
      .overrideComponent(FichaDetailComponent, {
        remove: { imports: [PuntosAtencionPanelComponent, HasPermissionDirective] },
        add: { imports: [PuntosPanelStub, HasPermissionStub] },
      })
      .compileComponents();

    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(FichaDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('ficha cargada', () => {
    beforeEach(() => crear(FICHA));

    it('usa el lenguaje del formulario: membrete de ficha y tarjeta de dos paneles en modo lectura, sin las cards viejas', () => {
      expect(el().querySelector('header.detail-header--flush.detail-header--ficha')).not.toBeNull();
      expect(el().querySelector('.ficha-paneles.ficha-paneles--lectura')).not.toBeNull();
      expect(el().querySelectorAll('.ficha-paneles__panel').length).toBe(2);
      expect(el().querySelector('.detail-card')).toBeNull();
      expect(el().querySelector('app-form-actions')).toBeNull();
    });

    it('el membrete trae el trámite, el slug, la localidad, el organismo y la versión', () => {
      const membrete = el().querySelector('header.detail-header')!.textContent!;
      for (const texto of ['Obtener la licencia de conducir', 'obtener-licencia-posadas', 'Posadas', 'Municipalidad de Posadas', 'Versión 3']) {
        expect(membrete).toContain(texto);
      }
    });

    it('"Desactivar" va al membrete (con UPDATE_VARIANT) y lleva al enlace de la adopción', () => {
      const acciones = el().querySelector('.detail-header__actions')!;
      expect(acciones.textContent).toContain('Desactivar');
      expect(acciones.querySelector('a.detail-link')!.getAttribute('href')).toBe('/dashboard/tramites/adopciones/detalle/a-1');
    });

    it('los datos se muestran como el formulario los pide: localidad, URL, slug, requisitos y costos', () => {
      const panel = el().querySelector('.ficha-paneles__panel')!.textContent!;
      for (const texto of ['Localidad', 'https://licencias.posadas.gob.ar', 'obtener-licencia-posadas', 'DNI vigente', 'Gratis']) {
        expect(panel).toContain(texto);
      }
    });

    it('los puntos de atención son un panel de primer nivel con cabecera propia y sin foco forzado', () => {
      const lateral = el().querySelector('.ficha-paneles__panel--lateral')!;
      expect(lateral.id).toBe('puntos-atencion');
      expect(lateral.getAttribute('aria-labelledby')).toBe('fichadet-puntos');
      const panel = lateral.querySelector('app-puntos-atencion-panel')!;
      expect(panel).not.toBeNull();
    });

    it('una ficha borrador no ofrece vista previa pública', () => {
      expect(el().textContent).not.toContain('Vista previa pública');
    });
  });

  describe('con #puntos-atencion', () => {
    it('le pide al panel de puntos que lleve el foco a su título', async () => {
      await crear(FICHA, undefined, 'puntos-atencion');
      const stub = fixture.debugElement.query((d) => d.name === 'app-puntos-atencion-panel').componentInstance as PuntosPanelStub;
      expect(stub.cabecera).toBeTrue();
      expect(stub.tituloId).toBe('fichadet-puntos');
      expect(stub.enfocarTitulo).toBeTrue();
    });

    it('sin fragmento no pide foco', async () => {
      await crear(FICHA);
      const stub = fixture.debugElement.query((d) => d.name === 'app-puntos-atencion-panel').componentInstance as PuntosPanelStub;
      expect(stub.enfocarTitulo).toBeFalse();
    });
  });

  describe('foco por fragmento: una sola vez por navegación', () => {
    const stub = (): PuntosPanelStub =>
      fixture.debugElement.query((d) => d.name === 'app-puntos-atencion-panel').componentInstance as PuntosPanelStub;

    it('se apaga cuando el panel avisa que ya enfocó, y un panel recreado no lo recibe de nuevo', async () => {
      await crear(FICHA, undefined, 'puntos-atencion');
      expect(stub().enfocarTitulo).toBeTrue();

      stub().tituloEnfocado.emit();
      fixture.detectChanges();
      expect(stub().enfocarTitulo).toBeFalse();

      // Como tras "Desactivar" o "Reintentar": el detalle relee y el panel se crea de nuevo.
      fixture.componentInstance.reintentar();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(stub().enfocarTitulo).toBeFalse();
    });

    it('una nueva navegación al fragmento lo vuelve a prender', async () => {
      await crear(FICHA, undefined, 'puntos-atencion');
      stub().tituloEnfocado.emit();
      fixture.detectChanges();

      fragment$.next(null);
      fragment$.next('puntos-atencion');
      fixture.detectChanges();
      expect(stub().enfocarTitulo).toBeTrue();
    });
  });

  describe('fuente simulada', () => {
    it('avisa de forma persistente', async () => {
      SIMULADA = true;
      await crear(FICHA);
      SIMULADA = false;
      const aviso = el().querySelector('.form-aviso[role="note"]')!;
      expect(aviso.textContent).toContain('Datos de ejemplo');
    });

    it('con fuente real no avisa', async () => {
      await crear(FICHA);
      expect(el().querySelector('.form-aviso[role="note"]')).toBeNull();
    });
  });

  describe('permisos', () => {
    it('sin READ_ATTENTION_POINT no dibuja el panel de puntos y los datos ocupan toda la tarjeta', async () => {
      await crear(FICHA, ['UPDATE_VARIANT']);
      expect(el().querySelector('app-puntos-atencion-panel')).toBeNull();
      expect(el().querySelectorAll('.ficha-paneles__panel').length).toBe(1);
    });

    it('sin UPDATE_VARIANT no ofrece "Desactivar" y sin READ_ADOPTION no enlaza a la adopción', async () => {
      await crear(FICHA, ['READ_ATTENTION_POINT']);
      expect(el().querySelector('.detail-header__actions')!.textContent).not.toContain('Desactivar');
      expect(el().querySelector('.detail-header__actions a')).toBeNull();
    });
  });

  describe('estados particulares', () => {
    it('desactivada: lo dice en el membrete y no ofrece "Desactivar"', async () => {
      await crear({ ...FICHA, activa: false });
      expect(el().querySelector('.pill--inactive')!.textContent).toContain('Desactivada');
      expect(el().querySelector('.detail-header__notice')!.textContent).toContain('Está desactivada');
      expect(el().querySelector('.detail-header__actions')!.textContent).not.toContain('Desactivar');
    });

    it('publicada y activa: muestra la vista previa pública (sin URL de la fuente, lo aclara)', async () => {
      await crear({ ...FICHA, estado: 'PUBLICADO' });
      expect(el().textContent).toContain('Vista previa pública');
      expect(el().textContent).toContain('La vista previa todavía no está disponible');
    });

    it('publicada pero con el trámite del organismo no vigente: no ofrece el enlace y dice que no se ve en el portal (M6)', async () => {
      URL_PUBLICA = 'https://api/procedure/obtener-licencia-posadas';
      await crear({ ...FICHA, estado: 'PUBLICADO', adopcionNoVigente: 'vencida' });

      const aviso = el().querySelector('[data-aviso="vista-previa-no-vigente"]')!;
      expect(aviso.textContent).toContain('el trámite del organismo ya venció');
      expect(el().querySelector('.fichadet-publicacion a')).toBeNull();
      expect(el().querySelector('.fichadet-ayuda')!.textContent).toContain('hoy no se ve en el portal');
      expect(el().querySelector('.fichadet-ayuda')!.textContent).not.toContain('Se ve en el portal.');
    });

    it('publicada, activa y con el trámite vigente: ofrece el enlace de la fuente', async () => {
      URL_PUBLICA = 'https://api/procedure/obtener-licencia-posadas';
      await crear({ ...FICHA, estado: 'PUBLICADO', adopcionNoVigente: null });

      expect(el().querySelector<HTMLAnchorElement>('.fichadet-publicacion a')!.getAttribute('href')).toBe('https://api/procedure/obtener-licencia-posadas');
      expect(el().querySelector('[data-aviso="vista-previa-no-vigente"]')).toBeNull();
    });

    it('backend viejo, ficha sin contenido (B1): lo avisa, no muestra campos vacíos como reales ni enlaza a una adopción sin id', async () => {
      await crear({ ...FICHA, adopcionId: '', localidadId: '', url: null, requisitos: null, costos: null, localidadNombre: null, sinContenido: true });

      expect(el().querySelector('[data-aviso="sin-contenido"]')!.textContent)
        .toContain('El servidor todavía no entrega el contenido de la ficha; no se puede editar hasta que se actualice.');
      expect(el().querySelector('[data-aviso="datos-sin-contenido"]')).not.toBeNull();
      expect(el().textContent).not.toContain('Sin requisitos cargados.');
      expect(el().querySelector('.detail-header__actions')!.textContent).not.toContain('Ver trámite del organismo');
    });

    it('sin URL, requisitos ni costos cargados lo dice campo por campo (no "no disponible")', async () => {
      await crear({ ...FICHA, url: null, requisitos: null, costos: null });
      const panel = el().querySelector('.ficha-paneles__panel')!.textContent!;
      expect(panel).toContain('Sin URL');
      expect(panel).toContain('Sin requisitos cargados.');
      expect(panel).toContain('Sin costos cargados.');
      expect(panel).not.toContain('No disponible');
      expect(el().querySelector('.detail-header__notice')).toBeNull();
    });

    it('si no se pudo resolver el nombre de la localidad, solo eso figura como no disponible', async () => {
      await crear({ ...FICHA, localidadNombre: null });
      const panel = el().querySelector('.ficha-paneles__panel')!.textContent!;
      expect(panel).toContain('No disponible');
      expect(panel).toContain(FICHA.requisitos!);
    });

    it('si la ficha no existe muestra el estado "no existe" con salida al listado y sin reintentar', async () => {
      await crear(Object.assign(new Error('x'), { status: 404 }));
      const estado = el().querySelector('.load-state[role="alert"]')!;
      expect(estado).not.toBeNull();
      expect(el().querySelector('.ficha-paneles')).toBeNull();
      expect(estado.textContent).toContain('Ir al listado');
    });
  });
});
