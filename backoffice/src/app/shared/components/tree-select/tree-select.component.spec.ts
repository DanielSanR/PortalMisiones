import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeFieldConfig } from '@core/models/field.interface';
import { TreeRow, TreeSelectComponent } from './tree-select.component';

const CONFIG: TreeFieldConfig = {
  emptyLabel: 'Sin organismo superior',
  emptyMeta: 'Queda como organismo raíz',
  searchLabel: 'Buscar por nombre o sigla',
  loaded: true,
  // Se edita "sgi" (cuelga de "vice"); "datos" depende de él; "eprac" está inactivo.
  self: { id: 'sgi', label: 'Subsecretaría de Gobierno Inteligente', tag: 'Este organismo' },
  nodes: [
    { id: 'vice', label: 'Vicegobernación', parentId: null },
    { id: 'datos', label: 'Dirección de Datos Abiertos', parentId: 'sgi', disabledReason: 'Depende de este' },
    { id: 'msp', label: 'Ministerio de Salud Pública', parentId: null, keywords: 'MSP' },
    { id: 'saps', label: 'Subsecretaría de Atención Primaria', parentId: 'msp' },
    { id: 'eprac', label: 'Ente Regulador de Electricidad', parentId: null, disabledReason: 'Inactivo' },
  ],
};

/** Fila resumida: `>` por nivel, `*` si está elegida, `[self]` para la entidad en edición. */
const resumen = (rows: TreeRow[]) =>
  rows.map((r) => `${'>'.repeat(r.depth)}${r.kind === 'self' ? '[self]' : r.label}${r.selected ? '*' : ''}`);

describe('TreeSelectComponent', () => {
  let fixture: ComponentFixture<TreeSelectComponent>;
  let component: TreeSelectComponent;
  let cambios: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TreeSelectComponent] });
    fixture = TestBed.createComponent(TreeSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', CONFIG);
    fixture.componentRef.setInput('inputId', 'parentId');
    cambios = [];
    component.registerOnChange((valor) => cambios.push(valor));
    fixture.detectChanges();
  });

  it('dibuja la entidad debajo del nodo elegido y arrastra a sus hijos', () => {
    component.writeValue('vice');

    expect(resumen(component.rows)).toEqual([
      'Sin organismo superior',
      'Vicegobernación*',
      '>[self]',
      '>>Dirección de Datos Abiertos',
      'Ministerio de Salud Pública',
      '>Subsecretaría de Atención Primaria',
      'Ente Regulador de Electricidad',
    ]);
    expect(component.valueLabel).toBe('Vicegobernación');
  });

  it('sin valor, la entidad queda como raíz bajo la opción "ninguno"', () => {
    component.writeValue('');

    expect(resumen(component.rows).slice(0, 3)).toEqual([
      'Sin organismo superior*',
      '[self]',
      '>Dirección de Datos Abiertos',
    ]);
    expect(component.valueLabel).toBe('Sin organismo superior');
  });

  it('elegir un nodo emite su id; uno no elegible o la propia entidad no emiten nada', () => {
    component.writeValue('vice');
    const fila = (label: string) => component.rows.find((r) => r.label === label)!;

    component.pick(fila('Ente Regulador de Electricidad'));
    component.pick(fila('Dirección de Datos Abiertos'));
    component.pick(component.rows.find((r) => r.kind === 'self')!);
    expect(cambios).toEqual([]);

    component.pick(fila('Subsecretaría de Atención Primaria'));
    expect(cambios).toEqual(['saps']);
    expect(resumen(component.rows)).toContain('>>[self]');
  });

  it('elegir "ninguno" emite cadena vacía', () => {
    component.writeValue('vice');
    component.pick(component.rows[0]);
    expect(cambios).toEqual(['']);
  });

  it('la búsqueda filtra por nombre o palabras clave y conserva el nodo elegido', () => {
    component.writeValue('vice');
    component.onSearch({ target: { value: 'msp' } } as unknown as Event);

    expect(resumen(component.rows)).toEqual([
      'Sin organismo superior',
      'Vicegobernación*',
      '>[self]',
      'Ministerio de Salud Pública',
    ]);
    expect(component.sinResultados).toBeFalse();

    component.onSearch({ target: { value: 'zzz' } } as unknown as Event);
    expect(component.sinResultados).toBeTrue();
  });

  it('un ciclo en los datos no cuelga el recorrido ni esconde nodos', () => {
    fixture.componentRef.setInput('config', {
      ...CONFIG,
      self: undefined,
      nodes: [
        { id: 'a', label: 'A', parentId: null },
        { id: 'b', label: 'B', parentId: 'c' },
        { id: 'c', label: 'C', parentId: 'b' },
      ],
    });
    fixture.detectChanges();

    // "b" y "c" se apuntan entre sí: ninguno es raíz, así que el primero se dibuja desde el nivel 0.
    expect(resumen(component.rows)).toEqual(['Sin organismo superior*', 'A', 'B', '>C']);
  });
});
