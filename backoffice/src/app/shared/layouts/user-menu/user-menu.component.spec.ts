import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { UserMenuComponent } from './user-menu.component';

/** Ficha de la cuenta dentro del menú de perfil: el organismo como dato, no como control; el rol solo en el disparador. */
describe('UserMenuComponent — ficha de la cuenta', () => {
  let fixture: ComponentFixture<UserMenuComponent>;
  let overlay: HTMLElement;

  async function montar(organismo: string, compact = false): Promise<void> {
    await TestBed.configureTestingModule({ imports: [UserMenuComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(UserMenuComponent);
    fixture.componentRef.setInput('name', 'Ana Paz');
    fixture.componentRef.setInput('email', 'ana@misiones.gob.ar');
    fixture.componentRef.setInput('role', 'Administrador de Organismo');
    fixture.componentRef.setInput('organismo', organismo);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  }

  async function abrir(organismo: string): Promise<void> {
    await montar(organismo);
    disparador().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const disparador = (): HTMLButtonElement => fixture.nativeElement.querySelector('.user-menu__trigger');
  const datos = (): HTMLElement[] => Array.from(overlay.querySelectorAll<HTMLElement>('.user-menu__dato'));
  const menuAbierto = (): boolean => overlay.querySelector('.mat-mdc-menu-panel') !== null;

  it('el desplegable no repite el rol: solo la fila del organismo, con su rótulo', async () => {
    await abrir('Instituto de Previsión Social (IPS)');

    expect(datos().map((fila) => fila.querySelector('.user-menu__dato-label')?.textContent?.trim())).toEqual(['Organismo']);
    expect(datos()[0].querySelector('.user-menu__dato-valor')?.textContent?.trim()).toBe('Instituto de Previsión Social (IPS)');
    expect(overlay.querySelector('.user-menu__cuenta')?.textContent).not.toContain('Administrador de Organismo');
  });

  it('el rol se sigue viendo en el disparador, debajo del nombre', async () => {
    await abrir('');

    const disparador = fixture.nativeElement.querySelector('.user-menu__trigger') as HTMLElement;
    expect(disparador.querySelector('.user-menu__name')?.textContent?.trim()).toBe('Ana Paz');
    expect(disparador.querySelector('.user-menu__role')?.textContent?.trim()).toBe('Administrador de Organismo');
  });

  it('el nombre accesible del disparador lleva nombre y rol (el `aria-label` reemplaza al contenido visible)', async () => {
    await montar('');
    expect(disparador().getAttribute('aria-label')).toBe('Menú de perfil: Ana Paz, Administrador de Organismo');
  });

  it('con organismo, el nombre accesible lo suma al final', async () => {
    await montar('Instituto de Previsión Social (IPS)');
    expect(disparador().getAttribute('aria-label'))
      .toBe('Menú de perfil: Ana Paz, Administrador de Organismo, Instituto de Previsión Social (IPS)');
  });

  it('con la barra contraída (solo el avatar) muestra nombre y rol en un tooltip a la derecha, sin repetirlo como descripción', async () => {
    await montar('', true);
    disparador().dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();

    const tooltip = overlay.querySelector('.mat-mdc-tooltip');
    expect(tooltip?.textContent?.trim()).toBe('Menú de perfil: Ana Paz, Administrador de Organismo');
    expect(fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip).position).toBe('right');
    // Igual al nombre accesible: el lector no lo oye dos veces.
    expect(disparador().hasAttribute('aria-describedby')).toBeFalse();
  });

  it('con la barra expandida no hay tooltip: nombre y rol ya se ven', async () => {
    await montar('');
    disparador().dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('.mat-mdc-tooltip')).toBeNull();
  });

  it('sin organismo (sesión global) la ficha queda en avatar, nombre y email, sin filas de datos', async () => {
    await abrir('');

    expect(datos()).toEqual([]);
    expect(overlay.querySelector('.user-menu__email')?.textContent?.trim()).toBe('ana@misiones.gob.ar');
  });

  it('las filas son datos, no controles: sin rol, sin foco y sin manejador propio de click', async () => {
    await abrir('Instituto de Previsión Social (IPS)');

    datos().forEach((fila) => {
      expect(fila.hasAttribute('role')).toBeFalse();
      expect(fila.hasAttribute('tabindex')).toBeFalse();
    });
    // Ninguna fila de la ficha es un ítem del menú: el teclado salta directo a las acciones.
    expect(overlay.querySelector('.user-menu__cuenta [role^="menuitem"]')).toBeNull();
  });

  it('un click en la ficha (para seleccionar el email o el organismo) no cierra el menú; "Cerrar sesión" sí', async () => {
    await abrir('Instituto de Previsión Social (IPS)');
    const salir = jasmine.createSpy('logout');
    fixture.componentInstance.logout.subscribe(salir);

    datos()[0].click();
    (overlay.querySelector('.user-menu__email') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuAbierto()).toBeTrue();

    (overlay.querySelector('.user-menu__item--danger') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(salir).toHaveBeenCalledTimes(1);
    expect(menuAbierto()).toBeFalse();
  });
});
