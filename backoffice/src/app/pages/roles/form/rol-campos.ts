import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { RolFormValue, RolVM, RoleScopeType } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { MembreteDato } from '@shared/components/membrete/membrete.component';

/**
 * El formulario de rol (alta y edición) descrito para `<app-dynamic-form [paneles]>`: campos, paneles, valor
 * inicial, payload y lo que el membrete y el pie derivan del valor en vivo. Funciones puras.
 */

/** Largo máximo de `code` y `description` en el backend. */
export const MAX_CODIGO_ROL = 100;
export const MAX_DESCRIPCION_ROL = 255;

/** Campo sin control que, en el alta, ocupa el lugar del interruptor "Rol activo". */
export const CAMPO_ACTIVO_AL_CREAR = 'activoAlCrear';

/**
 * Valor del formulario tal como lo maneja el motor (el código todavía sin limpiar). Es un alias y no la
 * interfaz `RolFormValue` para poder entregarlo como `initialData` (`Record<string, unknown>`).
 */
export type RolFormulario = { [K in keyof RolFormValue]: RolFormValue[K] };

/** Ayuda del select de alcance, según el valor elegido. */
const AYUDA_ALCANCE: Record<RoleScopeType, string> = {
  global: 'Vale para todo el backoffice.',
  organismo: 'Vale solo dentro del organismo del usuario.',
};

const OBLIGATORIO = 'Este campo es obligatorio';

/**
 * Mayúsculas y sin espacios (cada hueco pasa a `_`): el formato de los códigos de rol. El largo puede
 * crecer: `toUpperCase` pasa `ß` a `SS`.
 */
export function normalizarCodigoRol(valor: string): string {
  return valor.toUpperCase().replace(/\s/g, '_');
}

/**
 * El código tal como viaja al backend y se ve en el membrete: normalizado y sin `_` en los extremos
 * (escribir "editor " deja un `_` de relleno que no es parte del código).
 */
export function codigoRolFinal(valor: string): string {
  return normalizarCodigoRol(valor).replace(/^_+|_+$/g, '');
}

/**
 * Campos del formulario. `alcance` es el valor actual del select: su ayuda depende de él, así que la página
 * vuelve a pedir los campos cuando cambia (`(valueChanges)` del motor).
 *
 * En el alta `active` no es editable (el backend crea el rol activo e ignora el campo en el POST): el control
 * existe y viaja en `true`, pero no figura en ningún panel; en su lugar va la fila informativa
 * `CAMPO_ACTIVO_AL_CREAR`, que dibuja la página.
 */
export function camposDeRol(esEdicion: boolean, alcance: RoleScopeType): FieldConfig[] {
  return [
    {
      name: 'codigo', label: 'Código', type: 'text', mono: true, placeholder: 'Ej: EDITOR_TRAMITES',
      hint: 'Sin espacios, en mayúsculas', transformar: normalizarCodigoRol,
      validations: {
        required: true,
        maxLength: MAX_CODIGO_ROL,
        // Un código que queda vacío tras limpiarlo (solo guiones bajos) cuenta como no escrito.
        validar: (valor) => (codigoRolFinal(valor) ? null : OBLIGATORIO),
      },
    },
    {
      name: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ej: Editor de trámites',
      hint: 'Es el nombre con el que se ve el rol en Usuarios.',
      validations: { required: true, maxLength: MAX_DESCRIPCION_ROL },
    },
    {
      name: 'scopeTipo', label: 'Alcance', type: 'select', value: 'global',
      options: [{ id: 'global', name: 'Global' }, { id: 'organismo', name: 'Organismo' }], optionsLoaded: true,
      hint: AYUDA_ALCANCE[alcance] ?? '',
      validations: { required: true },
    },
    {
      name: 'asignablePorOrgAdmin', label: 'Asignable por Administrador de Organismo', type: 'checkbox', value: false,
      hint: 'Un administrador de organismo puede darle este rol a sus usuarios.',
    },
    {
      name: 'asignablePorBackoffice', label: 'Asignable por Administrador de Backoffice', type: 'checkbox', value: false,
      hint: 'Un administrador de backoffice puede darle este rol a un usuario.',
    },
    {
      name: 'active', label: 'Rol activo', type: 'checkbox', value: true,
      hint: 'Un rol inactivo queda guardado pero fuera de uso.',
    },
    ...(esEdicion ? [] : [{ name: CAMPO_ACTIVO_AL_CREAR, label: 'El rol se crea activo', type: 'vista' } satisfies FieldConfig]),
    // La grilla de permisos la dibuja la página (`appCampoPropio`).
    { name: 'permissionsIds', label: 'Permisos', type: 'custom', value: [] },
  ];
}

