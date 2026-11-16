import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { CategoriaVM, CategoriasFacade } from '@features/categorias';
import { CategoriaDialogComponent, CategoriaDialogData } from './categoria-dialog.component';

const CATEGORIAS: CategoriaVM[] = [
  { id: 'salud', parentId: null, slug: 'salud', nombre: 'Salud' },
  { id: 'edu', parentId: null, slug: 'educacion', nombre: 'Educación' },
  { id: 'insc', parentId: 'edu', slug: 'inscripciones', nombre: 'Inscripciones' },
  { id: 'inicial', parentId: 'insc', slug: 'nivel-inicial', nombre: 'Nivel inicial' },
];

/** Deja correr las promesas del cierre (la confirmación es `async`). */
const asentar = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('CategoriaDialogComponent', () => {
  let facade: jasmine.SpyObj<CategoriasFacade>;
  let dialogRef: { close: jasmine.Spy; disableClose: boolean; backdropClick: () => Subject<MouseEvent>; keydownEvents: () => Subject<KeyboardEvent> };
  let backdropClick: Subject<MouseEvent>;
  let keydown: Subject<KeyboardEvent>;
  let matDialog: jasmine.SpyObj<MatDialog>;

  function crear(data: Partial<CategoriaDialogData>): CategoriaDialogComponent {
    facade = jasmine.createSpyObj<CategoriasFacade>('CategoriasFacade', ['create', 'update']);
    backdropClick = new Subject<MouseEvent>();
    keydown = new Subject<KeyboardEvent>();
    dialogRef = {
      close: jasmine.createSpy('close'), disableClose: false,
      backdropClick: () => backdropClick, keydownEvents: () => keydown,
    };
    matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    matDialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    TestBed.configureTestingModule({
      imports: [CategoriaDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoriasFacade, useValue: facade },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { categorias: CATEGORIAS, categoria: null, parentId: null, ...data } },
      ],
    }).overrideProvider(MatDialog, { useValue: matDialog });
    const fixture = TestBed.createComponent(CategoriaDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('en un alta el slug sigue al nombre hasta que el usuario lo edita', () => {
    const c = crear({});
    c.form.controls.nombre.setValue('Automotor, transporte y tránsito');
    expect(c.form.controls.slug.value).toBe('automotor-transporte-y-transito');

    c.form.controls.slug.setValue('autos');
    c.form.controls.slug.markAsDirty(); // lo que hace el input al tipear
    c.form.controls.nombre.setValue('Automotor');
    expect(c.form.controls.slug.value).toBe('autos');
    expect(c.puedeUsarElDelNombre).toBeTrue();

    c.usarElDelNombre();
    expect(c.form.controls.slug.value).toBe('automotor');
    c.form.controls.nombre.setValue('Automotores');
    expect(c.form.controls.slug.value).toBe('automotores');
  });

  it('editando no toca el slug al cambiar el nombre y no guarda sin cambios', () => {
    const c = crear({ categoria: CATEGORIAS[2] });
    expect(c.sinCambios).toBeTrue();
    c.guardar();
    expect(facade.update).not.toHaveBeenCalled();

    c.form.controls.nombre.setValue('Inscripciones escolares');
    expect(c.form.controls.slug.value).toBe('inscripciones');
  });

  it('abre con el padre de la fila desde la que se agregó y arma la ruta', async () => {
    const c = crear({ parentId: 'insc' });
    expect(c.nombreDelPadreInicial).toBe('Inscripciones');
    expect((await firstValueFrom(c.ubicacion$)).ruta).toEqual(['Educación', 'Inscripciones']);
  });

  it('la categoría en edición no es opción de padre y su descendencia va bloqueada', () => {
    const c = crear({ categoria: CATEGORIAS[2] });
    const nodos = c.arbol.nodes;
    expect(nodos.map((n) => n.id)).toEqual(['salud', 'edu', 'inicial']);
    expect(nodos.find((n) => n.id === 'inicial')?.disabledReason).toBe('Depende de esta');
    expect(nodos.find((n) => n.id === 'salud')?.disabledReason).toBeUndefined();
  });

  it('un nombre de solo espacios o con menos de 3 caracteres útiles no pasa', () => {
    const c = crear({ categoria: CATEGORIAS[2] });
    c.form.controls.nombre.setValue('   ');
    expect(c.form.controls.nombre.hasError('required')).toBeTrue();
    c.form.controls.nombre.setValue('a  ');
    expect(c.form.controls.nombre.hasError('minlength')).toBeTrue();

    c.form.markAsDirty();
    c.guardar();
    expect(facade.update).not.toHaveBeenCalled();
  });

  it('el slug no admite guiones al principio, al final ni dobles', () => {
    const c = crear({});
    const slug = c.form.controls.slug;
    for (const malo of ['-abc', 'abc-', '-abc-', 'a--bc']) {
      slug.setValue(malo);
      expect(slug.hasError('guiones')).withContext(malo).toBeTrue();
    }
    slug.setValue('Abc def');
    expect(slug.hasError('pattern')).toBeTrue();
    for (const bueno of ['abc', 'nivel-inicial', 'ley-27-2024']) {
      slug.setValue(bueno);
      expect(slug.valid).withContext(bueno).toBeTrue();
    }
  });

  it('editando, un slug viejo mal formado no bloquea el guardado mientras no se lo cambie', () => {
    const vieja: CategoriaVM = { id: 'v', parentId: null, slug: 'Tramites__viejos-', nombre: 'Viejos' };
    const c = crear({ categoria: vieja, categorias: [...CATEGORIAS, vieja] });
    expect(c.form.controls.slug.valid).toBeTrue();
    c.form.controls.slug.setValue('viejos-');
    expect(c.form.controls.slug.hasError('guiones')).toBeTrue();
  });

  it('editando, un padre que no está en el listado se conserva en vez de mandarla a la raíz', () => {
    const huerfana: CategoriaVM = { id: 'x', parentId: 'borrada', slug: 'equis', nombre: 'Equis' };
    const c = crear({ categoria: huerfana, categorias: [...CATEGORIAS, huerfana] });
    expect(c.form.controls.parentId.value).toBe('borrada');
  });

  it('guarda el alta y cierra devolviendo la categoría', () => {
    const c = crear({ parentId: 'salud' });
    const guardada: CategoriaVM = { id: 'nueva', parentId: 'salud', slug: 'turnos', nombre: 'Turnos' };
    facade.create.and.returnValue(of(guardada));

    c.form.controls.nombre.setValue('  Turnos ');
    c.guardar();

    expect(facade.create).toHaveBeenCalledOnceWith({ nombre: 'Turnos', slug: 'turnos', parentId: 'salud' });
    expect(dialogRef.close).toHaveBeenCalledOnceWith(guardada);
  });

  it('un slug repetido se marca en el campo y el diálogo queda abierto', () => {
    const c = crear({});
    facade.create.and.returnValue(throwError(() => ({ error: { code: API_CODES.ENTITY_CONFLICT } })));

    c.form.controls.nombre.setValue('Salud');
    c.guardar();

    expect(c.form.controls.slug.getError('server')).toBe('Ya existe una categoría con ese slug');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(c.guardando).toBeFalse();
  });

  describe('cierre', () => {
    it('arranca con el cierre automático bloqueado: todo pasa por `cancelar`', () => {
      crear({});
      expect(dialogRef.disableClose).toBeTrue();
    });

    it('sin cambios cierra directo (Cancelar, Escape y clic afuera) sin preguntar', async () => {
      const c = crear({});

      await c.cancelar();
      keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      backdropClick.next(new MouseEvent('click'));
      await asentar();

      expect(matDialog.open).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledTimes(3);
    });

    it('con cambios pregunta: "Seguir editando" no cierra y "Descartar" sí', async () => {
      const c = crear({});
      c.form.controls.nombre.markAsDirty();

      matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
      await c.cancelar();
      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open.calls.mostRecent().args[1]?.data)
        .toEqual(jasmine.objectContaining({ message: 'Hay datos sin guardar. Si cerrás ahora no se crea la categoría.' }));
      expect(dialogRef.close).not.toHaveBeenCalled();

      matDialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
      await c.cancelar();
      expect(dialogRef.close).toHaveBeenCalledOnceWith();
    });

    it('Escape y el clic afuera pasan por la misma confirmación', async () => {
      const c = crear({ categoria: CATEGORIAS[2] });
      c.form.controls.nombre.markAsDirty();
      matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

      const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      keydown.next(escape);
      await asentar();
      backdropClick.next(new MouseEvent('click'));
      await asentar();

      expect(escape.defaultPrevented).toBeTrue();
      expect(matDialog.open).toHaveBeenCalledTimes(2);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
