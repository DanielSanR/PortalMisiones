import { firstValueFrom, of } from 'rxjs';
import { EtiquetaFormData, EtiquetaOrganismoFijo, EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import { camposDeEtiqueta, dialogoDeEtiqueta } from './etiqueta-dialogo';

const FIJO: EtiquetaOrganismoFijo = {
  id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)',
  motivo: 'Tu cuenta pertenece a Instituto de Previsión Social (IPS): las etiquetas que crees son locales de ese organismo.',
};
const LOCAL: EtiquetaVM = { id: 't-1', slug: 'salud', organismoId: 'org-1', organismoNombre: 'IPS', local: true };
const CREADA: EtiquetaVM = { id: 't-9', slug: 'nueva', organismoId: 'org-1', organismoNombre: null, local: true };

function facadeCon(datos: EtiquetaFormData): jasmine.SpyObj<EtiquetasFacade> {
  const facade = jasmine.createSpyObj<EtiquetasFacade>('EtiquetasFacade', ['getFormData', 'create', 'update']);
  facade.getFormData.and.returnValue(of(datos));
  facade.create.and.returnValue(of(CREADA));
  facade.update.and.returnValue(of(LOCAL));
  return facade;
}

describe('diálogo de etiqueta — organismo de la sesión (G-2)', () => {
  describe('alta con una sesión de organismo', () => {
    const campo = () => camposDeEtiqueta([{ id: FIJO.id, nombre: FIJO.nombre }], null, FIJO).find((f) => f.name === 'organismoId')!;

    it('"Organismo" viene con el suyo, de solo lectura (no deshabilitado), sin la opción "global" y con el motivo en el hint', () => {
      expect(campo().value).toBe('org-1');
      expect(campo().readonly).toBeTrue();
      expect(campo().disabled).toBeFalsy();
      expect(campo().options).toEqual([{ id: 'org-1', name: 'Instituto de Previsión Social (IPS)' }]);
      expect(campo().hint).toContain('Tu cuenta pertenece a Instituto de Previsión Social (IPS)');
    });

    it('guarda como etiqueta local de su organismo aunque el form no entregue el campo', async () => {
      const facade = facadeCon({ etiqueta: null, organismos: [{ id: FIJO.id, nombre: FIJO.nombre }], organismoFijo: FIJO });
      const data = dialogoDeEtiqueta(facade, null);
      await firstValueFrom(data.cargar());

      await firstValueFrom(data.guardar({ slug: 'Nueva' }));
      expect(facade.create).toHaveBeenCalledWith({ slug: 'Nueva', organismoId: 'org-1' });

      await firstValueFrom(data.guardar({ slug: 'Nueva', organismoId: '' }));
      expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');
    });
  });

  describe('alta con una sesión global (o un backend sin G-2)', () => {
    const campo = () => camposDeEtiqueta([{ id: 'org-1', nombre: 'IPS' }], null, null).find((f) => f.name === 'organismoId')!;

    it('elige el alcance: "global" + el catálogo, sin bloqueo', () => {
      expect(campo().readonly).toBeFalse();
      expect(campo().disabled).toBeFalsy();
      expect(campo().value).toBeUndefined();
      expect(campo().options).toEqual([{ id: '', name: 'Ninguno — etiqueta global' }, { id: 'org-1', name: 'IPS' }]);
      expect(campo().hint).not.toContain('Tu cuenta pertenece');
    });

    it('sin organismo elegido guarda una etiqueta global', async () => {
      const facade = facadeCon({ etiqueta: null, organismos: [], organismoFijo: null });
      const data = dialogoDeEtiqueta(facade, null);
      await firstValueFrom(data.cargar());

      await firstValueFrom(data.guardar({ slug: 'salud', organismoId: '' }));

      expect(facade.create).toHaveBeenCalledWith({ slug: 'salud', organismoId: null });
    });
  });

  describe('edición', () => {
    it('manda el alcance de la etiqueta, no el de la sesión: de solo lectura con su propio motivo', async () => {
      const campo = camposDeEtiqueta([], LOCAL, FIJO).find((f) => f.name === 'organismoId')!;
      expect(campo.readonly).toBeTrue();
      expect(campo.disabled).toBeFalsy();
      expect(campo.hint).toContain('el alcance de una etiqueta se elige al crearla');
      // Sin catálogo, el campo fijado igual nombra el organismo de la etiqueta.
      expect(campo.options).toContain({ id: 'org-1', name: 'IPS' });

      const facade = facadeCon({ etiqueta: LOCAL, organismos: [], organismoFijo: { ...FIJO, id: 'org-de-sesion' } });
      const data = dialogoDeEtiqueta(facade, LOCAL);
      await firstValueFrom(data.cargar());
      await firstValueFrom(data.guardar({ slug: 'salud-2', organismoId: 'org-1' }));

      expect(facade.update).toHaveBeenCalledWith('t-1', { slug: 'salud-2', organismoId: 'org-1' });
    });
  });
});