/** Los dos paneles de la tarjeta: datos | permisos. `resumen` es el total del panel de permisos ("3 de 61 asignados"). */
export function panelesDeRol(esEdicion: boolean, resumen: string): PanelDeFormulario[] {
  return [
    {
      id: 'rolform-datos', titulo: 'Datos del rol',
      subtitulo: esEdicion ? 'Los cambios se aplican al guardar' : 'Completá los datos para crear el rol',
      campos: ['codigo', 'descripcion', 'scopeTipo'],
      // Misma cantidad de filas en alta y en edición: el panel mide igual y el de permisos muestra lo mismo.
      opciones: ['asignablePorOrgAdmin', 'asignablePorBackoffice', esEdicion ? 'active' : CAMPO_ACTIVO_AL_CREAR],
    },
    {
      id: 'rolform-permisos', titulo: 'Permisos', subtitulo: 'Qué puede hacer quien tenga este rol.',
      total: resumen, lateral: true, acotado: true, cuerpo: 'libre', campos: ['permissionsIds'],
    },
  ];
}

/** Valor con el que arranca el formulario: el rol en edición, o los valores por defecto del alta. */
export function valorInicialDeRol(rol: RolVM | null): RolFormulario {
  if (!rol) {
    return {
      codigo: '', descripcion: '', scopeTipo: 'global', asignablePorOrgAdmin: false, asignablePorBackoffice: false,
      active: true, permissionsIds: [],
    };
  }
  return {
    codigo: rol.codigo,
    descripcion: rol.descripcion,
    scopeTipo: rol.scopeTipo,
    asignablePorOrgAdmin: rol.asignablePorOrgAdmin,
    asignablePorBackoffice: rol.asignablePorBackoffice,
    // El estado real del rol: fijarlo en `true` reactivaría en silencio un rol dado de baja.
    active: rol.activo,
    permissionsIds: rol.permisos.map((permiso) => permiso.id),
  };
}

/** El valor crudo del motor (`Record<string, unknown>`), tipado. No cambia nada de lo escrito. */
export function valorDeRol(crudo: Record<string, unknown>): RolFormulario {
  const permisos: unknown = crudo['permissionsIds'];
  return {
    codigo: String(crudo['codigo'] ?? ''),
    descripcion: String(crudo['descripcion'] ?? ''),
    scopeTipo: String(crudo['scopeTipo'] ?? 'global') as RoleScopeType,
    asignablePorOrgAdmin: crudo['asignablePorOrgAdmin'] === true,
    asignablePorBackoffice: crudo['asignablePorBackoffice'] === true,
    active: crudo['active'] === true,
    permissionsIds: Array.isArray(permisos) ? permisos.map(String) : [],
  };
}

/** Lo que se manda al guardar: el código limpio; la descripción, tal como se escribió. */
export function rolFormValueDe(crudo: Record<string, unknown>): RolFormValue {
  const valor = valorDeRol(crudo);
  return { ...valor, codigo: codigoRolFinal(valor.codigo) };
}

/** Lo que el membrete, el total del panel de permisos y el pie derivan del valor en vivo. */
export interface VistaRol {
  titulo: string;
  activo: boolean;
  /** Línea meta del membrete: código, alcance y cantidad de permisos. */
  datos: MembreteDato[];
  /** Permisos otorgados que existen en el catálogo. */
  otorgados: number;
  /** "3 de 61 asignados". */
  resumen: string;
  /** Texto del indicador del pie. */
  indicador: string;
}

export function vistaDeRol(valor: RolFormulario, permisos: PermisoVM[]): VistaRol {
  const ids = new Set(valor.permissionsIds);
  const otorgados = permisos.filter((permiso) => ids.has(permiso.id)).length;
  return {
    titulo: valor.descripcion.trim(),
    activo: valor.active,
    datos: [
      { codigo: true, texto: codigoRolFinal(valor.codigo) || 'SIN_CODIGO' },
      { icono: 'globe-simple', texto: valor.scopeTipo === 'global' ? 'Alcance global' : 'Por organismo' },
      { icono: 'key', texto: otorgados === 1 ? '1 permiso' : `${otorgados} permisos` },
    ],
    otorgados,
    resumen: `${otorgados} de ${permisos.length} asignados`,
    indicador: otorgados === 0
      ? 'Sin permisos: el rol no va a poder hacer nada'
      : otorgados === 1 ? '1 permiso asignado' : `${otorgados} permisos asignados`,
  };
}
