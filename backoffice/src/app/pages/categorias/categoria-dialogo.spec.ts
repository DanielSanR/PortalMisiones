import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { CategoriaVM, CategoriasFacade } from '@features/categorias';
import { FormDialogDePrueba, montarFormDialog } from '@shared/components/form-dialog/testing/form-dialog.testing';
import { arbolDeCategorias, camposDeCategoria, dialogoDeCategoria, motivoDeSlug } from './categoria-dialogo';

const CATEGORIAS: CategoriaVM[] = [
  { id: 'salud', parentId: null, slug: 'salud', nombre: 'Salud' },
  { id: 'edu', parentId: null, slug: 'educacion', nombre: 'Educación' },
  { id: 'insc', parentId: 'edu', slug: 'inscripciones', nombre: 'Inscripciones' },
  { id: 'inicial', parentId: 'insc', slug: 'nivel-inicial', nombre: 'Nivel inicial' },
];
const INSC = CATEGORIAS[2];

describe('diálogo de categoría', () => {
  let facade: jasmine.SpyObj<CategoriasFacade>;

  beforeEach(() => {
    facade = jasmine.createSpyObj<CategoriasFacade>('CategoriasFacade', ['create', 'update']);
  });

  describe('configuración (funciones puras)', () => {
    it('títulos, subtítulos y botón según sea alta, subcategoría o edición', () => {
      const alta = dialogoDeCategoria(facade, CATEGORIAS, null);
      expect([alta.titulo, alta.subtitulo, alta.textoGuardar, alta.requiereCambios])
        .toEqual(['Nueva categoría', 'Completá los datos para crearla.', 'Crear categoría', false]);

      const sub = dialogoDeCategoria(facade, CATEGORIAS, null, 'insc');
      expect([sub.titulo, sub.subtitulo]).toEqual(['Nueva subcategoría', 'Se agrega dentro de «Inscripciones». Podés cambiarlo abajo.']);

      const edicion = dialogoDeCategoria(facade, CATEGORIAS, INSC);
      expect([edicion.titulo, edicion.subtitulo, edicion.textoGuardar, edicion.requiereCambios])
        .toEqual(['Editar categoría', 'Los cambios se aplican al guardar.', 'Guardar cambios', true]);
    });

    it('el texto de descarte habla del alta o de la categoría', () => {
      expect(dialogoDeCategoria(facade, CATEGORIAS, null).mensajeDescartar).toBe('Hay datos sin guardar. Si cerrás ahora no se crea la categoría.');
      expect(dialogoDeCategoria(facade, CATEGORIAS, INSC).mensajeDescartar).toBe('Hay cambios sin guardar en esta categoría. Si cerrás ahora se pierden.');
    });

    it('la categoría en edición no es opción de padre y su descendencia va bloqueada, con el motivo', () => {
      const nodos = arbolDeCategorias(CATEGORIAS, INSC).nodes;
      expect(nodos.map((n) => n.id)).toEqual(['salud', 'edu', 'inicial']);
      expect(nodos.find((n) => n.id === 'inicial')?.disabledReason).toBe('Depende de esta');
      expect(nodos.find((n) => n.id === 'salud')?.disabledReason).toBeUndefined();
    });

    it('el árbol se configura con "Sin categoría padre", buscador por nombre o slug y la propia categoría marcada', () => {
      const arbol = arbolDeCategorias(CATEGORIAS, INSC);
      expect(arbol.emptyLabel).toBe('Sin categoría padre');
      expect(arbol.emptyMeta).toBe('Queda como categoría de primer nivel');
      expect(arbol.searchLabel).toBe('Buscar por nombre o slug');
      expect(arbol.self).toEqual({ id: 'insc', label: 'Inscripciones', tag: 'Esta categoría', icon: 'folder-simple' });
      expect(arbol.nodes.find((n) => n.id === 'salud')).toEqual(jasmine.objectContaining({ label: 'Salud', meta: '/salud', keywords: 'salud', parentId: null }));
      expect(arbolDeCategorias(CATEGORIAS, null).self).toEqual({ id: null, label: 'Nueva categoría', tag: 'Esta categoría', icon: 'folder-simple' });
    });

    it('el slug no admite guiones al principio, al final ni dobles, ni otros caracteres, ni menos de 3', () => {
      for (const malo of ['-abc', 'abc-', '-abc-', 'a--bc']) {
        expect(motivoDeSlug(malo, '')).withContext(malo)
          .toBe('Los guiones van solo entre palabras: ni al principio, ni al final, ni dos seguidos');
      }
      expect(motivoDeSlug('Abc def', '')).toBe('Solo minúsculas, números y guiones');
      expect(motivoDeSlug('ab', '')).toBe('Tiene que tener al menos 3 caracteres');
      for (const bueno of ['abc', 'nivel-inicial', 'ley-27-2024']) {
        expect(motivoDeSlug(bueno, '')).withContext(bueno).toBeNull();
      }
    });

    it('editando, un slug viejo mal formado no bloquea mientras no se lo cambie', () => {
      expect(motivoDeSlug('Tramites__viejos-', 'Tramites__viejos-')).toBeNull();
      expect(motivoDeSlug('viejos-', 'Tramites__viejos-')).toContain('Los guiones van solo entre palabras');
    });

    it('en un alta el slug sigue al nombre; en edición no', () => {
      const slug = (categoria: CategoriaVM | null) => camposDeCategoria(CATEGORIAS, categoria).find((f) => f.name === 'slug')!;
      expect(slug(null).derivado).toEqual(jasmine.objectContaining({ de: 'nombre', seguir: true, accion: 'Usar el del nombre' }));
      expect(slug(INSC).derivado?.seguir).toBeFalse();
      expect(slug(null).derivado!.transform('Automotor, transporte y tránsito')).toBe('automotor-transporte-y-transito');
    });
  });

  describe('dentro de FormDialogComponent', () => {
    let d: FormDialogDePrueba;
    const abrir = async (categoria: CategoriaVM | null, parentId: string | null = null, categorias = CATEGORIAS): Promise<void> => {
      TestBed.resetTestingModule();
      d = await montarFormDialog(dialogoDeCategoria(facade, categorias, categoria, parentId));
    };
    const usarElDelNombre = (): HTMLButtonElement | null => d.el.querySelector<HTMLButtonElement>('.form-field__fila button');
    const ruta = (): string => d.textoDe('.categoria-ubicacion__ruta').replace(/\s/g, '');

    it('en un alta el slug sigue al nombre hasta que el usuario lo edita', async () => {
      await abrir(null);
      d.tipear('nombre', 'Automotor, transporte y tránsito');
      expect(d.form().get('slug')!.value).toBe('automotor-transporte-y-transito');

      d.tipear('slug', 'autos');
      d.tipear('nombre', 'Automotor');
      expect(d.form().get('slug')!.value).toBe('autos');
      expect(usarElDelNombre()!.textContent!.trim()).toBe('Usar el del nombre');

      usarElDelNombre()!.click();
      d.fixture.detectChanges();
      expect(d.form().get('slug')!.value).toBe('automotor');
      expect(usarElDelNombre()).toBeNull();
      // El botón desapareció: el foco queda en el slug, no en `body`.
      expect(document.activeElement?.id).toBe('slug');
      d.tipear('nombre', 'Automotores');
      expect(d.form().get('slug')!.value).toBe('automotores');
    });

    it('editando no toca el slug al cambiar el nombre y no guarda sin cambios', async () => {
      await abrir(INSC);
      expect(d.guardar().textContent!.trim()).toBe('Guardar cambios');
      expect(d.guardar().getAttribute('aria-disabled')).toBe('true');
      expect(d.guardar().disabled).toBeFalse();
      expect(d.guardar().type).toBe('button');
      expect(usarElDelNombre()).toBeNull();

      d.tipear('nombre', 'Inscripciones escolares');
      expect(d.form().get('slug')!.value).toBe('inscripciones');
    });

    it('edición: "Usar el del nombre" aparece al cambiar el nombre y deja el slug como cambio a guardar', async () => {
      await abrir(INSC);
      d.tipear('nombre', 'Inscripciones escolares');

      usarElDelNombre()!.click();
      d.fixture.detectChanges();

      expect(d.form().get('slug')!.value).toBe('inscripciones-escolares');
      expect(d.form().get('slug')!.dirty).toBeTrue();
      expect(usarElDelNombre()).toBeNull();
    });

    it('edición: abre con los valores de la categoría y guarda con `update`', async () => {
      await abrir(INSC);
      expect(d.form().getRawValue()).toEqual({ nombre: 'Inscripciones', slug: 'inscripciones', parentId: 'edu' });
      facade.update.and.returnValue(of(INSC));

      d.tipear('nombre', 'Inscripciones escolares');
      await d.enviar();

      expect(facade.update).toHaveBeenCalledOnceWith('insc', { nombre: 'Inscripciones escolares', slug: 'inscripciones', parentId: 'edu' });
      expect(d.close).toHaveBeenCalledOnceWith(INSC);
    });

    it('guarda el alta de una subcategoría (nombre recortado, padre de la fila) y cierra devolviendo la categoría', async () => {
      await abrir(null, 'salud');
      const guardada: CategoriaVM = { id: 'nueva', parentId: 'salud', slug: 'turnos', nombre: 'Turnos' };
      facade.create.and.returnValue(of(guardada));
      expect(d.guardar().textContent!.trim()).toBe('Crear categoría');

      d.tipear('nombre', '  Turnos ');
      await d.enviar();

      expect(facade.create).toHaveBeenCalledOnceWith({ nombre: 'Turnos', slug: 'turnos', parentId: 'salud' });
      expect(d.close).toHaveBeenCalledOnceWith(guardada);
    });

    it('sin padre elegido envía `parentId: null`', async () => {
      await abrir(null);
      facade.create.and.returnValue(of(CATEGORIAS[0]));
      d.tipear('nombre', 'Salud');
      await d.enviar();
      expect(facade.create).toHaveBeenCalledOnceWith({ nombre: 'Salud', slug: 'salud', parentId: null });
    });

    it('editando, un padre que no está en el listado se conserva en vez de mandarla a la raíz', async () => {
      const huerfana: CategoriaVM = { id: 'x', parentId: 'borrada', slug: 'equis', nombre: 'Equis' };
      await abrir(huerfana, null, [...CATEGORIAS, huerfana]);
      expect(d.form().get('parentId')!.value).toBe('borrada');
    });

    it('editando, un slug viejo mal formado no bloquea el guardado mientras no se lo cambie', async () => {
      const vieja: CategoriaVM = { id: 'v', parentId: null, slug: 'Tramites__viejos-', nombre: 'Viejos' };
      await abrir(vieja, null, [...CATEGORIAS, vieja]);
      expect(d.form().get('slug')!.valid).toBeTrue();
      d.tipear('slug', 'viejos-');
      expect(d.errores()).toEqual(['Los guiones van solo entre palabras: ni al principio, ni al final, ni dos seguidos']);
    });

    it('etiquetas, ayudas y placeholders de los tres campos', async () => {
      await abrir(null);
      expect(d.etiquetas()).toEqual(['Nombre *', 'Slug *', 'Categoría padre (opcional)']);
      expect(d.el.querySelector<HTMLInputElement>('#nombre')!.placeholder).toBe('Ej: Automotor, transporte y tránsito');
      expect(d.el.querySelector<HTMLInputElement>('#slug')!.placeholder).toBe('Ej: automotor-transporte');
      expect(d.el.querySelector('#slug')!.classList).toContain('form-field__mono');
      expect(d.el.textContent).toContain('Se arma solo con el nombre. Podés cambiarlo: minúsculas, números y guiones, sin repetir.');
      expect(d.el.textContent).toContain('0 / 100');
      expect(d.textoDe('#parentId-ayuda')).toBe('Sin padre queda como categoría de primer nivel.');

      await abrir(INSC);
      expect(d.el.textContent).toContain('Minúsculas, números y guiones. No puede repetirse entre categorías.');
    });

    it('textos de los errores de nombre y slug', async () => {
      await abrir(null);
      const caso = (nombre: string, slug: string): string[] => {
        d.tipear('nombre', nombre);
        d.tipear('slug', slug);
        return d.errores();
      };
      expect(caso('', '')).toEqual(['El nombre es obligatorio', 'El slug es obligatorio']);
      expect(caso('   ', 'abc')).toEqual(['El nombre es obligatorio']);
      expect(caso('a  ', 'ab')).toEqual(['Tiene que tener al menos 3 caracteres', 'Tiene que tener al menos 3 caracteres']);
      expect(caso('Salud', 'Sa lud')).toEqual(['Solo minúsculas, números y guiones']);
      expect(caso('Salud', 'sa--lud')).toEqual(['Los guiones van solo entre palabras: ni al principio, ni al final, ni dos seguidos']);
    });

    it('enviar inválido no guarda: lista qué revisar en el resumen, que recibe el foco', async () => {
      await abrir(null);
      await d.enviar();

      expect(facade.create).not.toHaveBeenCalled();
      const resumen = d.el.querySelector<HTMLElement>('.form-error-banner[role="group"]')!;
      expect(resumen.textContent).toContain('Nombre (El nombre es obligatorio)');
      expect(resumen.textContent).toContain('Slug (El slug es obligatorio)');
      expect(document.activeElement).toBe(resumen);
    });

    it('un slug repetido se marca en el campo, con el foco ahí y el motivo en el banner; el diálogo queda abierto', async () => {
      await abrir(null);
      facade.create.and.returnValue(throwError(() => ({ error: { code: API_CODES.ENTITY_CONFLICT } })));
      d.tipear('nombre', 'Salud');
      await d.enviar();

      expect(d.form().get('slug')!.getError('server')).toBe('Ya existe una categoría con ese slug');
      expect(d.errores()).toEqual(['Ya existe una categoría con ese slug']);
      expect(document.activeElement?.id).toBe('slug');
      expect(d.banner()).toContain('No se pudo guardar');
      expect(d.banner()).toContain('Revisá el campo marcado.');
      expect(d.close).not.toHaveBeenCalled();
      expect(d.guardar().disabled).toBeFalse();
    });

    it('un padre descendiente (4075) se marca en "Categoría padre"; un error sin código va al banner con texto propio', async () => {
      await abrir(INSC);
      d.tipear('nombre', 'Inscripciones 2');
      facade.update.and.returnValue(throwError(() => ({ error: { code: API_CODES.CATEGORY_PARENT_IS_DESCENDANT, message: 'crudo' } })));
      await d.enviar();
      expect(d.form().get('parentId')!.getError('server'))
        .toBe('Esa categoría es una subcategoría de esta: no puede ser su padre. Elegí otra.');

      d.elegir('parentId', 'salud');
      facade.update.and.returnValue(throwError(() => ({ error: { message: 'crudo' } })));
      await d.enviar();
      expect(d.banner()).toContain('No se pudo guardar la categoría. Intentá de nuevo.');
      expect(d.banner()).not.toContain('crudo');
    });

    it('la franja de ubicación muestra la ruta, el nombre y el slug mientras se escribe', async () => {
      await abrir(null, 'insc');
      expect(ruta()).toBe('Ubicación:Educación,dentro:Inscripciones,dentro:Nuevacategoría');
      expect(d.textoDe('.categoria-ubicacion__slug')).toBe('El slug se arma con el nombre');

      d.tipear('nombre', 'Nivel primario');
      expect(d.textoDe('.categoria-ubicacion__ruta strong')).toBe('Nivel primario');
      expect(d.textoDe('.categoria-ubicacion__slug')).toBe('/nivel-primario');

      d.elegir('parentId', '');
      expect(ruta()).toBe('Ubicación:Nivelprimario');
    });

    it('al abrir, el foco va al nombre', async () => {
      await abrir(null);
      expect(document.activeElement?.id).toBe('nombre');
    });

    it('cierre: sin cambios cierra directo; con cambios pregunta con su texto y "Seguir editando" no cierra', async () => {
      await abrir(null);
      await d.cerrar();
      expect(d.confirmacion).not.toHaveBeenCalled();
      expect(d.close).toHaveBeenCalledTimes(1);

      d.tipear('nombre', 'Algo');
      await d.cerrar();
      expect(d.confirmacion.calls.mostRecent().args[1].data.message).toBe('Hay datos sin guardar. Si cerrás ahora no se crea la categoría.');
      expect(d.close).toHaveBeenCalledTimes(1);

      d.confirmacion.and.returnValue({ afterClosed: () => of(true) });
      await d.cerrar();
      expect(d.close).toHaveBeenCalledTimes(2);
    });
  });
});
