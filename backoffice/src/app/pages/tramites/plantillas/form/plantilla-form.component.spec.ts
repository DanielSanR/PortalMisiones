import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { EMPTY, Observable, Subject, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { TEXTOS_DE_ERROR_HTTP } from '@core/utils/http-error-text.utils';
import { PlantillaCatalogos, PlantillaFormData, PlantillaFormValue, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { PlantillaFormComponent } from './plantilla-form.component';

/*
 * Specs de CARACTERIZACIÓN: fijan lo que se ve y el contrato con el facade. Se escribieron sobre el formulario
 * a mano y se conservaron al pasarlo a `app-dynamic-form` (campos y paneles en `plantilla-campos.ts`). Todo lo
 * que depende del markup está en los helpers de "Selectores y gestos" (más abajo).
 */

// ───────────────────────────── Datos de prueba ─────────────────────────────

const CATALOGOS: PlantillaCatalogos = {
  modalidades: [{ id: 'm-1', nombre: 'Presencial' }, { id: 'm-2', nombre: 'En línea' }],
  categorias: [{ id: 'c-1', nombre: 'Salud' }, { id: 'c-2', nombre: 'Educación' }, { id: 'c-3', nombre: 'Transporte' }],
  etiquetas: [{ id: 'e-1', nombre: 'Gratuito' }, { id: 'e-2', nombre: 'Con turno' }],
  destinatarios: [{ id: 'd-1', nombre: 'Jóvenes' }, { id: 'd-2', nombre: 'Adultos mayores' }],
  eventosDeVida: [{ id: 'v-1', nombre: 'Nacimiento' }, { id: 'v-2', nombre: 'Mudanza' }],
  noDisponibles: [],
};

/** Plantilla completa: todos los datos recomendados cargados. */
const PLANTILLA: PlantillaVM = {
  id: 'p-1',
  titulo: 'Obtener la licencia de conducir',
  slug: 'obtener-licencia',
  resumen: 'Para manejar.',
  descripcionLarga: 'Texto largo',
  modalidad: { id: 'm-1', nombre: 'Presencial' },
  categoriaPrincipal: { id: 'c-1', nombre: 'Salud' },
  categorias: [{ id: 'c-1', nombre: 'Salud' }, { id: 'c-2', nombre: 'Educación' }],
  etiquetas: [{ id: 'e-1', nombre: 'Gratuito' }],
  destinatarios: [{ id: 'd-2', nombre: 'Adultos mayores' }],
  eventosDeVida: [],
  activa: true,
};

/** Lo que el form de PLANTILLA manda al guardar sin tocar nada más que lo que cada test cambia. */
const VALOR_DE_PLANTILLA: PlantillaFormValue = {
  titulo: 'Obtener la licencia de conducir',
  slug: 'obtener-licencia',
  resumen: 'Para manejar.',
  descripcionLarga: 'Texto largo',
  modalidadId: 'm-1',
  categoriaPrincipalId: 'c-1',
  categoriaIds: ['c-1', 'c-2'],
  etiquetaIds: ['e-1'],
  destinatarioIds: ['d-2'],
  eventoDeVidaIds: [],
  activa: true,
};

/** Lo que responde el facade al guardar (otro id, para distinguir a dónde se navega). */
const GUARDADA: PlantillaVM = { ...PLANTILLA, id: 'p-9' };

const RUTA_LISTA = '/dashboard/tramites/plantillas';
const RUTA_DETALLE = '/dashboard/tramites/plantillas/detalle';

const MENSAJE_CRUDO = 'MENSAJE CRUDO DEL BACKEND';
const errorHttp = (status: number, code?: number): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: code === undefined ? { message: MENSAJE_CRUDO } : { code, message: MENSAJE_CRUDO } });

