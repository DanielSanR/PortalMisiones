import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { AdopcionOpciones, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { AdoptarDialogComponent } from './adoptar-dialog.component';

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

/** "Adoptar trámite" con el organismo de la sesión (`/api/auth/me`, backend `586b670`, G-2). */
describe('AdoptarDialogComponent — organismo de la sesión', () => {
  let fixture: ComponentFixture<AdoptarDialogComponent>;
  let facade: jasmine.SpyObj<AdopcionesFacade>;
  let close: jasmine.Spy;

  async function abrir(
    opciones: AdopcionOpciones, fuente: () => Observable<AdopcionOpciones> = () => of(opciones),
  ): Promise<AdoptarDialogComponent> {
    facade = jasmine.createSpyObj<AdopcionesFacade>('AdopcionesFacade', ['getOpcionesAdoptar', 'adoptar']);
    facade.getOpcionesAdoptar.and.callFake(fuente);
    facade.adoptar.and.returnValue(of({ id: 'a-9' } as AdopcionVM));
    close = jasmine.createSpy('close');

    await TestBed.configureTestingModule({
      imports: [AdoptarDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: AdopcionesFacade, useValue: facade },
        { provide: MatDialogRef, useValue: { close, disableClose: false, backdropClick: () => NEVER, keydownEvents: () => NEVER } },
      ],
    })
      .overrideProvider(MatDialog, { useValue: { open: jasmine.createSpy('open'), openDialogs: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(AdoptarDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const campoOrganismo = (): HTMLInputElement => fixture.nativeElement.querySelector('input#adoptar-organismo');

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('sesión de organismo: "Organismo" viene con el suyo, sin deshabilitar el control, y el form sigue pristine', async () => {
    const dialogo = await abrir(DE_ORGANISMO);
    const organismo = dialogo.form.controls.organismoId;

    expect(organismo.value).toBe('org-1');
    expect(organismo.enabled).toBeTrue();
    expect(dialogo.form.pristine).toBeTrue();
  });

  it('sesión de organismo: se muestra como dato de solo lectura enfocable, no como un select deshabilitado', async () => {
    await abrir(DE_ORGANISMO);
    document.body.appendChild(fixture.nativeElement);

    expect(fixture.nativeElement.querySelector('mat-select#adoptar-organismo')).toBeNull();
    expect(campoOrganismo().readOnly).toBeTrue();
    expect(campoOrganismo().disabled).toBeFalse();
    expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');

    campoOrganismo().focus();
    expect(document.activeElement).toBe(campoOrganismo());
  });

  it('sesión de organismo: el campo tiene nombre accesible y el motivo asociado por `aria-describedby`', async () => {
    await abrir(DE_ORGANISMO);
    document.body.appendChild(fixture.nativeElement);

    const etiqueta = document.getElementById(campoOrganismo().getAttribute('aria-labelledby') ?? '');
    expect(etiqueta?.textContent?.trim()).toBe('Organismo');

    const descripcion = (campoOrganismo().getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(descripcion).toContain('Tu cuenta pertenece a Instituto de Previsión Social (IPS)');
  });

  it('las opciones se piden una sola vez, aunque las escuchen la vista y el componente', async () => {
    await abrir(DE_ORGANISMO);

    expect(facade.getOpcionesAdoptar).toHaveBeenCalledTimes(1);
  });

  it('fuente síncrona (caché): fijar el organismo no rompe la detección de cambios', async () => {
    await abrir(DE_ORGANISMO);

    // `detectChanges()` en un test también corre el chequeo de "cambió después de revisarse".
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');
  });

  it('"Reintentar" con una sesión que ya no es de organismo: vuelve el select, vacío y obligatorio', async () => {
    const dialogo = await abrir(DE_ORGANISMO);
    facade.getOpcionesAdoptar.and.returnValue(of(GLOBAL));

    dialogo.reintentar();
    fixture.detectChanges();

    expect(dialogo.form.controls.organismoId.value).toBe('');
    expect(dialogo.form.pristine).toBeTrue();
    expect(campoOrganismo()).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-select#adoptar-organismo')).not.toBeNull();
  });

  it('si la carga falla y "Reintentar" anda, el organismo de la sesión queda fijado', async () => {
    const dialogo = await abrir(DE_ORGANISMO, () => throwError(() => new Error('sin red')));
    expect(fixture.nativeElement.querySelector('.state-panel[role="alert"]')).not.toBeNull();
    facade.getOpcionesAdoptar.and.returnValue(of(DE_ORGANISMO));

    dialogo.reintentar();
    fixture.detectChanges();

    expect(dialogo.form.controls.organismoId.value).toBe('org-1');
    expect(campoOrganismo().value).toBe('Instituto de Previsión Social (IPS)');
  });

  it('sesión de organismo: al adoptar viaja su organismo aunque no haya un select para elegirlo', async () => {
    const dialogo = await abrir(DE_ORGANISMO);
    dialogo.form.controls.plantillaId.setValue('pt-1');

    dialogo.guardar();

    expect(facade.adoptar).toHaveBeenCalledOnceWith(jasmine.objectContaining({ plantillaId: 'pt-1', organismoId: 'org-1', habilitada: true }));
    expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'a-9' }));
  });

  it('sesión global (o backend sin G-2): el organismo se elige y es obligatorio, como antes', async () => {
    const dialogo = await abrir(GLOBAL);
    const organismo = dialogo.form.controls.organismoId;

    expect(organismo.enabled).toBeTrue();
    expect(organismo.value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Tu cuenta pertenece');

    dialogo.form.controls.plantillaId.setValue('pt-1');
    dialogo.guardar();

    expect(facade.adoptar).not.toHaveBeenCalled();
    expect(organismo.hasError('required')).toBeTrue();
  });
});
