import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';
import { UserMenuComponent } from './user-menu.component';

/** Ficha de la cuenta dentro del menú de perfil: rol y organismo como datos, no como controles. */
describe('UserMenuComponent — ficha de la cuenta', () => {
  let fixture: ComponentFixture<UserMenuComponent>;
  let overlay: HTMLElement;

  async function abrir(organismo: string): Promise<void> {
    await TestBed.configureTestingModule({ imports: [UserMenuComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(UserMenuComponent);
    fixture.componentRef.setInput('name', 'Ana Paz');
    fixture.componentRef.setInput('email', 'ana@misiones.gob.ar');
    fixture.componentRef.setInput('role', 'Administrador de Organismo');
    fixture.componentRef.setInput('organismo', organismo);
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();

    (fixture.nativeElement.querySelector('.user-menu__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const datos = (): HTMLElement[] => Array.from(overlay.querySelectorAll<HTMLElement>('.user-menu__dato'));
  const menuAbierto = (): boolean => overlay.querySelector('.mat-mdc-menu-panel') !== null;

  it('rol y organismo comparten el mismo elemento neutro (`user-menu__dato`), cada uno con su rótulo', async () => {
    await abrir('Instituto de Previsión Social (IPS)');

    expect(datos().map((fila) => fila.querySelector('.user-menu__dato-label')?.textContent?.trim())).toEqual(['Rol', 'Organismo']);
    expect(datos()[0].querySelector('.user-menu__dato-badge')?.textContent).toContain('Administrador de Organismo');
    expect(datos()[1].querySelector('.user-menu__dato-valor')?.textContent?.trim()).toBe('Instituto de Previsión Social (IPS)');
    // La fila de organismo ya no se disfraza de "rol".
    expect(overlay.querySelector('[class*="user-menu__rol"]')).toBeNull();
  });

  it('sin organismo (sesión global) solo queda la fila del rol', async () => {
    await abrir('');

    expect(datos().map((fila) => fila.querySelector('.user-menu__dato-label')?.textContent?.trim())).toEqual(['Rol']);
    expect(overlay.querySelector('.user-menu__dato-valor')).toBeNull();
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

    datos()[1].click();
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
