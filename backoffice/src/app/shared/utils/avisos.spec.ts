import { MatSnackBar } from '@angular/material/snack-bar';
import { PREFERENCIAS_STORAGE_KEY } from '@core/services/preferencias.service';
import { avisar, avisarAdvertencia, avisarError, avisarExito, duracionSegunPreferencia } from './avisos';

describe('avisos', () => {
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    localStorage.removeItem(PREFERENCIAS_STORAGE_KEY);
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
  });

  afterEach(() => localStorage.removeItem(PREFERENCIAS_STORAGE_KEY));

  it('el aviso de éxito dura 3 segundos, con "OK" y la variante de éxito', () => {
    avisarExito(snackBar, 'Etiqueta creada');
    expect(snackBar.open).toHaveBeenCalledOnceWith('Etiqueta creada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
  });

  it('un aviso de éxito puede llevar otra acción y otra duración', () => {
    avisarExito(snackBar, 'Trámite adoptado', { accion: 'Ver', duracion: 5000 });
    expect(snackBar.open).toHaveBeenCalledOnceWith('Trámite adoptado', 'Ver', { duration: 5000, panelClass: 'snackbar-success' });
  });

  it('la advertencia queda 8 segundos con su variante', () => {
    avisarAdvertencia(snackBar, 'El rol ya se creó');
    expect(snackBar.open).toHaveBeenCalledOnceWith('El rol ya se creó', 'OK', { duration: 8000, panelClass: 'snackbar-warning' });
  });

  it('el error queda 5 segundos con su variante', () => {
    avisarError(snackBar, 'No pudimos abrir el formulario');
    expect(snackBar.open).toHaveBeenCalledOnceWith('No pudimos abrir el formulario', 'OK', { duration: 5000, panelClass: 'snackbar-error' });
  });

  it('el aviso neutro no lleva variante de color', () => {
    avisar(snackBar, 'No encontramos esa etiqueta');
    expect(snackBar.open).toHaveBeenCalledOnceWith('No encontramos esa etiqueta', 'OK', { duration: 5000 });
  });

  it('devuelve la referencia del snackbar, para escuchar su acción', () => {
    const ref = {} as ReturnType<MatSnackBar['open']>;
    snackBar.open.and.returnValue(ref);
    expect(avisarExito(snackBar, 'Listo')).toBe(ref);
  });

  describe('según la preferencia de duración', () => {
    it('normal deja la duración', () => expect(duracionSegunPreferencia(3000, 'normal')).toBe(3000));
    it('largo la duplica', () => expect(duracionSegunPreferencia(5000, 'largo')).toBe(10000));
    it('fijo no pone duración', () => expect(duracionSegunPreferencia(8000, 'fijo')).toBeUndefined());

    it('avisarExito con duracion explícita y preferencia fijo abre sin duration', () => {
      localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify({ avisos: 'fijo' }));
      avisarExito(snackBar, 'Etiqueta creada', { duracion: 5000 });
      expect(snackBar.open).toHaveBeenCalledWith('Etiqueta creada', 'OK', jasmine.objectContaining({ duration: undefined }));
    });

    it('con la preferencia largo la advertencia queda el doble', () => {
      localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify({ avisos: 'largo' }));
      avisarAdvertencia(snackBar, 'El rol ya se creó');
      expect(snackBar.open).toHaveBeenCalledOnceWith('El rol ya se creó', 'OK', { duration: 16000, panelClass: 'snackbar-warning' });
    });

    it('con la preferencia guardada rota usa la duración normal', () => {
      localStorage.setItem(PREFERENCIAS_STORAGE_KEY, '{roto');
      avisar(snackBar, 'No encontramos esa etiqueta');
      expect(snackBar.open).toHaveBeenCalledOnceWith('No encontramos esa etiqueta', 'OK', { duration: 5000 });
    });
  });
});
