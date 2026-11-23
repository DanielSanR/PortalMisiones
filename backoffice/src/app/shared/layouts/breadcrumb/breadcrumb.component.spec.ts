import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NAV_ITEMS, NavItem } from '@core/constants/role-mapping.constants';
import { BreadcrumbComponent } from './breadcrumb.component';

const ORGANISMOS: NavItem = { label: 'Organismos', icon: 'buildings', route: '/dashboard/organismos' };

describe('BreadcrumbComponent — breadcrumb del topbar', () => {
  let fixture: ComponentFixture<BreadcrumbComponent>;
  let el: HTMLElement;
  let router: Router;

  const titulo = (): string => el.querySelector('h1.admin-layout__title')?.textContent?.trim() ?? '';
  const ruta = (): HTMLElement | null => el.querySelector<HTMLElement>('nav[aria-label="Ruta de navegación"]');

  async function irA(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [
        provideRouter([
          { path: 'inicio', children: [] },
          { path: 'organismos', children: [], data: { breadcrumb: ['Organismos'] } },
          { path: 'organismos/editar', children: [], data: { breadcrumb: ['Organismos', 'Editar'] } },
          { path: 'fuera-del-nav', children: [], data: { breadcrumb: ['Sección inexistente', 'Detalle'] } },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(BreadcrumbComponent);
    fixture.componentRef.setInput('secciones', [ORGANISMOS]);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('sin breadcrumb declarado (Home) el título es "Inicio" y no hay ruta de navegación', async () => {
    await irA('/inicio');

    expect(titulo()).toBe('Inicio');
    expect(ruta()).toBeNull();
    const iconoDeInicio = NAV_ITEMS.find((item) => item.label === 'Inicio')?.icon ?? 'file-text';
    expect(el.querySelector('.admin-layout__title-icon')?.classList).toContain(`ph-${iconoDeInicio}`);
  });

  it('con un solo tramo, ese tramo es el h1 y no se dibuja la ruta', async () => {
    await irA('/organismos');

    expect(titulo()).toBe('Organismos');
    expect(ruta()).toBeNull();
  });

  it('el último tramo es el h1 y los previos enlazan a la lista de su sección', async () => {
    await irA('/organismos/editar');

    expect(titulo()).toBe('Editar');
    const link = ruta()?.querySelector<HTMLAnchorElement>('a.admin-layout__breadcrumb-link');
    expect(link?.textContent?.trim()).toBe('Organismos');
    expect(link?.getAttribute('href')).toBe('/dashboard/organismos');
  });

  it('un tramo de una sección que el usuario no ve queda como texto, sin link', async () => {
    await irA('/organismos/editar');

    fixture.componentRef.setInput('secciones', []);
    fixture.detectChanges();

    expect(ruta()?.querySelector('a')).toBeNull();
    expect(ruta()?.querySelector('.admin-layout__breadcrumb-crumb')?.textContent?.trim()).toBe('Organismos');
  });

  it('una sección que no está en el nav usa el ícono genérico', async () => {
    await irA('/fuera-del-nav');

    expect(el.querySelector('.admin-layout__title-icon')?.classList).toContain('ph-file-text');
  });
});
