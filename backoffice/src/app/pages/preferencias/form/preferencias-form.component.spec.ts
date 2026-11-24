import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';
import { PREFERENCIAS_DE_FABRICA, Preferencias } from '@core/models/preferencias.model';
import { CuentaFacade } from '@features/cuenta';
import { PreferenciasFormComponent } from './preferencias-form.component';

type FacadeFalso = Pick<
  CuentaFacade,
  | 'preferencias$'
  | 'preferenciasDeFabrica$'
  | 'correoRecordado$'
  | 'atajosHabilitados$'
  | 'actualizarPreferencias'
  | 'restablecerPreferencias'
  | 'setAtajosHabilitados'
  | 'olvidarCorreo'
>;

// La app corre con `LOCALE_ID` es-AR (`app.config.ts`): "Idioma y formato" lo muestra.
registerLocaleData(localeEsAr, 'es-AR');

describe('PreferenciasFormComponent', () => {
  let fixture: ComponentFixture<PreferenciasFormComponent>;
  let preferencias$: BehaviorSubject<Preferencias>;
  let deFabrica$: BehaviorSubject<boolean>;
  let correo$: BehaviorSubject<string>;
  let atajos$: BehaviorSubject<boolean>;
  let facade: jasmine.SpyObj<FacadeFalso>;

  async function montar(opciones: { prefs?: Partial<Preferencias>; deFabrica?: boolean; correo?: string } = {}): Promise<void> {
    preferencias$ = new BehaviorSubject<Preferencias>({ ...PREFERENCIAS_DE_FABRICA, ...opciones.prefs });
    deFabrica$ = new BehaviorSubject<boolean>(opciones.deFabrica ?? false);
    correo$ = new BehaviorSubject<string>(opciones.correo ?? '');
    atajos$ = new BehaviorSubject<boolean>(true);
    facade = jasmine.createSpyObj<FacadeFalso>(
      'CuentaFacade',
      ['actualizarPreferencias', 'restablecerPreferencias', 'setAtajosHabilitados', 'olvidarCorreo'],
      {
        preferencias$: preferencias$.asObservable(),
        preferenciasDeFabrica$: deFabrica$.asObservable(),
        correoRecordado$: correo$.asObservable(),
        atajosHabilitados$: atajos$.asObservable(),
      },
    );
    // El facade real aplica al momento: el falso también, para ver la pantalla seguir al estado.
    facade.actualizarPreferencias.and.callFake((cambios) => preferencias$.next({ ...preferencias$.value, ...cambios }));
    facade.setAtajosHabilitados.and.callFake((valor) => atajos$.next(valor));
    facade.olvidarCorreo.and.callFake(() => correo$.next(''));

    await TestBed.configureTestingModule({
      imports: [PreferenciasFormComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: LOCALE_ID, useValue: 'es-AR' },
        { provide: CuentaFacade, useValue: facade },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PreferenciasFormComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null => el().querySelector<T>(selector);
  const texto = (selector: string): string => $(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const botonConTexto = (t: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim().includes(t));
  const radioConTexto = (t: string): HTMLInputElement | null => {
    const radio = Array.from(el().querySelectorAll('mat-radio-button')).find((r) => r.textContent?.includes(t));
    return radio?.querySelector<HTMLInputElement>('input[type="radio"]') ?? null;
  };
  const clic = (elemento: HTMLElement | null | undefined): void => {
    elemento?.click();
    fixture.detectChanges();
  };

  it('"Listas y tablas" avisa que Roles y Categorías no se paginan', async () => {
    await montar();

    const subtitulo = el().querySelector('#preferencias-listas')!.parentElement!.querySelector('.ficha-paneles__subtitulo');
    expect(subtitulo!.textContent!.trim())
      .toBe('Valen para las listas del backoffice. Roles y Categorías muestran todo junto, sin páginas.');
  });

  it('elegir 20 filas llama actualizar({ filasPorPagina: 20 })', async () => {
    await montar();
    const grupo = $('mat-button-toggle-group');
    expect(grupo?.getAttribute('aria-label')).toBe('Filas por página');

    clic(botonConTexto('20'));

    expect(facade.actualizarPreferencias).toHaveBeenCalledOnceWith({ filasPorPagina: 20 });
    expect(texto('[data-testid="preferencias-rango"]')).toBe('1–20 de 68');
  });

  it('elegir Compacta llama actualizar({ densidad: "compacta" }) y la vista previa usa filas de 44 px', async () => {
    await montar();
    const fila = (): HTMLElement | null => $('.preferencias__previa-fila');
    expect(fila()?.getBoundingClientRect().height).toBe(56);

    clic(radioConTexto('Compacta'));

    expect(facade.actualizarPreferencias).toHaveBeenCalledOnceWith({ densidad: 'compacta' });
    expect(fila()?.getBoundingClientRect().height).toBe(44);
    expect($('.preferencias__previa')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('elegir "Hasta que lo cierre" llama actualizar({ avisos: "fijo" })', async () => {
    await montar();
    clic(radioConTexto('Hasta que lo cierre'));
    expect(facade.actualizarPreferencias).toHaveBeenCalledOnceWith({ avisos: 'fijo' });
  });

  it('la ayuda de cada opción queda visible dentro de su etiqueta, sin aria-describedby en el mat-radio-button', async () => {
    await montar();
    const radio = Array.from(el().querySelectorAll('mat-radio-button')).find((r) => r.textContent?.includes('Hasta que lo cierre'));
    const etiqueta = radio?.querySelector('label');

    expect(etiqueta?.textContent).toContain('Quedan en pantalla hasta que los cerrás con su botón.');
    expect(el().querySelectorAll('mat-radio-button[aria-describedby]').length).toBe(0);
  });

  it('el interruptor de atajos llama setHabilitados(false) y atenúa la tabla de atajos', async () => {
    await montar();
    const tabla = (): HTMLElement | null => $('.preferencias__atajos');
    expect(tabla()?.classList).not.toContain('preferencias__atajos--apagados');
    expect(texto('#preferencias-atajos-ayuda')).toContain('Activados.');

    clic($('[data-testid="preferencias-atajos"] button[role="switch"]'));

    expect(facade.setAtajosHabilitados).toHaveBeenCalledOnceWith(false);
    expect(tabla()?.classList).toContain('preferencias__atajos--apagados');
    expect(texto('#preferencias-atajos-ayuda')).toBe('Desactivados: las teclas de la lista no hacen nada.');
  });

  it('"Recordar si el menú está contraído" llama actualizar({ recordarMenuContraido: true })', async () => {
    await montar();
    expect(texto('#preferencias-menu-ayuda')).toBe('Apagado: el menú se abre siempre al entrar.');

    clic($('[data-testid="preferencias-menu"] button[role="switch"]'));

    expect(facade.actualizarPreferencias).toHaveBeenCalledOnceWith({ recordarMenuContraido: true });
    expect(texto('#preferencias-menu-ayuda')).toBe('Si lo contraés, sigue contraído al recargar o volver a entrar.');
  });

  it('con valores de fábrica "Restablecer preferencias" tiene aria-disabled="true" y no llama restablecer', async () => {
    await montar({ deFabrica: true });
    const boton = botonConTexto('Restablecer preferencias');
    expect(boton?.getAttribute('aria-disabled')).toBe('true');
    expect(texto('#preferencias-restablecer-nota')).toBe('Estás usando los valores de fábrica.');

    clic(boton);

    expect(facade.restablecerPreferencias).not.toHaveBeenCalled();
  });

  it('con algo cambiado "Restablecer preferencias" llama restablecer', async () => {
    await montar({ prefs: { avisos: 'largo' } });
    const boton = botonConTexto('Restablecer preferencias');
    expect(boton?.getAttribute('aria-disabled')).toBeNull();
    expect(texto('#preferencias-restablecer-nota')).toBe('Vuelve todo a como venía. El correo recordado no se toca.');

    clic(boton);

    expect(facade.restablecerPreferencias).toHaveBeenCalledTimes(1);
  });

  it('"Olvidar" llama olvidarCorreo y el texto pasa a "No hay ningún correo guardado"', async () => {
    await montar({ correo: 'ana@misiones.gob.ar' });
    expect(texto('[data-testid="preferencias-correo"]')).toContain('ana@misiones.gob.ar · lo guardó "Recordarme" en el login');

    clic(botonConTexto('Olvidar'));

    expect(facade.olvidarCorreo).toHaveBeenCalledTimes(1);
    expect(texto('[data-testid="preferencias-correo"]')).toContain('No hay ningún correo guardado');
    // El botón que tenía el foco desaparece: el foco pasa al bloque con el texto nuevo, no cae a <body>.
    expect(document.activeElement).toBe($('[data-testid="preferencias-correo"]'));
  });

  it('sin correo recordado no se muestra "Olvidar"', async () => {
    await montar();
    expect(botonConTexto('Olvidar')).toBeUndefined();
    expect(texto('[data-testid="preferencias-correo"]')).toContain('El login va a aparecer vacío. Nunca se guarda la contraseña.');
  });

  it('Idioma y formato muestra la fecha de hoy en DD/MM/YYYY y los números con formato es-AR', async () => {
    await montar();
    const hoy = new Date();
    const dosDigitos = (n: number): string => String(n).padStart(2, '0');
    const fecha = `${dosDigitos(hoy.getDate())}/${dosDigitos(hoy.getMonth() + 1)}/${hoy.getFullYear()}`;
    const formato = texto('[data-testid="preferencias-formato"]');
    expect(formato).toContain('Español (Argentina)');
    expect(formato).toContain(fecha);
    expect(formato).toContain('1.284,50');
  });
});