describe('PlantillaFormComponent', () => {
  let fixture: ComponentFixture<PlantillaFormComponent>;
  let facade: jasmine.SpyObj<PlantillasFacade>;
  let navigate: jasmine.Spy;
  let snack: jasmine.Spy;

  // ───────────────────────────── Selectores y gestos ─────────────────────────────

  const el = (): HTMLElement => fixture.nativeElement;
  const limpio = (nodo: Element | null | undefined): string => (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** Texto visible de toda la pantalla. */
  const pantalla = (): string => limpio(el());

  /** Deja pasar las promesas del componente (carga, guardado, navegación) y refresca la vista. */
  async function asentar(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  /** Un campo por su id (`#titulo`, `#slug`, `#resumen`, `#descripcion`, `#modalidad`, `#principal`). */
  const campo = <T extends HTMLElement = HTMLElement>(id: string): T => el().querySelector<T>(`#${id}`)!;
  /** Valor visible: el `value` de un input/textarea o el texto elegido de un select. */
  const valorDe = (id: string): string => {
    const nodo = campo(id);
    return nodo instanceof HTMLInputElement || nodo instanceof HTMLTextAreaElement ? nodo.value : limpio(nodo);
  };
  /** El envoltorio del campo (Material): de ahí salen su error y su ayuda. */
  const envoltorio = (id: string): Element | null => campo(id).closest('mat-form-field');
  const errorDe = (id: string): string => limpio(envoltorio(id)?.querySelector('mat-error'));
  const ayudaDe = (id: string): string =>
    Array.from(envoltorio(id)?.querySelectorAll('mat-hint') ?? []).map(limpio).join(' | ');

  function escribir(id: string, texto: string): void {
    const input = campo<HTMLInputElement | HTMLTextAreaElement>(id);
    input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  function salirDe(id: string): void {
    campo(id).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  /** ¿El select está bloqueado? (lo que anuncia el lector de pantalla). */
  const bloqueado = (id: string): boolean => campo(id).getAttribute('aria-disabled') === 'true';
  /** Opciones del panel abierto de un select de Material (vive en el overlay, fuera del fixture). */
  const opcionesAbiertas = (): HTMLElement[] => {
    const paneles = document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role="listbox"]');
    return Array.from(paneles[paneles.length - 1]?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  };
  async function abrirSelect(id: string): Promise<void> {
    (campo(id).querySelector<HTMLElement>('.mat-mdc-select-trigger') ?? campo(id)).click();
    await asentar();
  }
  /** Abre el select, lee sus opciones y lo cierra sin elegir. */
  async function opcionesDe(id: string): Promise<string[]> {
    await abrirSelect(id);
    const textos = opcionesAbiertas().map(limpio);
    const fondos = document.querySelectorAll<HTMLElement>('.cdk-overlay-backdrop');
    fondos[fondos.length - 1]?.click();
    await asentar();
    return textos;
  }
  async function elegir(id: string, opcion: string): Promise<void> {
    await abrirSelect(id);
    opcionesAbiertas().find((o) => limpio(o) === opcion)!.click();
    await asentar();
  }

  /** Interruptor por su etiqueta ("Activa"). */
  const interruptor = (nombre: string): HTMLElement =>
    Array.from(el().querySelectorAll<HTMLElement>('[role="switch"]'))
      .find((s) => limpio(s.closest('mat-slide-toggle')).includes(nombre))!;
  const encendido = (nombre: string): boolean => interruptor(nombre).getAttribute('aria-checked') === 'true';
  function alternarInterruptor(nombre: string): void {
    interruptor(nombre).click();
    fixture.detectChanges();
  }

  /** Grupo de selección múltiple por su nombre accesible ("Categorías", "Etiquetas", …). */
  const grupo = (nombre: string): HTMLElement =>
    Array.from(el().querySelectorAll<HTMLElement>('[role="group"][aria-labelledby]'))
      .find((g) => limpio(document.getElementById(g.getAttribute('aria-labelledby')!)) === nombre)!;
  /** "2 de 18". */
  const contadorDe = (nombre: string): string => /\d+ de \d+/.exec(limpio(grupo(nombre)))?.[0] ?? '';
  /** El botón que abre / cierra la lista del grupo ("Elegir", "Cambiar", "Listo"). */
  const botonDeGrupo = (nombre: string): HTMLButtonElement => grupo(nombre).querySelector<HTMLButtonElement>('button[aria-expanded]')!;
  const grupoAbierto = (nombre: string): boolean => botonDeGrupo(nombre).getAttribute('aria-expanded') === 'true';
  function alternarGrupo(nombre: string): void {
    botonDeGrupo(nombre).click();
    fixture.detectChanges();
  }
  /** Casillas de la lista abierta de un grupo. */
  const casillasDe = (nombre: string): { texto: string; input: HTMLInputElement }[] =>
    Array.from(grupo(nombre).querySelectorAll('mat-checkbox'))
      .map((c) => ({ texto: limpio(c), input: c.querySelector<HTMLInputElement>('input[type="checkbox"]')! }));
  /** Marca o desmarca una opción (abre el grupo si hace falta). */
  function marcar(nombre: string, opcion: string): void {
    if (!grupoAbierto(nombre)) alternarGrupo(nombre);
    casillasDe(nombre).find((c) => c.texto === opcion)!.input.click();
    fixture.detectChanges();
    fixture.detectChanges();
  }
  /** Lo elegido en un grupo, como chips (cada chip es su botón "Quitar <opción>"). */
  const chipsDe = (nombre: string): string[] =>
    Array.from(grupo(nombre).querySelectorAll<HTMLElement>('button[aria-label^="Quitar "]'))
      .map((b) => b.getAttribute('aria-label')!.replace('Quitar ', ''));
  function quitarChip(nombre: string, opcion: string): void {
    grupo(nombre).querySelector<HTMLElement>(`button[aria-label="Quitar ${opcion}"]`)!.click();
    fixture.detectChanges();
    fixture.detectChanges();
  }
  /** "N opciones elegidas" de Clasificación. */
  const totalElegidas = (): string => /\d+ opci(?:ón|ones) elegidas?/.exec(pantalla())?.[0] ?? '';

  /** Membrete en vivo (título, slug, estado, modalidad, principal y "Nueva" / "Editando"). */
  const membrete = (): string => limpio(el().querySelector('app-membrete'));

  // Pie del formulario
  const submit = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const botonesDeEnvio = (): number => el().querySelectorAll('.form-actions__submit button, button[type="submit"]').length;
  const boton = (texto: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => limpio(b) === texto)!;
  /** "Desde el título": el motor lo ofrece solo cuando hay algo distinto para derivar (`derivado.accion`). */
  const desdeElTitulo = (): HTMLButtonElement | undefined => boton('Desde el título');
  /** ¿"Guardar" está no disponible (enfocable, con motivo)? */
  const noDisponible = (): boolean => submit().getAttribute('aria-disabled') === 'true';
  /** El motivo que muestra el botón de envío no disponible (tooltip de `appUnavailable`). */
  const motivoDeNoDisponible = (): string =>
    fixture.debugElement.query(By.css('button[type="submit"]')).injector.get(MatTooltip).message;
  /** Indicador de "datos recomendados" del pie. */
  const recomendado = (): string => limpio(el().querySelector('.form-actions__info'));
  const ayudaDelPie = (): string => limpio(el().querySelector('.form-actions__help'));
  async function enviar(): Promise<void> {
    submit().click();
    await asentar();
  }

  /** Banners de error que se ven (resumen de validación y "No se pudo guardar"). */
  const banners = (): { rol: string | null; titulo: string; detalle: string }[] =>
    Array.from(el().querySelectorAll('.form-error-banner')).map((b) => ({
      rol: b.getAttribute('role'),
      titulo: limpio(b.querySelector('.form-error-banner__title')),
      detalle: limpio(b.querySelector('.form-error-banner__detail')),
    }));
  const banner = (): { rol: string | null; titulo: string; detalle: string } | undefined => banners()[0];

  // Estado de carga (cargando / error / no existe)
  const estadoCarga = (): HTMLElement | null => el().querySelector('app-estado-carga');
  const botonesDeCarga = (): string[] => Array.from(estadoCarga()?.querySelectorAll('button') ?? []).map(limpio);
  const formulario = (): HTMLFormElement | null => el().querySelector('form');

  /** Contrato con `unsavedChangesGuard` (no es DOM: es la interfaz pública `PuedeTenerCambiosSinGuardar`). */
  const cambiosSinGuardar = (): boolean => fixture.componentInstance.tieneCambiosSinGuardar();

  // ───────────────────────────── Montaje ─────────────────────────────

  async function crear(id: string | null, datos$?: Observable<PlantillaFormData>): Promise<void> {
    facade = jasmine.createSpyObj<PlantillasFacade>('PlantillasFacade', ['getFormData', 'create', 'update']);
    facade.getFormData.and.returnValue(datos$ ?? of({ plantilla: id ? PLANTILLA : null, catalogos: CATALOGOS }));
    facade.create.and.returnValue(of(GUARDADA));
    facade.update.and.returnValue(of(GUARDADA));
    TestBed.configureTestingModule({
      imports: [PlantillaFormComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PlantillasFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { snapshot: { params: id ? { id } : {} } } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PlantillaFormComponent);
    snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    await asentar();
  }
  const alta = (): Promise<void> => crear(null);
  const edicion = (): Promise<void> => crear('p-1');

  /** Alta con lo mínimo para poder guardar. */
  function completarObligatorios(): void {
    escribir('titulo', 'Obtener el DNI');
  }

  // ───────────────────────────── Carga ─────────────────────────────

  describe('carga', () => {
    it('mientras carga una edición lo dice, sin dibujar el formulario', async () => {
      await crear('p-1', new Subject<PlantillaFormData>());

      expect(estadoCarga()!.querySelector(':scope > [role]')!.getAttribute('role')).toBe('status');
      expect(limpio(estadoCarga())).toContain('Cargando la plantilla…');
      expect(formulario()).toBeNull();
    });

    it('en el alta el texto de carga habla del formulario', async () => {
      await crear(null, new Subject<PlantillaFormData>());
      expect(limpio(estadoCarga())).toContain('Cargando el formulario…');
      expect(formulario()).toBeNull();
    });

    it('pide los datos una sola vez, con el id de la ruta (o null en el alta)', async () => {
      await edicion();
      expect(facade.getFormData).toHaveBeenCalledOnceWith('p-1');
      expect(estadoCarga()).toBeNull();
      expect(formulario()).not.toBeNull();

      TestBed.resetTestingModule();
      await alta();
      expect(facade.getFormData).toHaveBeenCalledOnceWith(null);
    });

    it('si la carga de una edición falla lo dice con texto propio y ofrece reintentar o ir al listado', async () => {
      await crear('p-1', throwError(() => errorHttp(500)));

      expect(estadoCarga()!.querySelector(':scope > [role]')!.getAttribute('role')).toBe('alert');
      expect(limpio(estadoCarga()!.querySelector('h2'))).toBe('No pudimos cargar la plantilla');
      expect(limpio(estadoCarga())).toContain(
        'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.');
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
      expect(botonesDeCarga()).toEqual(['Reintentar', 'Ir al listado']);
      expect(formulario()).toBeNull();
    });

    it('si falla la carga del alta el título habla del formulario', async () => {
      await crear(null, throwError(() => errorHttp(500)));
      expect(limpio(estadoCarga()!.querySelector('h2'))).toBe('No pudimos cargar el formulario');
      expect(botonesDeCarga()).toEqual(['Reintentar', 'Ir al listado']);
    });

    it('"Reintentar" vuelve a pedir los datos y, si llegan, dibuja el formulario precargado', async () => {
      await crear('p-1', throwError(() => errorHttp(500)));
      facade.getFormData.and.returnValue(of({ plantilla: PLANTILLA, catalogos: CATALOGOS }));

      estadoCarga()!.querySelector<HTMLButtonElement>('button')!.click();
      await asentar();

      expect(facade.getFormData).toHaveBeenCalledTimes(2);
      expect(estadoCarga()).toBeNull();
      expect(valorDe('titulo')).toBe('Obtener la licencia de conducir');
    });

    it('"Ir al listado" del error de carga navega al listado', async () => {
      await crear('p-1', throwError(() => errorHttp(500)));
      boton('Ir al listado').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
    });

    [
      { caso: 'HTTP 404', error: errorHttp(404) },
      { caso: 'código 4073 sin status (mock)', error: { error: { code: API_CODES.ENTITY_NOT_FOUND, message: MENSAJE_CRUDO } } },
    ].forEach(({ caso, error }) => {
      it(`si la plantilla no existe (${caso}) lo dice con texto propio y la única salida es el listado`, async () => {
        await crear('p-1', throwError(() => error));

        expect(estadoCarga()!.querySelector(':scope > [role]')!.getAttribute('role')).toBe('alert');
        expect(limpio(estadoCarga()!.querySelector('h2'))).toBe('Esa plantilla no existe');
        expect(limpio(estadoCarga())).toContain('Puede que el enlace esté mal escrito. Buscala en el listado.');
        expect(pantalla()).not.toContain(MENSAJE_CRUDO);
        expect(botonesDeCarga()).toEqual(['Ir al listado']);
        expect(formulario()).toBeNull();

        boton('Ir al listado').click();
        expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
      });
    });

    it('en el alta un 404 (de un catálogo) es un error de carga común, con "Reintentar"', async () => {
      await crear(null, throwError(() => errorHttp(404)));
      expect(limpio(estadoCarga()!.querySelector('h2'))).toBe('No pudimos cargar el formulario');
      expect(botonesDeCarga()).toEqual(['Reintentar', 'Ir al listado']);
    });

    it('si algún catálogo no se pudo leer avisa cuáles, sin bloquear el formulario', async () => {
      await crear(null, of({ plantilla: null, catalogos: { ...CATALOGOS, etiquetas: [], noDisponibles: ['Etiquetas', 'Destinatarios'] } }));

      expect(pantalla()).toContain(
        'No pudimos cargar: Etiquetas, Destinatarios. Lo que la plantilla ya tenía elegido se conserva al guardar, '
        + 'pero no vas a poder sumar opciones de esos catálogos hasta recargar.');
      expect(formulario()).not.toBeNull();
      // Va sobre la tarjeta de paneles, no al pie.
      const aviso = el().querySelector('.form-aviso')!;
      expect(aviso.compareDocumentPosition(el().querySelector('.ficha-paneles')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('sin catálogos caídos no muestra ese aviso', async () => {
      await alta();
      expect(pantalla()).not.toContain('No pudimos cargar:');
    });
  });

  // ───────────────────────────── Alta: campos y valores iniciales ─────────────────────────────

  describe('alta: estado inicial', () => {
    beforeEach(alta);

    it('dibuja todos los campos, vacíos', () => {
      ['titulo', 'slug', 'resumen', 'descripcion', 'modalidad', 'principal'].forEach((id) => expect(campo(id)).withContext(id).not.toBeNull());
      expect(valorDe('titulo')).toBe('');
      expect(valorDe('slug')).toBe('');
      expect(valorDe('resumen')).toBe('');
      expect(valorDe('descripcion')).toBe('');
      expect(valorDe('modalidad')).toBe('Sin modalidad');
      expect(valorDe('principal')).toBe('Sin categoría principal');
      expect(encendido('Activa')).toBeTrue();
    });

    it('cada campo tiene su etiqueta asociada, y marca los obligatorios y los opcionales', () => {
      const etiqueta = (id: string): string => limpio(el().querySelector(`label[for="${id}"]`));
      expect(etiqueta('titulo')).toBe('Título *');
      expect(etiqueta('slug')).toBe('Slug *');
      expect(etiqueta('resumen')).toBe('Resumen (opcional)');
      expect(etiqueta('descripcion')).toBe('Descripción larga (opcional)');
      expect(etiqueta('modalidad')).toBe('Modalidad (opcional)');
      expect(etiqueta('principal')).toBe('Categoría principal (opcional)');
      expect(campo('titulo').hasAttribute('required')).toBeTrue();
      expect(campo('slug').hasAttribute('required')).toBeTrue();
    });

    it('título y slug limitan el largo a 255 y el slug no autocompleta', () => {
      expect(campo('titulo').getAttribute('maxlength')).toBe('255');
      expect(campo('slug').getAttribute('maxlength')).toBe('255');
      expect(campo('slug').getAttribute('autocomplete')).toBe('off');
    });

    it('muestra las ayudas de cada campo', () => {
      // El motor suma el contador de caracteres a todo campo con largo máximo.
      expect(ayudaDe('titulo')).toBe('Empezá con un verbo en infinitivo: Obtener, Inscribirse… | 0 / 255');
      expect(ayudaDe('slug')).toBe('Se arma solo desde el título; podés editarlo. Es único entre todas las plantillas. | 0 / 255');
      expect(ayudaDe('descripcion')).toBe('Requisitos, costos y URL no van acá: son de cada ficha por localidad.');
    });

    it('la modalidad ofrece "Sin modalidad" y el catálogo, en su orden', async () => {
      expect(await opcionesDe('modalidad')).toEqual(['Sin modalidad', 'Presencial', 'En línea']);
    });

    it('los cuatro grupos de clasificación arrancan vacíos, cerrados y con su contador', () => {
      expect(contadorDe('Categorías')).toBe('0 de 3');
      expect(contadorDe('Etiquetas')).toBe('0 de 2');
      expect(contadorDe('Destinatarios')).toBe('0 de 2');
      expect(contadorDe('Eventos de vida')).toBe('0 de 2');
      expect(limpio(grupo('Categorías'))).toContain('Ninguna categoría elegida.');
      expect(limpio(grupo('Etiquetas'))).toContain('Ninguna etiqueta elegida.');
      expect(limpio(grupo('Destinatarios'))).toContain('Ningún destinatario elegido.');
      expect(limpio(grupo('Eventos de vida'))).toContain('Ningún evento de vida elegido.');
      ['Categorías', 'Etiquetas', 'Destinatarios', 'Eventos de vida'].forEach((g) => {
        expect(grupoAbierto(g)).withContext(g).toBeFalse();
        expect(limpio(botonDeGrupo(g))).withContext(g).toBe('Elegir');
        expect(chipsDe(g)).withContext(g).toEqual([]);
      });
      expect(totalElegidas()).toBe('0 opciones elegidas');
    });

    it('el membrete arranca sin datos y marcado como "Nueva"', () => {
      expect(membrete()).toContain('Plantilla sin título');
      expect(membrete()).toContain('sin-slug');
      expect(membrete()).toContain('Activa');
      expect(membrete()).toContain('Sin modalidad');
      expect(membrete()).toContain('Sin categoría principal');
      expect(membrete()).toContain('Nueva');
    });

    it('el pie ofrece "Crear plantilla" disponible, con la ayuda de obligatorios', () => {
      expect(limpio(submit())).toBe('Crear plantilla');
      expect(noDisponible()).toBeFalse();
      expect(submit().disabled).toBeFalse();
      expect(botonesDeEnvio()).toBe(1);
      expect(ayudaDelPie()).toBe('Los campos con * son obligatorios.');
      expect(boton('Cancelar').disabled).toBeFalse();
    });

    it('explica qué pasa después de crearla (solo en el alta)', () => {
      expect(pantalla()).toContain('Después de crearla');
      expect(pantalla()).toContain('Los organismos la adoptan');
      expect(pantalla()).toContain('Cada adopción suma fichas por localidad');
      expect(pantalla()).toContain('Se ve en el portal al publicar una ficha');
      expect(pantalla()).toContain('Completá los datos para crear la plantilla');
    });

    it('no hay errores, ni banners, ni cambios sin guardar', () => {
      expect(banners()).toEqual([]);
      expect(errorDe('titulo')).toBe('');
      expect(errorDe('slug')).toBe('');
      expect(cambiosSinGuardar()).toBeFalse();
    });
  });

  // ───────────────────────────── Edición: valores iniciales ─────────────────────────────

  describe('edición: estado inicial', () => {
    beforeEach(edicion);

    it('precarga todos los campos con la plantilla', () => {
      expect(valorDe('titulo')).toBe('Obtener la licencia de conducir');
      expect(valorDe('slug')).toBe('obtener-licencia');
      expect(valorDe('resumen')).toBe('Para manejar.');
      expect(valorDe('descripcion')).toBe('Texto largo');
      expect(valorDe('modalidad')).toBe('Presencial');
      expect(valorDe('principal')).toBe('Salud');
      expect(bloqueado('principal')).toBeFalse();
      expect(encendido('Activa')).toBeTrue();
    });

    it('precarga la clasificación: chips en el orden del catálogo, contadores y total', () => {
      expect(chipsDe('Categorías')).toEqual(['Salud', 'Educación']);
      expect(chipsDe('Etiquetas')).toEqual(['Gratuito']);
      expect(chipsDe('Destinatarios')).toEqual(['Adultos mayores']);
      expect(chipsDe('Eventos de vida')).toEqual([]);
      expect(contadorDe('Categorías')).toBe('2 de 3');
      expect(contadorDe('Etiquetas')).toBe('1 de 2');
      expect(contadorDe('Destinatarios')).toBe('1 de 2');
      expect(contadorDe('Eventos de vida')).toBe('0 de 2');
      expect(limpio(botonDeGrupo('Categorías'))).toBe('Cambiar');
      expect(limpio(botonDeGrupo('Eventos de vida'))).toBe('Elegir');
      expect(totalElegidas()).toBe('4 opciones elegidas');
    });

    it('el membrete refleja la plantilla y dice "Editando"', () => {
      expect(membrete()).toContain('Obtener la licencia de conducir');
      expect(membrete()).toContain('obtener-licencia');
      expect(membrete()).toContain('Presencial');
      expect(membrete()).toContain('Salud');
      expect(membrete()).toContain('Editando');
    });

    it('las ayudas y textos hablan de editar', () => {
      expect(ayudaDe('slug')).toBe('Cambiarlo cambia la dirección pública del trámite. Es único entre todas las plantillas. | 16 / 255');
      expect(pantalla()).toContain('Guardar reemplaza la plantilla completa');
      expect(ayudaDelPie()).toBe('Guardar reemplaza la plantilla completa.');
      expect(pantalla()).not.toContain('Después de crearla');
    });

    it('una plantilla con nulos y desactivada se precarga vacía y apagada', async () => {
      TestBed.resetTestingModule();
      await crear('p-1', of({
        plantilla: {
          ...PLANTILLA, resumen: null, descripcionLarga: null, modalidad: null, categoriaPrincipal: null,
          categorias: [], etiquetas: [], destinatarios: [], activa: false,
        },
        catalogos: CATALOGOS,
      }));

      expect(valorDe('resumen')).toBe('');
      expect(valorDe('descripcion')).toBe('');
      expect(valorDe('modalidad')).toBe('Sin modalidad');
      expect(valorDe('principal')).toBe('Sin categoría principal');
      expect(bloqueado('principal')).toBeTrue();
      expect(encendido('Activa')).toBeFalse();
      expect(membrete()).toContain('Desactivada');
      expect(pantalla()).toContain('Desactivada, deja de aparecer en el listado de plantillas y no se puede adoptar.');
      expect(totalElegidas()).toBe('0 opciones elegidas');
    });

    it('lo elegido que ya no está en el catálogo se muestra como "No disponible (id)" y se conserva al guardar', async () => {
      TestBed.resetTestingModule();
      await crear('p-1', of({
        plantilla: {
          ...PLANTILLA,
          modalidad: { id: 'modal999-x', nombre: null },
          etiquetas: [{ id: 'e-1', nombre: 'Gratuito' }, { id: 'borrada1-y', nombre: null }],
        },
        catalogos: CATALOGOS,
      }));

      expect(valorDe('modalidad')).toBe('No disponible (modal999)');
      expect(chipsDe('Etiquetas')).toEqual(['Gratuito', 'No disponible (borrada1)']);
      expect(contadorDe('Etiquetas')).toBe('2 de 3');

      escribir('resumen', 'Otro');
      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('p-1', {
        ...VALOR_DE_PLANTILLA, resumen: 'Otro', modalidadId: 'modal999-x', etiquetaIds: ['e-1', 'borrada1-y'],
      });
    });
  });

  // ───────────────────────────── Validaciones ─────────────────────────────

  describe('validaciones', () => {
    it('enviar el alta vacía no guarda: marca título y slug y los resume en un banner', async () => {
      await alta();
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('titulo')).toBe('Este campo es obligatorio');
      expect(errorDe('slug')).toBe('Este campo es obligatorio');
      expect(banners()).toEqual([{
        rol: 'group',
        titulo: 'Revisá 2 campos para poder guardar',
        detalle: 'Título (Este campo es obligatorio) · Slug (Este campo es obligatorio)',
      }]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('el resumen de errores recibe el foco al enviar inválido, como grupo con nombre (no `role="alert"`)', async () => {
      await alta();
      submit().focus();
      await enviar();

      // Lo hace el motor: los `mat-error` de cada campo ya se anuncian; el resumen se lee al enfocarlo.
      const nodo = el().querySelector<HTMLElement>('.form-error-banner')!;
      expect(nodo.getAttribute('role')).toBe('group');
      expect(nodo.getAttribute('tabindex')).toBe('-1');
      expect(limpio(document.getElementById(nodo.getAttribute('aria-labelledby')!))).toBe('Revisá 2 campos para poder guardar');
      expect(document.activeElement).toBe(nodo);
    });

    it('el resumen se actualiza al corregir un campo y desaparece al quedar todo válido', async () => {
      await alta();
      await enviar();

      escribir('slug', 'mi-slug');
      expect(banners()).toEqual([{
        rol: 'group', titulo: 'Revisá 1 campo para poder guardar', detalle: 'Título (Este campo es obligatorio)',
      }]);

      escribir('titulo', 'Obtener el DNI');
      expect(banners()).toEqual([]);
      expect(errorDe('titulo')).toBe('');
    });

    it('antes de enviar, un obligatorio vacío se marca al salir del campo, sin banner', async () => {
      await alta();
      salirDe('titulo');
      fixture.detectChanges();

      expect(errorDe('titulo')).toBe('Este campo es obligatorio');
      expect(banners()).toEqual([]);
    });

    it('un slug sin letras ni números se rechaza con su texto', async () => {
      await alta();
      escribir('titulo', 'Obtener el DNI');
      escribir('slug', '¡¡¡');
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('slug')).toBe('Tiene que tener letras o números');
      expect(banner()).toEqual({
        rol: 'group', titulo: 'Revisá 1 campo para poder guardar', detalle: 'Slug (Tiene que tener letras o números)',
      });
    });

    it('título y slug de más de 255 caracteres se rechazan con su texto', async () => {
      await edicion();
      escribir('titulo', 'a'.repeat(256));
      escribir('slug', 'b'.repeat(256));
      await enviar();

      expect(facade.update).not.toHaveBeenCalled();
      expect(errorDe('titulo')).toBe('No puede superar los 255 caracteres');
      expect(errorDe('slug')).toBe('No puede superar los 255 caracteres');
      expect(banner()!.detalle).toBe('Título (No puede superar los 255 caracteres) · Slug (No puede superar los 255 caracteres)');
    });

    it('255 caracteres exactos son válidos', async () => {
      await edicion();
      escribir('titulo', 'a'.repeat(255));
      await enviar();
      expect(facade.update).toHaveBeenCalledTimes(1);
    });

    it('un título de solo espacios no cuenta como completado', async () => {
      await alta();
      escribir('titulo', '   ');
      escribir('slug', 'mi-slug');
      await enviar();

      // "Obligatorio" se mide sobre el texto recortado (lo que valida el backend con `@NotBlank`).
      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('titulo')).toBe('Este campo es obligatorio');
      expect(banner()!.detalle).toBe('Título (Este campo es obligatorio)');
    });

    it('resumen, descripción, modalidad y clasificación son opcionales', async () => {
      await alta();
      completarObligatorios();
      await enviar();
      expect(facade.create).toHaveBeenCalledTimes(1);
      expect(banners()).toEqual([]);
    });
  });

  // ───────────────────────────── Payload ─────────────────────────────

  describe('payload', () => {
    it('alta mínima: crea con vacíos en "" / null / [] y activa', async () => {
      await alta();
      completarObligatorios();
      await enviar();

      expect(facade.create).toHaveBeenCalledOnceWith({
        titulo: 'Obtener el DNI', slug: 'obtener-el-dni', resumen: '', descripcionLarga: '',
        modalidadId: null, categoriaPrincipalId: null,
        categoriaIds: [], etiquetaIds: [], destinatarioIds: [], eventoDeVidaIds: [], activa: true,
      });
      expect(facade.update).not.toHaveBeenCalled();
    });

    it('alta completa: manda todo lo cargado; los ids van en el orden en que se eligieron', async () => {
      await alta();
      escribir('titulo', 'Obtener el DNI');
      escribir('resumen', 'Un resumen.');
      escribir('descripcion', 'Una descripción larga.');
      await elegir('modalidad', 'En línea');
      marcar('Categorías', 'Transporte');
      marcar('Categorías', 'Salud');
      await elegir('principal', 'Transporte');
      marcar('Etiquetas', 'Con turno');
      marcar('Destinatarios', 'Jóvenes');
      marcar('Destinatarios', 'Adultos mayores');
      marcar('Eventos de vida', 'Mudanza');
      alternarInterruptor('Activa');
      await enviar();

      expect(facade.create).toHaveBeenCalledOnceWith({
        titulo: 'Obtener el DNI', slug: 'obtener-el-dni', resumen: 'Un resumen.', descripcionLarga: 'Una descripción larga.',
        modalidadId: 'm-2', categoriaPrincipalId: 'c-3',
        categoriaIds: ['c-3', 'c-1'], etiquetaIds: ['e-2'], destinatarioIds: ['d-1', 'd-2'], eventoDeVidaIds: ['v-2'],
        activa: false,
      });
    });

    it('el componente no recorta ni canonicaliza: título y slug viajan como se escribieron', async () => {
      await alta();
      escribir('titulo', '  Obtener el DNI  ');
      escribir('slug', 'Mi Slug Ñandú');
      escribir('resumen', '  con espacios  ');
      await enviar();

      // Comportamiento actual: la normalización (trim del título, slug canónico) es del mapper, no del form.
      const enviado = facade.create.calls.mostRecent().args[0];
      expect(enviado.titulo).toBe('  Obtener el DNI  ');
      expect(enviado.slug).toBe('Mi Slug Ñandú');
      expect(enviado.resumen).toBe('  con espacios  ');
    });

    it('edición: actualiza con el id de la ruta y la plantilla completa (el PUT es total)', async () => {
      await edicion();
      escribir('resumen', 'Resumen nuevo');
      await enviar();

      expect(facade.update).toHaveBeenCalledOnceWith('p-1', { ...VALOR_DE_PLANTILLA, resumen: 'Resumen nuevo' });
      expect(facade.create).not.toHaveBeenCalled();
    });

    it('edición: quitar la modalidad y vaciar los textos manda null y ""', async () => {
      await edicion();
      await elegir('modalidad', 'Sin modalidad');
      escribir('resumen', '');
      escribir('descripcion', '');
      await enviar();

      expect(facade.update).toHaveBeenCalledOnceWith('p-1', {
        ...VALOR_DE_PLANTILLA, modalidadId: null, resumen: '', descripcionLarga: '',
      });
    });

    it('edición: desactivar manda activa=false y avisa la consecuencia en pantalla', async () => {
      await edicion();
      expect(pantalla()).not.toContain('Desactivada, deja de aparecer');

      alternarInterruptor('Activa');
      expect(encendido('Activa')).toBeFalse();
      expect(pantalla()).toContain('Desactivada, deja de aparecer en el listado de plantillas y no se puede adoptar.');
      expect(membrete()).toContain('Desactivada');

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('p-1', { ...VALOR_DE_PLANTILLA, activa: false });
    });
  });

  // ───────────────────────────── Errores de guardado ─────────────────────────────

  describe('errores de guardado', () => {
    async function fallarAlGuardar(error: unknown): Promise<void> {
      await edicion();
      facade.update.and.returnValue(throwError(() => error));
      escribir('resumen', 'Otro');
      await enviar();
    }

    [409, 400].forEach((status) => {
      it(`slug repetido (4072 con HTTP ${status}): se marca en el slug y el banner manda a revisarlo`, async () => {
        await fallarAlGuardar(errorHttp(status, API_CODES.ENTITY_CONFLICT));

        expect(errorDe('slug')).toBe('Ya existe una plantilla con ese slug (puede ser una desactivada). Elegí otro.');
        expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'Revisá el campo marcado.' }]);
        expect(pantalla()).not.toContain(MENSAJE_CRUDO);
        expect(navigate).not.toHaveBeenCalled();
        expect(snack).not.toHaveBeenCalled();
      });
    });

    it('tras un slug repetido el formulario queda disponible y con cambios sin guardar', async () => {
      await fallarAlGuardar(errorHttp(409, API_CODES.ENTITY_CONFLICT));

      expect(submit().disabled).toBeFalse();
      expect(noDisponible()).toBeFalse();
      expect(limpio(submit())).toBe('Guardar cambios');
      expect(formulario()!.getAttribute('aria-busy')).toBe('false');
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('el error del slug y el banner se van al corregir el slug rechazado', async () => {
      await fallarAlGuardar(errorHttp(409, API_CODES.ENTITY_CONFLICT));

      // Tocar otro campo no corrige nada: el campo sigue marcado y el banner a la vista.
      escribir('resumen', 'Otro más');
      expect(errorDe('slug')).toBe('Ya existe una plantilla con ese slug (puede ser una desactivada). Elegí otro.');
      expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'Revisá el campo marcado.' }]);

      escribir('slug', 'otro-slug');
      expect(errorDe('slug')).toBe('');
      expect(banners()).toEqual([]);

      facade.update.and.returnValue(of(GUARDADA));
      await enviar();
      expect(facade.update.calls.mostRecent().args[1].slug).toBe('otro-slug');
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_DETALLE, 'p-9']);
    });

    it('tocar categorías tras un slug repetido no borra el error del Slug (los campos se recalculan)', async () => {
      const ERROR_DE_SLUG = 'Ya existe una plantilla con ese slug (puede ser una desactivada). Elegí otro.';
      await fallarAlGuardar(errorHttp(409, API_CODES.ENTITY_CONFLICT));

      marcar('Categorías', 'Transporte');
      expect(chipsDe('Categorías')).toContain('Transporte');
      expect(errorDe('slug')).toBe(ERROR_DE_SLUG);
      await elegir('principal', 'Transporte');
      expect(errorDe('slug')).toBe(ERROR_DE_SLUG);
      quitarChip('Categorías', 'Educación');

      expect(errorDe('slug')).toBe(ERROR_DE_SLUG);
      expect(campo('slug').getAttribute('aria-invalid')).toBe('true');
      expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'Revisá el campo marcado.' }]);

      escribir('slug', 'otro-slug');
      expect(errorDe('slug')).toBe('');
      expect(campo('slug').getAttribute('aria-invalid')).toBe('false');
      expect(banners()).toEqual([]);
    });

    it('algo de lo elegido ya no existe (4073): va al banner con texto propio, sin marcar campos', async () => {
      await fallarAlGuardar(errorHttp(404, API_CODES.ENTITY_NOT_FOUND));

      expect(banners()).toEqual([{
        rol: 'alert',
        titulo: 'No se pudo guardar',
        detalle: 'La plantilla o algo de lo que elegiste (modalidad, categorías, etiquetas, destinatarios o eventos de vida) '
          + 'ya no existe. Recargá la página e intentá de nuevo.',
      }]);
      expect(errorDe('slug')).toBe('');
      expect(errorDe('titulo')).toBe('');
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
    });

    it('un error sin status ni código conocido cae en el texto de respaldo, nunca en el mensaje del backend', async () => {
      await fallarAlGuardar({ error: { code: 999999, message: MENSAJE_CRUDO } });

      expect(banners()).toEqual([{
        rol: 'alert', titulo: 'No se pudo guardar', detalle: 'No se pudo guardar la plantilla. Intentá de nuevo.',
      }]);
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
    });

    ([
      ['un 500', errorHttp(500), TEXTOS_DE_ERROR_HTTP.servidor.formulario],
      ['sin conexión', errorHttp(0), TEXTOS_DE_ERROR_HTTP['sin-conexion'].formulario],
      ['un 403', errorHttp(403), TEXTOS_DE_ERROR_HTTP['sin-permiso'].formulario],
      ['un 409 con otro código', errorHttp(409, 4091), TEXTOS_DE_ERROR_HTTP.conflicto.formulario],
      ['un 400 sin código', errorHttp(400), TEXTOS_DE_ERROR_HTTP['datos-rechazados'].formulario],
    ] as const).forEach(([caso, error, texto]) => {
      it(`${caso} muestra el texto compartido de ese tipo de error en el banner`, async () => {
        await fallarAlGuardar(error);

        expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: texto }]);
        expect(errorDe('slug')).toBe('');
        expect(pantalla()).not.toContain(MENSAJE_CRUDO);
      });
    });

    it('si el guardado completa sin responder, libera el formulario con el texto de respaldo', async () => {
      await edicion();
      facade.update.and.returnValue(EMPTY);
      escribir('resumen', 'Otro');
      await enviar();

      expect(banner()!.detalle).toBe('No se pudo guardar la plantilla. Intentá de nuevo.');
      expect(submit().disabled).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('en el alta el slug repetido se cuenta igual, y reintentar vuelve a llamar a create', async () => {
      await alta();
      facade.create.and.returnValue(throwError(() => errorHttp(409, API_CODES.ENTITY_CONFLICT)));
      completarObligatorios();
      await enviar();

      expect(errorDe('slug')).toBe('Ya existe una plantilla con ese slug (puede ser una desactivada). Elegí otro.');
      expect(limpio(submit())).toBe('Crear plantilla');
      expect(submit().disabled).toBeFalse();

      facade.create.and.returnValue(of(GUARDADA));
      escribir('slug', 'obtener-el-dni-2');
      await enviar();

      expect(facade.create).toHaveBeenCalledTimes(2);
      expect(banners()).toEqual([]);
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_DETALLE, 'p-9']);
    });
  });

  // ───────────────────────────── Guardar sin cambios ─────────────────────────────

  describe('"Guardar" sin cambios (edición)', () => {
    beforeEach(edicion);

    it('arranca no disponible con su motivo, enfocable y en un solo botón', () => {
      expect(botonesDeEnvio()).toBe(1);
      expect(limpio(submit())).toBe('Guardar cambios');
      expect(noDisponible()).toBeTrue();
      expect(submit().disabled).toBeFalse(); // no es un `disabled` mudo: sigue en el tabulado
      expect(motivoDeNoDisponible()).toBe('No hay cambios para guardar');
    });

    it('sin cambios, el clic no guarda', async () => {
      await enviar();
      expect(facade.update).not.toHaveBeenCalled();
      expect(banners()).toEqual([]);
    });

    it('se habilita al primer cambio, sobre el mismo nodo de botón', () => {
      const antes = submit();
      escribir('resumen', 'Para manejar. Y más.');

      expect(submit()).toBe(antes);
      expect(botonesDeEnvio()).toBe(1);
      expect(noDisponible()).toBeFalse();
      expect(motivoDeNoDisponible()).toBe('');
    });

    ([
      ['elegir otra modalidad', (): Promise<void> => elegir('modalidad', 'En línea')],
      ['marcar una categoría', (): void => marcar('Categorías', 'Transporte')],
      ['quitar un chip', (): void => quitarChip('Etiquetas', 'Gratuito')],
      ['apagar "Activa"', (): void => alternarInterruptor('Activa')],
    ] as const).forEach(([caso, gesto]) => {
      it(`${caso} también cuenta como cambio`, async () => {
        await gesto();
        expect(noDisponible()).toBeFalse();
        expect(cambiosSinGuardar()).toBeTrue();
      });
    });

    it('sin tocar el título no se ofrece "Desde el título": abrir una edición no invita a cambiar el slug', () => {
      expect(desdeElTitulo()).toBeUndefined();
    });

    it('abrir y cerrar un grupo de clasificación no cuenta como cambio', () => {
      alternarGrupo('Categorías');
      alternarGrupo('Categorías');
      expect(noDisponible()).toBeTrue();
      expect(cambiosSinGuardar()).toBeFalse();
    });

    it('en el alta "Crear plantilla" nunca queda "sin cambios"', async () => {
      TestBed.resetTestingModule();
      await alta();
      expect(noDisponible()).toBeFalse();
      expect(motivoDeNoDisponible()).toBe('');
    });
  });

  // ───────────────────────────── Cambios sin guardar ─────────────────────────────

  describe('cambios sin guardar (unsavedChangesGuard)', () => {
    it('alta: no hay al cargar y los hay al escribir', async () => {
      await alta();
      expect(cambiosSinGuardar()).toBeFalse();
      escribir('titulo', 'O');
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('edición: no hay durante el guardado ni después de guardar bien', async () => {
      await edicion();
      const guardado$ = new Subject<PlantillaVM>();
      facade.update.and.returnValue(guardado$);
      escribir('resumen', 'Otro');
      expect(cambiosSinGuardar()).toBeTrue();

      await enviar();
      expect(cambiosSinGuardar()).toBeFalse();

      guardado$.next(GUARDADA);
      await asentar();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(cambiosSinGuardar()).toBeFalse();
    });

    it('si el guardado falla vuelve a haberlos', async () => {
      await edicion();
      facade.update.and.returnValue(throwError(() => errorHttp(500)));
      escribir('resumen', 'Otro');
      await enviar();
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('un envío inválido no los descarta', async () => {
      await alta();
      escribir('resumen', 'Algo');
      await enviar();
      expect(cambiosSinGuardar()).toBeTrue();
    });
  });

  // ───────────────────────────── Guardado y navegación ─────────────────────────────

  describe('guardado en curso', () => {
    it('bloquea el pie, dice "Guardando…" y marca el formulario ocupado', async () => {
      await edicion();
      facade.update.and.returnValue(new Subject<PlantillaVM>());
      escribir('resumen', 'Otro');
      expect(formulario()!.getAttribute('aria-busy')).toBe('false');
      const antes = submit();

      await enviar();

      expect(submit()).toBe(antes);
      expect(submit().disabled).toBeTrue();
      expect(limpio(submit())).toBe('Guardando…');
      expect(noDisponible()).toBeFalse();
      expect(boton('Cancelar').disabled).toBeTrue();
      expect(formulario()!.getAttribute('aria-busy')).toBe('true');
      expect(navigate).not.toHaveBeenCalled();
      expect(snack).not.toHaveBeenCalled();
    });
  });

  describe('navegación tras guardar', () => {
    it('alta: avisa "Plantilla creada" y va al detalle de la plantilla creada', async () => {
      await alta();
      completarObligatorios();
      await enviar();

      expect(snack).toHaveBeenCalledOnceWith('Plantilla creada', 'OK', { duration: 4000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_DETALLE, 'p-9']);
    });

    it('edición: avisa "Plantilla actualizada" y va al detalle de la que devolvió el guardado', async () => {
      await edicion();
      escribir('resumen', 'Otro');
      await enviar();

      expect(snack).toHaveBeenCalledOnceWith('Plantilla actualizada', 'OK', { duration: 4000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_DETALLE, 'p-9']);
    });

    it('si quedó desactivada, el aviso dice que no aparece en el listado (alta y edición)', async () => {
      await alta();
      facade.create.and.returnValue(of({ ...GUARDADA, activa: false }));
      completarObligatorios();
      await enviar();
      expect(snack).toHaveBeenCalledOnceWith(
        'Plantilla creada. Está desactivada: no aparece en el listado', 'OK', { duration: 4000, panelClass: 'snackbar-success' });

      TestBed.resetTestingModule();
      await edicion();
      facade.update.and.returnValue(of({ ...GUARDADA, activa: false }));
      escribir('resumen', 'Otro');
      await enviar();
      expect(snack).toHaveBeenCalledOnceWith(
        'Plantilla actualizada. Está desactivada: no aparece en el listado', 'OK', { duration: 4000, panelClass: 'snackbar-success' });
    });

    ([
      ['devuelve false', (): void => { navigate.and.resolveTo(false); }],
      ['rechaza', (): void => { navigate.and.rejectWith(new Error('chunk')); }],
    ] as const).forEach(([caso, preparar]) => {
      it(`alta: si la navegación ${caso}, avisa dónde encontrarla y NO deja crear de nuevo`, async () => {
        await alta();
        preparar();
        completarObligatorios();
        await enviar();

        expect(facade.create).toHaveBeenCalledTimes(1);
        expect(snack.calls.allArgs()).toEqual([
          ['Plantilla creada', 'OK', { duration: 4000, panelClass: 'snackbar-success' }],
          ['La plantilla ya se creó, pero no pudimos abrir la pantalla siguiente. Buscala en la lista.', 'OK',
            { duration: 8000, panelClass: 'snackbar-warning' }],
        ]);
        // Comportamiento actual: el pie queda bloqueado en "Guardando…" (habilitarlo duplicaría la plantilla).
        expect(submit().disabled).toBeTrue();
        expect(limpio(submit())).toBe('Guardando…');
        expect(boton('Cancelar').disabled).toBeTrue();
        expect(cambiosSinGuardar()).toBeFalse();
        expect(banners()).toEqual([]);
      });

      it(`edición: si la navegación ${caso}, el formulario queda disponible, guardado y sin cambios`, async () => {
        await edicion();
        preparar();
        escribir('resumen', 'Otro');
        await enviar();

        expect(facade.update).toHaveBeenCalledTimes(1);
        expect(snack).toHaveBeenCalledOnceWith('Plantilla actualizada', 'OK', { duration: 4000, panelClass: 'snackbar-success' });
        expect(submit().disabled).toBeFalse();
        expect(limpio(submit())).toBe('Guardar cambios');
        expect(noDisponible()).toBeTrue();
        expect(motivoDeNoDisponible()).toBe('No hay cambios para guardar');
        expect(boton('Cancelar').disabled).toBeFalse();
        expect(cambiosSinGuardar()).toBeFalse();
        expect(valorDe('resumen')).toBe('Otro');
        expect(banners()).toEqual([]);

        // Un cambio posterior vuelve a habilitar el guardado.
        escribir('resumen', 'Otro más');
        expect(noDisponible()).toBeFalse();
      });
    });

    it('"Cancelar" en el alta va al listado, sin guardar', async () => {
      await alta();
      boton('Cancelar').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
      expect(facade.create).not.toHaveBeenCalled();
    });

    it('"Cancelar" en la edición vuelve al detalle de esa plantilla, sin guardar', async () => {
      await edicion();
      boton('Cancelar').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_DETALLE, 'p-1']);
      expect(facade.update).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────── Slug derivado del título ─────────────────────────────

  describe('slug', () => {
    describe('alta', () => {
      beforeEach(alta);

      it('sigue al título mientras se escribe, canonicalizado', () => {
        escribir('titulo', 'Obtener');
        expect(valorDe('slug')).toBe('obtener');
        escribir('titulo', '  Obtener el DNI de Niños y Ñandúes!  ');
        expect(valorDe('slug')).toBe('obtener-el-dni-de-ninos-y-nandues');
        expect(membrete()).toContain('obtener-el-dni-de-ninos-y-nandues');
      });

      it('borrar el título vacía el slug', () => {
        escribir('titulo', 'Obtener');
        escribir('titulo', '');
        expect(valorDe('slug')).toBe('');
      });

      it('deja de seguirlo cuando se edita el slug a mano', () => {
        escribir('titulo', 'Obtener el DNI');
        escribir('slug', 'mi-slug');
        escribir('titulo', 'Obtener el pasaporte');
        expect(valorDe('slug')).toBe('mi-slug');
      });

      it('vuelve a seguirlo si el slug se vacía a mano', () => {
        escribir('titulo', 'Obtener el DNI');
        escribir('slug', 'mi-slug');
        escribir('slug', '');
        escribir('titulo', 'Obtener el pasaporte');
        expect(valorDe('slug')).toBe('obtener-el-pasaporte');
      });

      it('"Desde el título" se ofrece solo cuando del título sale un slug distinto del que hay', () => {
        // Sin título no hay nada que derivar: el botón no está (antes era un `disabled` mudo).
        expect(desdeElTitulo()).toBeUndefined();
        escribir('titulo', '   ');
        expect(desdeElTitulo()).toBeUndefined();
        // Mientras el slug sigue al título ya coincide: tampoco hace falta.
        escribir('titulo', 'Obtener');
        expect(desdeElTitulo()).toBeUndefined();

        escribir('slug', 'mi-slug');
        expect(desdeElTitulo()!.disabled).toBeFalse();
        expect(desdeElTitulo()!.getAttribute('type')).toBe('button');

        // Vaciado a mano, con título: se ofrece para rearmarlo ya.
        escribir('slug', '');
        expect(desdeElTitulo()!.disabled).toBeFalse();
      });

      it('"Desde el título" rearma el slug y lo deja siguiendo al título otra vez', () => {
        escribir('titulo', 'Obtener el DNI');
        escribir('slug', 'mi-slug');

        boton('Desde el título').click();
        fixture.detectChanges();
        expect(valorDe('slug')).toBe('obtener-el-dni');
        // El botón desaparece con el clic: el foco pasa al campo.
        expect(desdeElTitulo()).toBeUndefined();
        expect(document.activeElement).toBe(campo('slug'));

        escribir('titulo', 'Obtener el pasaporte');
        expect(valorDe('slug')).toBe('obtener-el-pasaporte');
      });

      it('"Desde el título" no envía el formulario', async () => {
        escribir('titulo', 'Obtener el DNI');
        escribir('slug', 'mi-slug');
        boton('Desde el título').click();
        await asentar();
        expect(facade.create).not.toHaveBeenCalled();
      });

      it('si lo tipeado no es canónico anticipa cómo se va a guardar, en una región viva ya montada', () => {
        expect(pantalla()).not.toContain('Se guardará como:');
        const region = Array.from(el().querySelectorAll<HTMLElement>('[aria-live="polite"]'))
          .find((r) => r.closest('.form-field')?.contains(campo('slug')))!;
        expect(region).toBeTruthy();
        expect(limpio(region)).toBe('');

        escribir('slug', 'Mi Slug Ñandú');
        expect(limpio(region)).toMatch(/^Se guardará como: ?mi-slug-nandu$/);

        escribir('slug', 'mi-slug-nandu');
        expect(limpio(region)).toBe('');
      });
    });

    describe('edición', () => {
      beforeEach(edicion);

      it('no sigue al título: cambiarlo tiene que ser deliberado', () => {
        escribir('titulo', 'Obtener el pasaporte');
        expect(valorDe('slug')).toBe('obtener-licencia');
      });

      it('tampoco lo sigue después de vaciarlo a mano', () => {
        escribir('slug', '');
        escribir('titulo', 'Obtener el pasaporte');
        expect(valorDe('slug')).toBe('');
      });

      it('"Desde el título" aparece al cambiar el título, lo rearma una vez y después sigue sin seguir al título', async () => {
        expect(desdeElTitulo()).toBeUndefined();
        escribir('titulo', 'Obtener el pasaporte');

        boton('Desde el título').click();
        fixture.detectChanges();
        expect(valorDe('slug')).toBe('obtener-el-pasaporte');
        expect(noDisponible()).toBeFalse();

        escribir('titulo', 'Obtener el pasaporte nuevo');
        expect(valorDe('slug')).toBe('obtener-el-pasaporte');

        await enviar();
        expect(facade.update).toHaveBeenCalledOnceWith('p-1', {
          ...VALOR_DE_PLANTILLA, titulo: 'Obtener el pasaporte nuevo', slug: 'obtener-el-pasaporte',
        });
      });
    });
  });

  // ───────────────────────────── Categoría principal ─────────────────────────────

  describe('categoría principal', () => {
    it('sin categorías está bloqueada y dice cómo destrabarla', async () => {
      await alta();
      expect(bloqueado('principal')).toBeTrue();
      expect(ayudaDe('principal')).toBe('Elegí primero al menos una categoría.');
    });

    it('al elegir una categoría se habilita y ofrece solo las elegidas, en el orden del catálogo', async () => {
      await alta();
      marcar('Categorías', 'Transporte');
      expect(bloqueado('principal')).toBeFalse();
      expect(ayudaDe('principal')).toBe('Se elige entre las categorías de la plantilla.');
      expect(await opcionesDe('principal')).toEqual(['Sin categoría principal', 'Transporte']);

      marcar('Categorías', 'Salud');
      expect(await opcionesDe('principal')).toEqual(['Sin categoría principal', 'Salud', 'Transporte']);
    });

    it('elegir la principal la refleja en el membrete; no cuenta en el total de opciones elegidas', async () => {
      await alta();
      marcar('Categorías', 'Salud');
      await elegir('principal', 'Salud');

      expect(valorDe('principal')).toBe('Salud');
      expect(membrete()).toContain('Salud');
      expect(membrete()).not.toContain('Sin categoría principal');
      expect(totalElegidas()).toBe('1 opción elegida');
    });

    it('sin principal elegida, quitar todas las categorías la vuelve a bloquear', async () => {
      await alta();
      marcar('Categorías', 'Salud');
      quitarChip('Categorías', 'Salud');
      expect(bloqueado('principal')).toBeTrue();
      expect(ayudaDe('principal')).toBe('Elegí primero al menos una categoría.');
    });

    it('quitar la categoría que era principal no la limpia: la deja a la vista con su error y no deja guardar', async () => {
      await edicion();
      quitarChip('Categorías', 'Salud');

      expect(valorDe('principal')).toBe('Salud');
      expect(errorDe('principal')).toBe('Tiene que ser una de las categorías elegidas');
      expect(bloqueado('principal')).toBeFalse();
      // La principal huérfana se sigue listando para que el select no se vea vacío.
      expect(await opcionesDe('principal')).toEqual(['Sin categoría principal', 'Salud', 'Educación']);

      await enviar();
      expect(facade.update).not.toHaveBeenCalled();
      expect(banners()).toEqual([{
        rol: 'group',
        titulo: 'Revisá 1 campo para poder guardar',
        detalle: 'Categoría principal (Tiene que ser una de las categorías elegidas)',
      }]);
    });

    it('el error se va al elegir otra principal entre las que quedan', async () => {
      await edicion();
      quitarChip('Categorías', 'Salud');
      await elegir('principal', 'Educación');

      expect(errorDe('principal')).toBe('');
      expect(await opcionesDe('principal')).toEqual(['Sin categoría principal', 'Educación']);

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('p-1', {
        ...VALOR_DE_PLANTILLA, categoriaIds: ['c-2'], categoriaPrincipalId: 'c-2',
      });
    });

    it('el error también se va al volver a marcar su categoría', async () => {
      await edicion();
      quitarChip('Categorías', 'Salud');
      marcar('Categorías', 'Salud');

      expect(errorDe('principal')).toBe('');
      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('p-1', { ...VALOR_DE_PLANTILLA, categoriaIds: ['c-2', 'c-1'] });
    });

    it('sin ninguna categoría pero con principal sigue habilitada (con su error) hasta que se la quita', async () => {
      await edicion();
      quitarChip('Categorías', 'Salud');
      quitarChip('Categorías', 'Educación');

      expect(bloqueado('principal')).toBeFalse();
      expect(errorDe('principal')).toBe('Tiene que ser una de las categorías elegidas');
      expect(await opcionesDe('principal')).toEqual(['Sin categoría principal', 'Salud']);

      await elegir('principal', 'Sin categoría principal');
      expect(bloqueado('principal')).toBeTrue();
      expect(errorDe('principal')).toBe('');
      expect(ayudaDe('principal')).toBe('Elegí primero al menos una categoría.');

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('p-1', {
        ...VALOR_DE_PLANTILLA, categoriaIds: [], categoriaPrincipalId: null,
      });
    });
  });

  // ───────────────────────────── Selección múltiple ─────────────────────────────

  describe('selección múltiple', () => {
    beforeEach(alta);

    it('abrir un grupo muestra su catálogo como casillas; "Listo" lo cierra', () => {
      alternarGrupo('Categorías');
      expect(grupoAbierto('Categorías')).toBeTrue();
      expect(limpio(botonDeGrupo('Categorías'))).toBe('Listo');
      expect(casillasDe('Categorías').map((c) => c.texto)).toEqual(['Salud', 'Educación', 'Transporte']);

      alternarGrupo('Categorías');
      expect(grupoAbierto('Categorías')).toBeFalse();
      expect(casillasDe('Categorías')).toEqual([]);
    });

    it('solo un grupo está abierto a la vez', () => {
      alternarGrupo('Categorías');
      alternarGrupo('Etiquetas');

      expect(grupoAbierto('Categorías')).toBeFalse();
      expect(grupoAbierto('Etiquetas')).toBeTrue();
      expect(casillasDe('Etiquetas').map((c) => c.texto)).toEqual(['Gratuito', 'Con turno']);
    });

    it('elegir suma chips (en el orden del catálogo), mueve el contador y el total', () => {
      marcar('Categorías', 'Transporte');
      expect(chipsDe('Categorías')).toEqual(['Transporte']);
      expect(contadorDe('Categorías')).toBe('1 de 3');
      expect(totalElegidas()).toBe('1 opción elegida');
      expect(limpio(grupo('Categorías'))).not.toContain('Ninguna categoría elegida.');

      marcar('Categorías', 'Salud');
      expect(chipsDe('Categorías')).toEqual(['Salud', 'Transporte']);
      expect(contadorDe('Categorías')).toBe('2 de 3');
      expect(totalElegidas()).toBe('2 opciones elegidas');
      expect(casillasDe('Categorías').map((c) => c.input.checked)).toEqual([true, false, true]);
    });

    it('desmarcar una casilla la saca de lo elegido', () => {
      marcar('Categorías', 'Salud');
      marcar('Categorías', 'Salud');
      expect(chipsDe('Categorías')).toEqual([]);
      expect(contadorDe('Categorías')).toBe('0 de 3');
      expect(totalElegidas()).toBe('0 opciones elegidas');
    });

    it('la X del chip quita esa opción y vuelve el texto de vacío al quitar la última', () => {
      marcar('Etiquetas', 'Gratuito');
      marcar('Etiquetas', 'Con turno');
      alternarGrupo('Etiquetas');
      expect(limpio(botonDeGrupo('Etiquetas'))).toBe('Cambiar');

      quitarChip('Etiquetas', 'Gratuito');
      expect(chipsDe('Etiquetas')).toEqual(['Con turno']);
      expect(contadorDe('Etiquetas')).toBe('1 de 2');
      expect(totalElegidas()).toBe('1 opción elegida');

      quitarChip('Etiquetas', 'Con turno');
      expect(chipsDe('Etiquetas')).toEqual([]);
      expect(limpio(grupo('Etiquetas'))).toContain('Ninguna etiqueta elegida.');
      expect(limpio(botonDeGrupo('Etiquetas'))).toBe('Elegir');
      expect(totalElegidas()).toBe('0 opciones elegidas');
    });

    it('el total suma los cuatro grupos', () => {
      marcar('Categorías', 'Salud');
      marcar('Etiquetas', 'Gratuito');
      marcar('Destinatarios', 'Jóvenes');
      marcar('Eventos de vida', 'Nacimiento');
      marcar('Eventos de vida', 'Mudanza');

      expect(contadorDe('Categorías')).toBe('1 de 3');
      expect(contadorDe('Etiquetas')).toBe('1 de 2');
      expect(contadorDe('Destinatarios')).toBe('1 de 2');
      expect(contadorDe('Eventos de vida')).toBe('2 de 2');
      expect(totalElegidas()).toBe('5 opciones elegidas');
    });

    it('con un catálogo grande el contador es "2 de 18" y aparece el buscador del grupo', async () => {
      TestBed.resetTestingModule();
      const etiquetas = Array.from({ length: 18 }, (_, i) => ({ id: `e-${i + 1}`, nombre: `Etiqueta ${i + 1}` }));
      await crear(null, of({ plantilla: null, catalogos: { ...CATALOGOS, etiquetas } }));

      marcar('Etiquetas', 'Etiqueta 3');
      marcar('Etiquetas', 'Etiqueta 11');

      expect(contadorDe('Etiquetas')).toBe('2 de 18');
      expect(chipsDe('Etiquetas')).toEqual(['Etiqueta 3', 'Etiqueta 11']);
      expect(grupo('Etiquetas').querySelector('input[type="search"]')!.getAttribute('aria-label')).toBe('Buscar en etiquetas');
    });

    it('Enter dentro de la lista abierta no envía el formulario', () => {
      alternarGrupo('Categorías');
      const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      casillasDe('Categorías')[0].input.dispatchEvent(evento);
      expect(evento.defaultPrevented).toBeTrue();
    });
  });

  // ───────────────────────────── Datos recomendados ─────────────────────────────

  describe('indicador de datos recomendados', () => {
    it('alta vacía: falta todo', async () => {
      await alta();
      expect(recomendado()).toBe('Recomendado: falta resumen, modalidad y categoría principal');
    });

    it('se va achicando a medida que se completan, hasta "completos"', async () => {
      await alta();

      escribir('resumen', 'Un resumen.');
      expect(recomendado()).toBe('Recomendado: falta modalidad y categoría principal');

      await elegir('modalidad', 'Presencial');
      expect(recomendado()).toBe('Recomendado: falta categoría principal');

      marcar('Categorías', 'Salud');
      expect(recomendado()).toBe('Recomendado: falta categoría principal');

      await elegir('principal', 'Salud');
      expect(recomendado()).toBe('Datos recomendados: completos');
    });

    it('un resumen de solo espacios no cuenta', async () => {
      await alta();
      escribir('resumen', '   ');
      expect(recomendado()).toBe('Recomendado: falta resumen, modalidad y categoría principal');
    });

    it('edición completa: "completos"; al vaciar el resumen o quitar la modalidad vuelve a faltar', async () => {
      await edicion();
      expect(recomendado()).toBe('Datos recomendados: completos');

      escribir('resumen', '');
      expect(recomendado()).toBe('Recomendado: falta resumen');

      await elegir('modalidad', 'Sin modalidad');
      expect(recomendado()).toBe('Recomendado: falta resumen y modalidad');
    });

    it('es informativo: con datos recomendados faltantes igual se puede guardar', async () => {
      await alta();
      completarObligatorios();
      expect(recomendado()).toBe('Recomendado: falta resumen, modalidad y categoría principal');
      await enviar();
      expect(facade.create).toHaveBeenCalledTimes(1);
    });
  });
});
