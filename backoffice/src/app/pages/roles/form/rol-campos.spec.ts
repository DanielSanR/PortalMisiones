import { RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import {
  CAMPO_ACTIVO_AL_CREAR, RolFormulario, camposDeRol, codigoRolFinal, normalizarCodigoRol, panelesDeRol, rolFormValueDe, valorDeRol,
  valorInicialDeRol, vistaDeRol,
} from './rol-campos';

const PERMISOS: PermisoVM[] = [
  { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
  { id: 'p-2', codigo: 'CREATE_USER', descripcion: 'Crear usuarios' },
];

const ROL: RolVM = {
  id: 'r-1', codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
  asignablePorBackoffice: false, activo: false, permisos: [PERMISOS[0]],
};

describe('normalizarCodigoRol', () => {
  it('pasa a mayúsculas y cambia cada espacio por _', () => {
    expect(normalizarCodigoRol('editor de  trámites')).toBe('EDITOR_DE__TRÁMITES');
    expect(normalizarCodigoRol('ya_ok')).toBe('YA_OK');
  });

  it('el largo puede crecer: ß pasa a SS', () => {
    expect(normalizarCodigoRol('straße')).toBe('STRASSE');
  });

  it('es idempotente (lo exige `transformar` del motor)', () => {
    const una = normalizarCodigoRol(' editor straße ');
    expect(normalizarCodigoRol(una)).toBe(una);
  });
});

describe('codigoRolFinal', () => {
  it('recorta los espacios y los _ de los extremos, pero no los del medio', () => {
    expect(codigoRolFinal('editor ')).toBe('EDITOR');
    expect(codigoRolFinal('  editor de  tramites _')).toBe('EDITOR_DE__TRAMITES');
    expect(codigoRolFinal('__EDITOR__')).toBe('EDITOR');
  });

  it('un código de solo espacios o guiones queda vacío', () => {
    expect(codigoRolFinal('   ')).toBe('');
    expect(codigoRolFinal('___')).toBe('');
  });
});

describe('camposDeRol', () => {
  const campo = (nombre: string, esEdicion = true) => camposDeRol(esEdicion, 'global').find((c) => c.name === nombre)!;

  it('el código es monoespaciado, se normaliza al escribir y tiene tope de 100', () => {
    const codigo = campo('codigo');
    expect(codigo.type).toBe('text');
    expect(codigo.mono).toBeTrue();
    expect(codigo.transformar).toBe(normalizarCodigoRol);
    expect(codigo.validations?.required).toBeTrue();
    expect(codigo.validations?.maxLength).toBe(100);
  });

  it('un código de solo guiones bajos cuenta como no escrito; uno con contenido pasa', () => {
    const validar = campo('codigo').validations!.validar!;
    expect(validar('___')).toBe('Este campo es obligatorio');
    expect(validar('')).toBe('Este campo es obligatorio');
    expect(validar('_EDITOR_')).toBeNull();
  });

  it('la descripción es obligatoria con tope de 255', () => {
    expect(campo('descripcion').validations).toEqual({ required: true, maxLength: 255 });
  });

  it('el alcance ofrece Global y Organismo, y su ayuda depende del valor elegido', () => {
    expect(campo('scopeTipo').options).toEqual([{ id: 'global', name: 'Global' }, { id: 'organismo', name: 'Organismo' }]);
    expect(campo('scopeTipo').optionsLoaded).toBeTrue();
    expect(campo('scopeTipo').hint).toBe('Vale para todo el backoffice.');
    expect(camposDeRol(true, 'organismo').find((c) => c.name === 'scopeTipo')!.hint).toBe('Vale solo dentro del organismo del usuario.');
  });

  it('los tres interruptores llevan su explicación', () => {
    expect(['asignablePorOrgAdmin', 'asignablePorBackoffice', 'active'].map((n) => [campo(n).type, !!campo(n).hint]))
      .toEqual([['checkbox', true], ['checkbox', true], ['checkbox', true]]);
  });

  it('en el alta `active` sigue siendo un control (viaja en true) y se suma la fila informativa, sin control', () => {
    expect(campo('active', false).value).toBeTrue();
    expect(campo(CAMPO_ACTIVO_AL_CREAR, false).type).toBe('vista');
    expect(campo(CAMPO_ACTIVO_AL_CREAR, true)).toBeUndefined();
  });

  it('los permisos son un campo propio de la página, que arranca vacío', () => {
    expect(campo('permissionsIds').type).toBe('custom');
    expect(campo('permissionsIds').value).toEqual([]);
  });
});

describe('panelesDeRol', () => {
  it('edición: datos con los tres interruptores al pie y permisos como panel lateral acotado, con su total', () => {
    const [datos, permisos] = panelesDeRol(true, '1 de 2 asignados');

    expect(datos.id).toBe('rolform-datos');
    expect(datos.subtitulo).toBe('Los cambios se aplican al guardar');
    expect(datos.campos).toEqual(['codigo', 'descripcion', 'scopeTipo']);
    expect(datos.opciones).toEqual(['asignablePorOrgAdmin', 'asignablePorBackoffice', 'active']);
    expect(permisos).toEqual(jasmine.objectContaining({
      id: 'rolform-permisos', titulo: 'Permisos', total: '1 de 2 asignados', lateral: true, acotado: true, cuerpo: 'libre',
      campos: ['permissionsIds'],
    }));
  });

  it('alta: en el lugar de "Rol activo" va la fila informativa, y el subtítulo invita a completar', () => {
    const [datos] = panelesDeRol(false, '0 de 2 asignados');
    expect(datos.subtitulo).toBe('Completá los datos para crear el rol');
    expect(datos.opciones).toEqual(['asignablePorOrgAdmin', 'asignablePorBackoffice', CAMPO_ACTIVO_AL_CREAR]);
  });

  it('todo campo que nombra un panel existe en `camposDeRol`', () => {
    for (const esEdicion of [true, false]) {
      const nombres = camposDeRol(esEdicion, 'global').map((c) => c.name);
      const usados = panelesDeRol(esEdicion, '').flatMap((p) => [...p.campos.flat(), ...(p.opciones ?? [])]);
      expect(usados.filter((n) => !nombres.includes(n))).toEqual([]);
    }
  });
});

describe('valorInicialDeRol', () => {
  it('alta: vacío, alcance global, sin asignables, activo y sin permisos', () => {
    expect(valorInicialDeRol(null)).toEqual({
      codigo: '', descripcion: '', scopeTipo: 'global', asignablePorOrgAdmin: false, asignablePorBackoffice: false,
      active: true, permissionsIds: [],
    });
  });

  it('edición: el rol tal cual, con su estado real (no reactiva un rol inactivo) y los ids de sus permisos', () => {
    expect(valorInicialDeRol(ROL)).toEqual({
      codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
      asignablePorBackoffice: false, active: false, permissionsIds: ['p-1'],
    });
  });
});

describe('valorDeRol / rolFormValueDe', () => {
  const CRUDO: RolFormulario = {
    codigo: '_EDITOR_DE_TRAMITES_', descripcion: '  Editor  ', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
    asignablePorBackoffice: false, active: true, permissionsIds: ['p-2', 'p-1'],
  };

  it('`valorDeRol` tipa el valor del motor sin cambiar lo escrito', () => {
    expect(valorDeRol(CRUDO)).toEqual(CRUDO);
  });

  it('`valorDeRol` tolera un valor incompleto', () => {
    expect(valorDeRol({})).toEqual({
      codigo: '', descripcion: '', scopeTipo: 'global', asignablePorOrgAdmin: false, asignablePorBackoffice: false,
      active: false, permissionsIds: [],
    });
  });

  it('`rolFormValueDe` limpia el código y deja la descripción y el orden de los permisos como están', () => {
    expect(rolFormValueDe(CRUDO)).toEqual({ ...CRUDO, codigo: 'EDITOR_DE_TRAMITES' });
  });
});

describe('vistaDeRol', () => {
  const valor = valorInicialDeRol(ROL);

  it('arma el membrete con el código limpio, el alcance y la cantidad de permisos', () => {
    const vista = vistaDeRol({ ...valor, codigo: '_EDITOR_', descripcion: ' Editor ' }, PERMISOS);
    expect(vista.titulo).toBe('Editor');
    expect(vista.activo).toBeFalse();
    expect(vista.datos).toEqual([
      { codigo: true, texto: 'EDITOR' },
      { icono: 'globe-simple', texto: 'Por organismo' },
      { icono: 'key', texto: '1 permiso' },
    ]);
  });

  it('sin código ni permisos lo dice: SIN_CODIGO, "0 permisos" y el aviso del pie', () => {
    const vista = vistaDeRol(valorInicialDeRol(null), PERMISOS);
    expect(vista.datos.map((d) => d.texto)).toEqual(['SIN_CODIGO', 'Alcance global', '0 permisos']);
    expect(vista.resumen).toBe('0 de 2 asignados');
    expect(vista.indicador).toBe('Sin permisos: el rol no va a poder hacer nada');
  });

  it('cuenta en singular y en plural, y solo los permisos que existen en el catálogo', () => {
    expect(vistaDeRol(valor, PERMISOS).indicador).toBe('1 permiso asignado');
    const dos = vistaDeRol({ ...valor, permissionsIds: ['p-1', 'p-2', 'fuera-del-catalogo'] }, PERMISOS);
    expect(dos.otorgados).toBe(2);
    expect(dos.resumen).toBe('2 de 2 asignados');
    expect(dos.indicador).toBe('2 permisos asignados');
  });
});
