import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, firstValueFrom, of, throwError } from 'rxjs';
import { AdopcionOpciones, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { FormDialogDePrueba, montarFormDialog } from '@shared/components/form-dialog/testing/form-dialog.testing';
import { camposDeAdoptar, camposDeVigencia, dialogoDeAdoptar, motivoDeHasta, rangoDeVigencia } from './adoptar-dialogo';

const PLANTILLAS = [{ id: 'pt-1', nombre: 'Obtener el carnet' }];
const DE_ORGANISMO: AdopcionOpciones = {
  plantillas: PLANTILLAS,
  organismos: [{ id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)' }],
  organismoFijo: {
    id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)',
    motivo: 'Tu cuenta pertenece a Instituto de Previsión Social (IPS): solo podés adoptar trámites para ese organismo.',
  },
};
const GLOBAL: AdopcionOpciones = {
  plantillas: PLANTILLAS,
  organismos: [{ id: 'org-1', nombre: 'IPS' }, { id: 'org-2', nombre: 'Rentas' }],
  organismoFijo: null,
};
const hoy = (): Date => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

describe('vigencia de una adopción (funciones puras)', () => {
  it('"hasta" el mismo día que "desde" es válido; un día antes, no', () => {
    expect(motivoDeHasta(new Date(2026, 9, 13), new Date(2026, 9, 13))).toBeNull();
    expect(motivoDeHasta(new Date(2026, 9, 12), new Date(2026, 9, 13))).toBe('No puede ser anterior a la fecha de inicio');
  });

  it('"desde" es obligatoria; "hasta", no (y sin alguna de las dos no hay nada que comparar)', () => {
    const [desde, hasta] = camposDeVigencia();
    expect(desde.validations?.required).toBeTrue();
    expect(hasta.validations?.required).toBeUndefined();
    expect(hasta.opcional).toBeTrue();
    expect(motivoDeHasta(null, new Date(2026, 9, 13))).toBeNull();
    expect(motivoDeHasta('', new Date(2026, 9, 13))).toBeNull();
    expect(motivoDeHasta(new Date(2026, 9, 13), null)).toBeNull();
  });

  it('lo editado va a los bordes del día', () => {
    const { vigenteDesde, vigenteHasta } = rangoDeVigencia({ vigenteDesde: new Date(2026, 9, 13), vigenteHasta: new Date(2026, 11, 31) });
    expect(vigenteDesde).toEqual(new Date(2026, 9, 13, 0, 0, 0));
    expect(vigenteHasta).toEqual(new Date(2026, 11, 31, 23, 59, 59));
    expect(rangoDeVigencia({ vigenteDesde: new Date(2026, 9, 13), vigenteHasta: '' }).vigenteHasta).toBeNull();
  });

  it('sin tocar los campos reenvía las horas originales', () => {
    const original = { vigenteDesde: new Date(2026, 0, 1, 10, 30), vigenteHasta: new Date(2027, 0, 1, 0, 0) };
    const sinTocar = { desde: true, hasta: true };
    expect(rangoDeVigencia({ vigenteDesde: new Date(2026, 0, 1), vigenteHasta: new Date(2027, 0, 1) }, original, sinTocar)).toEqual(original);

    const editado = rangoDeVigencia(
      { vigenteDesde: new Date(2026, 0, 1), vigenteHasta: new Date(2027, 5, 30) }, original, { desde: true, hasta: false },
    );
    expect(editado.vigenteDesde).toBe(original.vigenteDesde);
    expect(editado.vigenteHasta).toEqual(new Date(2027, 5, 30, 23, 59, 59));
  });
});

describe('diálogo "Adoptar trámite"', () => {
  let facade: jasmine.SpyObj<AdopcionesFacade>;
  let d: FormDialogDePrueba;

  function crearFacade(fuente: () => Observable<AdopcionOpciones>): void {
    facade = jasmine.createSpyObj<AdopcionesFacade>('AdopcionesFacade', ['getOpcionesAdoptar', 'adoptar']);
    facade.getOpcionesAdoptar.and.callFake(fuente);
    facade.adoptar.and.returnValue(of({ id: 'a-9' } as AdopcionVM));
  }
  async function abrir(opciones: AdopcionOpciones, fuente: () => Observable<AdopcionOpciones> = () => of(opciones)): Promise<void> {
    TestBed.resetTestingModule();
    crearFacade(fuente);
    d = await montarFormDialog(dialogoDeAdoptar(facade));
  }
  const campoOrganismo = (): HTMLInputElement => d.el.querySelector('input#organismoId')!;
  const reintentar = async (): Promise<void> => {
    d.fixture.componentInstance.reintentar();
    await d.asentar();
  };

  describe('organismo de la sesión (`/api/auth/me`, backend `586b670`, G-2)', () => {
    it('sesión de organismo: "Organismo" viene con el suyo, sin deshabilitar el control, y el form sigue pristine', async () => {
      await abrir(DE_ORGANISMO);
      const organismo = d.form().get('organismoId')!;

      expect(organismo.value).toBe('org-1');
      expect(organismo.enabled).toBeTrue();
      expect(d.form().pristine).toBeTrue();
    });

    it('sesión de organismo: se muestra como dato de solo lectura enfocable, no como un select deshabilitado', async () => {
      await abrir(DE_ORGANISMO);

      expect(d.el.querySelector('mat-select#organismoId')).toBeNull();
      expect(campoOrganismo().readOnly).toBeTrue();
      expect(campoOrganismo().disabled).toBeFalse();
      expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');

      campoOrganismo().focus();
      expect(document.activeElement).toBe(campoOrganismo());
    });

    it('sesión de organismo: el campo tiene nombre accesible y el motivo asociado por `aria-describedby`', async () => {
      await abrir(DE_ORGANISMO);

      const etiqueta = document.getElementById(campoOrganismo().getAttribute('aria-labelledby') ?? '');
      expect(etiqueta?.textContent?.trim()).toBe('Organismo');

      const descripcion = (campoOrganismo().getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
      expect(descripcion).toContain('Tu cuenta pertenece a Instituto de Previsión Social (IPS)');
    });

    it('las opciones se piden una sola vez', async () => {
      await abrir(DE_ORGANISMO);
      expect(facade.getOpcionesAdoptar).toHaveBeenCalledTimes(1);
    });

    it('fuente síncrona (caché): fijar el organismo no rompe la detección de cambios', async () => {
      await abrir(DE_ORGANISMO);
      // `detectChanges()` en un test también corre el chequeo de "cambió después de revisarse".
      expect(() => d.fixture.detectChanges()).not.toThrow();
      expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');
    });

    it('"Reintentar" con una sesión que ya no es de organismo: vuelve el select, vacío y obligatorio', async () => {
      await abrir(DE_ORGANISMO);
      facade.getOpcionesAdoptar.and.returnValue(of(GLOBAL));

      await reintentar();

      expect(d.form().get('organismoId')!.value).toBe('');
      expect(d.form().pristine).toBeTrue();
      expect(campoOrganismo()).toBeNull();
      expect(d.el.querySelector('mat-select#organismoId')).not.toBeNull();
      expect(d.etiquetas()).toContain('Organismo *');
    });

    it('si la carga falla y "Reintentar" anda, el organismo de la sesión queda fijado', async () => {
      await abrir(DE_ORGANISMO, () => throwError(() => new Error('sin red')));
      expect(d.el.querySelector('.state-panel[role="alert"]')).not.toBeNull();
      facade.getOpcionesAdoptar.and.returnValue(of(DE_ORGANISMO));

      await reintentar();

      expect(d.form().get('organismoId')!.value).toBe('org-1');
      expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');
    });

    it('sesión de organismo: al adoptar viaja su organismo aunque no haya un select para elegirlo', async () => {
      await abrir(DE_ORGANISMO);
      d.elegir('plantillaId', 'pt-1');

      await d.enviar();

      expect(facade.adoptar).toHaveBeenCalledOnceWith(jasmine.objectContaining({ plantillaId: 'pt-1', organismoId: 'org-1', habilitada: true }));
      expect(d.close).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'a-9' }));
    });

    it('el organismo de la sesión manda sobre lo que entregue el formulario', async () => {
      crearFacade(() => of(DE_ORGANISMO));
      const data = dialogoDeAdoptar(facade);
      await firstValueFrom(data.cargar());
      await firstValueFrom(data.guardar({ plantillaId: 'pt-1', organismoId: 'otro', vigenteDesde: hoy(), vigenteHasta: '' }));
      expect(facade.adoptar.calls.mostRecent().args[0].organismoId).toBe('org-1');
    });

    it('sesión global (o backend sin G-2): el organismo se elige y es obligatorio, como antes', async () => {
      await abrir(GLOBAL);
      const organismo = d.form().get('organismoId')!;

      expect(organismo.enabled).toBeTrue();
      expect(organismo.value).toBe('');
      expect(d.el.textContent).not.toContain('Tu cuenta pertenece');

      d.elegir('plantillaId', 'pt-1');
      await d.enviar();

      expect(facade.adoptar).not.toHaveBeenCalled();
      expect(organismo.hasError('required')).toBeTrue();
    });
  });

  describe('campos, vigencia y errores', () => {
    it('marco: título, subtítulo y botón "Adoptar" ("Adoptando…" mientras guarda)', async () => {
      await abrir(GLOBAL);
      expect(d.textoDe('h2')).toBe('Adoptar trámite');
      expect(d.textoDe('.dialogo-formulario__subtitulo')).toBe('El organismo ofrece una plantilla provincial durante el período que elijas.');
      expect(d.guardar().textContent!.trim()).toBe('Adoptar');
      expect(d.guardar().type).toBe('submit');
      expect(dialogoDeAdoptar(facade).textoGuardando).toBe('Adoptando…');
    });

    it('mientras carga lo dice; si falla, explica qué falta y ofrece "Reintentar"', async () => {
      await abrir(GLOBAL, () => NEVER);
      expect(d.el.textContent).toContain('Cargando plantillas y organismos…');
      expect(d.el.querySelector('.dialogo-formulario__pie')).toBeNull();

      await abrir(GLOBAL, () => throwError(() => new Error('sin red')));
      expect(d.textoDe('.state-panel__title')).toBe('No pudimos cargar el formulario');
      expect(d.textoDe('.state-panel__text')).toBe('Faltan las plantillas o los organismos. Revisá tu conexión e intentá de nuevo.');
      expect(d.textoDe('.state-panel__cta')).toBe('Reintentar');
    });

    it('abre con "Vigente desde" en hoy y "hasta" vacío, con sus ayudas, y el foco en la plantilla', async () => {
      await abrir(GLOBAL);
      expect(d.form().get('vigenteDesde')!.value).toEqual(hoy());
      expect(d.form().get('vigenteHasta')!.value).toBeFalsy();
      expect(d.etiquetas()).toEqual(['Plantilla provincial *', 'Organismo *', 'Vigente desde *', 'Vigente hasta (opcional)']);
      expect(d.el.textContent).toContain('Desde el comienzo de ese día.');
      expect(d.el.textContent).toContain('Hasta el final de ese día. Vacío = sin fecha de fin.');
      expect(d.el.querySelector<HTMLInputElement>('#vigenteDesde')!.placeholder).toBe('DD/MM/AAAA');
      expect(d.el.querySelector('.date-field__quitar')).toBeNull();
      expect(d.form().pristine).toBeTrue();
      expect(document.activeElement?.id).toBe('plantillaId');
    });

    it('cada calendario dice qué fecha abre', async () => {
      await abrir(GLOBAL);
      const nombres = Array.from(d.el.querySelectorAll('mat-datepicker-toggle')).map((b) => b.getAttribute('aria-label'));
      expect(nombres).toEqual(['Elegir la fecha de inicio', 'Elegir la fecha de fin']);
    });

    it('enviar sin elegir marca plantilla y organismo con su texto', async () => {
      await abrir(GLOBAL);
      await d.enviar();
      expect(d.errores()).toEqual(['Elegí una plantilla', 'Elegí un organismo']);
      expect(facade.adoptar).not.toHaveBeenCalled();
    });

    it('sin plantillas u organismos activos lo dice bajo el campo', async () => {
      await abrir({ plantillas: [], organismos: [], organismoFijo: null });
      expect(d.el.textContent).toContain('No hay plantillas activas para adoptar.');
      expect(d.el.textContent).toContain('No hay organismos activos disponibles.');
      const [plantilla, organismo] = camposDeAdoptar({ plantillas: [], organismos: [], organismoFijo: null });
      expect([plantilla.emptyOptionsMessage, organismo.emptyOptionsMessage])
        .toEqual(['No hay plantillas activas para adoptar.', 'No hay organismos activos disponibles.']);
    });

    it('fechas: mal escrita, "desde" vacía y "hasta" anterior, cada una con su texto', async () => {
      await abrir(GLOBAL);

      d.tipear('vigenteDesde', '31/02/2026');
      expect(d.errores()).toEqual(['Escribí la fecha como DD/MM/AAAA']);
      d.tipear('vigenteDesde', '');
      expect(d.errores()).toEqual(['Es obligatoria']);

      d.tipear('vigenteDesde', '10/03/2026');
      d.tipear('vigenteHasta', '09/03/2026');
      expect(d.errores()).toEqual(['No puede ser anterior a la fecha de inicio']);
      d.tipear('vigenteHasta', '10/03/2026');
      expect(d.errores()).toEqual([]);
      expect(d.form().get('vigenteHasta')!.valid).toBeTrue();

      // Mover el inicio revalida el fin, y lo muestra aunque no se lo haya tocado de nuevo.
      d.tipear('vigenteDesde', '11/03/2026');
      expect(d.errores()).toEqual(['No puede ser anterior a la fecha de inicio']);
    });

    it('"Quitar la fecha de fin" aparece con una fecha cargada y la vacía', async () => {
      await abrir(GLOBAL);
      d.tipear('vigenteHasta', '10/03/2030');
      const quitar = d.el.querySelector<HTMLButtonElement>('.date-field__quitar')!;
      expect(quitar.textContent!.trim()).toBe('Quitar la fecha de fin');
      quitar.click();
      d.fixture.detectChanges();
      expect(d.form().get('vigenteHasta')!.value).toBeNull();
      expect(d.el.querySelector('.date-field__quitar')).toBeNull();
    });

    it('envía la vigencia a los bordes del día: desde 00:00:00 y hasta 23:59:59', async () => {
      await abrir(GLOBAL);
      d.elegir('plantillaId', 'pt-1');
      d.elegir('organismoId', 'org-2');
      d.tipear('vigenteDesde', '10/03/2026');
      d.tipear('vigenteHasta', '31/12/2026');

      await d.enviar();

      expect(facade.adoptar).toHaveBeenCalledOnceWith({
        plantillaId: 'pt-1', organismoId: 'org-2', organismoTitularId: null, habilitada: true,
        vigenteDesde: new Date(2026, 2, 10, 0, 0, 0), vigenteHasta: new Date(2026, 11, 31, 23, 59, 59),
      });
    });

    it('sin "hasta" envía `vigenteHasta: null` y "desde" hoy', async () => {
      await abrir(GLOBAL);
      d.elegir('plantillaId', 'pt-1');
      d.elegir('organismoId', 'org-2');
      await d.enviar();
      expect(facade.adoptar).toHaveBeenCalledOnceWith(jasmine.objectContaining({ vigenteDesde: hoy(), vigenteHasta: null }));
    });

    it('el solapamiento (4080) va al banner "No se pudo adoptar" con texto propio y deja reintentar', async () => {
      await abrir(GLOBAL);
      d.elegir('plantillaId', 'pt-1');
      d.elegir('organismoId', 'org-2');
      facade.adoptar.and.returnValue(throwError(() => ({ status: 409, error: { code: 4080, message: 'response.code.4080' } })));

      await d.enviar();

      expect(d.banner()).toContain('No se pudo adoptar');
      expect(d.banner()).toContain('Ya hay una adopción vigente de este trámite en el organismo para ese período. Cambiá las fechas o editá la adopción existente.');
      expect(d.banner()).not.toContain('response.code');
      expect(d.close).not.toHaveBeenCalled();
      expect(d.guardar().disabled).toBeFalse();
    });

    it('cerrar con cambios pide confirmación con el texto de la adopción; sin cambios cierra directo', async () => {
      await abrir(GLOBAL);

      await d.cerrar();
      expect(d.confirmacion).not.toHaveBeenCalled();
      expect(d.close).toHaveBeenCalledTimes(1);

      d.elegir('plantillaId', 'pt-1');
      await d.cerrar();
      expect(d.confirmacion.calls.mostRecent().args[1].data.message).toBe('Hay datos sin guardar. Si cerrás ahora no se adopta el trámite.');
      expect(d.close).toHaveBeenCalledTimes(1);
    });
  });
});
