import type { Type } from '@angular/core';
import type { FormGroup } from '@angular/forms';

export interface FieldConfig {
  name: string;
  label: string;
  type:
  | 'text'
  | 'select'
  | 'textarea'
  | 'select-multiple'
  | 'checkbox'
  | 'datepicker'
  | 'url'
  | 'email'
  | 'password'
  | 'tip'
  | 'section-header'
  /** Desplegable con árbol y buscador para elegir un nodo de una jerarquía (ver `tree`). */
  | 'tree-select'
  /**
   * Contenido derivado de lo que se va cargando (dónde queda una categoría en el árbol, un enlace que depende
   * de dos campos). No tiene control: dibuja el componente de `vista` en su lugar de la grilla. Es el
   * equivalente de `custom` para un formulario en diálogo, donde no hay dónde proyectar. Por defecto solo lee;
   * con `vista.escribe` puede cambiar otros controles del formulario (un mapa que completa las coordenadas).
   */
  | 'vista'
  /**
   * Control en el `FormGroup` sin nada dibujado por el formulario: el widget lo pone la página y escribe el
   * valor en `form.get(name)`. Así un widget propio (p. ej. la grilla de permisos de un rol) participa de
   * `requireChanges`, del guard de cambios sin guardar y del valor enviado.
   *
   * Dónde se dibuja: la página proyecta `<ng-template appCampoPropio="<name>" let-grupo>…</ng-template>` dentro
   * de `<app-dynamic-form>` y el motor lo dibuja EN EL LUGAR del campo (su celda de la grilla o su panel). El
   * template recibe el `FormGroup` (`let-grupo`). Lo mismo vale para un campo `vista` sin `vista.componente`
   * (contenido propio de la pantalla que no tiene control). Sin template, lo proyectado suelto queda entre
   * los campos y los botones. Ejemplo real: `pages/roles/form/role-form.component.html`.
   */
  | 'custom';
  placeholder?: string;
  hint?: string;
  /** Agrega "(opcional)" a la etiqueta. Para formularios donde lo obligatorio es la mayoría. */
  opcional?: boolean;
  /** Filas mínimas de un `textarea` (por defecto 4). Crece solo hasta 16. */
  filas?: number;
  /** Teclado en pantalla de un campo `text` (`decimal` para un número que se escribe con coma). */
  inputMode?: 'decimal' | 'numeric' | 'tel';
  /**
   * Atributo `autocomplete` del control (`'off'`, `'email'`, `'new-password'`, `'street-address'`…). Para un
   * dato que NO es de quien lo escribe (las coordenadas de un punto de atención, el correo de otra persona),
   * `'off'` evita que el navegador ofrezca los suyos. Sin declararlo no se emite el atributo (decide el
   * navegador), salvo en un campo `mono`, que va con `'off'`. Vale en `text`, `email`, `url`, `password`
   * y `textarea`.
   */
  autocomplete?: string;
  /** Solo `tip`: `'alerta'` lo dibuja como advertencia (`.form-aviso`) en vez de la nota informativa. */
  tono?: 'alerta';
  cssClass?: 'colspan-full' | 'colspan-half' | 'colspan-third' | 'colspan-wide';
  disabled?: boolean;
  /**
   * Dato fijado que la persona no elige (p. ej. el organismo que impone su sesión). A diferencia de
   * `disabled`, el campo sigue en el orden de tabulación: se dibuja como un `<input readonly>` con el
   * valor legible (en un `select`, el nombre de la opción elegida), el `hint` —que acá es el MOTIVO—
   * queda asociado por `aria-describedby`, y no lleva la marca de obligatorio. El control sigue
   * habilitado: su valor (`value` / `initialData`) viaja en `form.value` como el de cualquier otro.
   * Vale para cualquier tipo con control; preferirlo a `disabled` siempre que haya un motivo que contar.
   *
   * Sus `validations` NO se aplican mientras sea de solo lectura (`DynamicFormComponent.getValidators`): son
   * reglas sobre lo que la persona ingresa, y acá no puede ingresar nada. Un `required` sobre un valor que
   * llegó vacío dejaría el envío bloqueado sin error visible ni forma de corregirlo. Si el dato fijado es
   * indispensable, quien arma el campo tiene que garantizarlo (o no ofrecer el formulario); el backend lo
   * valida igual. Si el campo deja de ser `readonly`, sus validaciones vuelven a regir.
   */
  readonly?: boolean;
  /** El valor es un identificador técnico (`CREATE_PROCEDURE`): se escribe en monoespaciada. Solo `text`. */
  mono?: boolean;
  /**
   * Transformación del valor MIENTRAS se escribe (mayúsculas y sin espacios para el código de un rol). Se
   * aplica en cada `input` conservando el cursor junto al mismo carácter, y no toca nada mientras un IME
   * compone. Debe ser pura e idempotente (`f(f(x)) === f(x)`). Solo `text`. Lo que cambia recién al GUARDAR
   * (recortes) va en `guardar` / el mapper, no acá. Ejemplo real: `pages/roles/form/rol-campos.ts`.
   */
  transformar?: (valor: string) => string;
  /**
   * Textos de un `select-multiple`: lo dibuja `app-seleccion-multiple` (encabezado con contador, chips de lo
   * elegido y lista con buscador al abrir "Cambiar"). El valor del control es `string[]` (ids de `options`).
   * Dentro de un mismo formulario solo queda abierta una lista a la vez. Admite `validations` (`required` =
   * al menos una opción, con su texto en `mensajes`): el error se ve bajo el grupo, asociado por
   * `aria-describedby` al grupo y a su botón, y entra al banner resumen.
   */
  seleccion?: FieldSeleccion;
  value?: unknown;
  options?: { id: string | number; name: string }[];
  /**
   * Marca que el catálogo del select ya se resolvió (lo setea `updateFormConfigOptions`).
   * Sin esto, un catálogo vacío es indistinguible de uno que todavía está cargando y el
   * select queda mostrando "Cargando opciones…" para siempre.
   */
  optionsLoaded?: boolean;
  /** Qué decirle al usuario si el catálogo llegó vacío (debería explicar cómo destrabarse). */
  emptyOptionsMessage?: string;
  /**
   * Vista previa derivada del valor tipeado, debajo del campo (p. ej. el slug como lo
   * canonicaliza el backend). Solo se muestra si el valor transformado no está vacío y
   * difiere de lo tipeado. Pensado para campos de texto; `transform` debe ser pura.
   */
  preview?: FieldPreview;
  /** Jerarquía y textos de un campo `tree-select`. */
  tree?: TreeFieldConfig;
  /** El valor sale de otro campo hasta que la persona lo edita (el slug, del nombre). Solo `text`. */
  derivado?: FieldDerivado;
  /**
   * Aviso que depende del valor, bajo el campo y dentro de su ayuda (`aria-describedby`): la consecuencia
   * de apagar un interruptor, antes de guardar. Devuelve `null` si no hay nada que avisar. Debe ser pura.
   * Solo `checkbox`.
   */
  aviso?: (valor: unknown) => FieldAviso | null;
  /** Opciones de un campo `datepicker`. */
  fecha?: FieldFecha;
  /** Componente que dibuja un campo `vista`. */
  vista?: FieldVista;
  validations?: FieldValidations;
}

/** Un nodo elegible (o visible pero no elegible) de un campo `tree-select`. */
export interface TreeOption {
  id: string;
  label: string;
  /** Dato secundario bajo el nombre (p. ej. el tipo de organismo). */
  meta?: string;
  /** `null` = raíz. Un padre que no está en la lista también se trata como raíz. */
  parentId: string | null;
  /** Texto de búsqueda adicional al `label` (p. ej. la sigla). */
  keywords?: string;
  /**
   * Por qué no se puede elegir. El nodo se muestra igual, con este motivo a la vista: ocultarlo
   * deja al usuario buscando algo que "debería estar".
   */
  disabledReason?: string;
}

export interface TreeFieldConfig {
  nodes: TreeOption[];
  /** Marca que el catálogo ya se resolvió (mismo criterio que `optionsLoaded`). */
  loaded?: boolean;
  /** Texto de la opción "ninguno" y del control cuando no hay nada elegido. */
  emptyLabel: string;
  /** Aclaración bajo la opción "ninguno" (p. ej. "Queda como organismo raíz"). */
  emptyMeta?: string;
  searchLabel: string;
  /**
   * La entidad que se está cargando o editando: se dibuja debajo del nodo elegido, para que se
   * vea dónde queda. `id` es el suyo cuando ya existe (sus hijos cuelgan de ella); `null` en un alta.
   */
  self?: { id: string | null; label: string; tag: string; /** Ícono Phosphor (sin `ph-`). Default: `buildings`. */ icon?: string };
}

/**
 * Valor derivado de otro campo. Ejemplo real: el slug de `pages/categorias/categoria-dialogo.ts`.
 * - `seguir` (alta): mientras el campo esté sin tocar, copia `transform(origen)` en cada cambio del origen,
 *   sin marcarlo como editado. En cuanto la persona lo edita, deja de seguir; si lo vacía a mano, vuelve a
 *   seguir (queda "sin tocar") y, si del origen sale algo, `accion` se ofrece para derivarlo ya.
 * - `accion`: texto del botón que vuelve a derivarlo ("Usar el del nombre"). Aparece al lado del campo
 *   cuando el valor ya no coincide con el derivado y la persona tocó algo: el propio campo si `seguir`,
 *   el campo de origen si no. Con `seguir` el campo vuelve a seguir al origen; sin `seguir` queda como un
 *   cambio a guardar.
 */
export interface FieldDerivado {
  /** `name` del campo de origen. */
  de: string;
  /** Debe ser pura. */
  transform: (valorDeOrigen: string) => string;
  seguir?: boolean;
  accion?: string;
}

export interface FieldAviso {
  texto: string;
  /** `'alerta'`: consecuencia que conviene pensar dos veces (ícono y color de advertencia). */
  tono?: 'info' | 'alerta';
}

/** Ejemplo real: la vigencia de `pages/tramites/adopciones/adoptar-dialogo.ts`. */
export interface FieldFecha {
  /** `name` de otro campo fecha: el calendario no deja elegir un día anterior al suyo. */
  minDe?: string;
  /** Nombre accesible del botón del calendario. Con dos fechas en el form, que cada uno diga cuál abre. */
  botonCalendario?: string;
  /** Texto del botón que vacía el campo ("Quitar la fecha de fin"); se muestra solo con una fecha cargada. */
  quitar?: string;
}

/**
 * Componente de un campo `vista`. Recibe `@Input()`s: `grupo` (el `FormGroup` del formulario, para derivar de
 * `valueChanges` lo que muestra), `datos` (lo que haya declarado el campo) y, solo si declara `escribe`,
 * `escribir`. Por defecto es de solo lectura.
 *
 * **Vista que escribe** (un widget propio dentro de un formulario en diálogo, donde no hay `appCampoPropio`):
 * `escribe` lista los `name` de los controles que puede cambiar, y el motor le entrega `escribir`
 * ({@link EscrituraDeVista}). No tiene control propio: escribe en controles que el formulario ya dibuja (y que
 * siguen siendo la forma de cargar el dato sin el widget). Cada valor que cambia queda dirty y touched como si lo
 * hubiera escrito la persona: habilita "Guardar" en una edición (`requiereCambios`), dispara la confirmación de
 * descarte al cerrar y muestra su error si el valor es inválido. Un `name` fuera de `escribe` se ignora (en
 * desarrollo se avisa por consola). Para leer, la vista sigue usando `grupo`.
 *
 * Ejemplo real: el mapa del punto de atención (`pages/tramites/fichas/components/puntos-atencion-panel/
 * punto-dialogo.ts` + `punto-ubicacion/`), que escribe `latitud` y `longitud`:
 *
 *   { name: '_ubicacion', label: 'Ubicación', type: 'vista',
 *     vista: { componente: PuntoUbicacionComponent, datos: { localidad }, escribe: ['latitud', 'longitud'] } }
 *
 *   export class PuntoUbicacionComponent implements VistaDeCampo {
 *     @Input({ required: true }) grupo!: FormGroup;
 *     @Input() escribir?: EscrituraDeVista;
 *     alMover(p: Coordenadas) { this.escribir?.({ latitud: formatear(p.latitud), longitud: formatear(p.longitud) }); }
 *   }
 */
export interface FieldVista {
  componente: Type<VistaDeCampo>;
  datos?: unknown;
  /**
   * `name` de los controles que la vista puede cambiar con `escribir`. Sin esto la vista solo lee. Un campo
   * fijado (`readonly` o `disabled`) no se escribe aunque esté acá: la persona tampoco podría cambiarlo (en
   * desarrollo se avisa por consola).
   */
  escribe?: readonly string[];
}

/**
 * Cambia controles del formulario desde una vista que declaró `escribe`: `{ latitud: '-27,36', longitud: '-55,89' }`.
 * Solo toca los valores que difieren del actual; cada uno queda dirty y touched antes de cambiar (así el aviso de
 * cambios del formulario ya lo ve modificado). Saltea los campos `readonly` o `disabled`.
 */
export type EscrituraDeVista = (valores: Record<string, unknown>) => void;

export interface VistaDeCampo {
  grupo: FormGroup;
  datos?: unknown;
  /** Lo entrega el motor solo si el campo declara `vista.escribe`. */
  escribir?: EscrituraDeVista;
}

export interface FieldPreview {
  /** Texto que antecede al valor, p. ej. "Se guardará como:". */
  label: string;
  transform: (valor: string) => string;
}
 
export interface FieldValidations {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  email?: boolean;
  patternErrorMessage?: string;
  /**
   * Texto propio para un error de este campo, por clave de error (`required`, `minlength`, `maxlength`,
   * `email`, `pattern`…): "El nombre es obligatorio" en vez del genérico "Este campo es obligatorio".
   * Lo que no se declara acá usa el mensaje común de `form-error-messages.util`.
   */
  mensajes?: Record<string, string>;
  /**
   * Regla propia del campo que las demás no cubren (p. ej. "el slug que sale del nombre es muy corto").
   * Recibe el valor como texto y devuelve el mensaje a mostrar, o `null` si está bien. Debe ser pura y
   * mirar solo ESTE valor: no se vuelve a evaluar cuando cambia otro campo. Su error (`personalizado`) se
   * muestra antes que el de `validarCon`.
   */
  validar?: (valor: string) => string | null;
  /**
   * Regla que mira OTROS campos ("hasta" no puede ser anterior a "desde"). `validar` recibe el valor del
   * campo y el de todo el formulario, y devuelve el mensaje o `null`. Se vuelve a evaluar cuando cambia
   * cualquiera de `campos`; si este campo ya tiene valor, el error se muestra sin esperar a que se lo toque.
   * Debe ser pura. Ejemplo real: `pages/tramites/adopciones/adoptar-dialogo.ts`.
   *
   * - **Prioridad**: su error va en una clave propia (`entreCampos`), distinta de la de `validar`
   *   (`personalizado`). Si fallan las dos se ve la de `validar`: primero se corrige el valor del propio campo
   *   y recién después su relación con los otros (`FORM_ERROR_PRIORITY`).
   * - **Pierde el error de servidor**: al cambiar cualquiera de `campos` este campo se revalida
   *   (`updateValueAndValidity`), y eso recalcula sus errores desde los validadores: un error que el backend
   *   marcó en él con `setErrors({ server })` desaparece aunque su valor no haya cambiado. Es lo esperado
   *   cuando el rechazo dependía de ese otro campo (un solapamiento de fechas); el banner de guardado sigue
   *   a la vista hasta el próximo envío. Fuera de ese caso el error de servidor se conserva mientras el valor
   *   rechazado siga en el campo: el motor lo guarda como un validador más (`reglaDeRechazo`), así que re-entregar
   *   `fields` (la página recalcula los campos por un cambio en otro campo) no lo borra; editar el campo, sí. No
   *   rige si el campo pasa a `readonly` o `disabled` (no habría forma de corregirlo).
   */
  validarCon?: {
    campos: string[];
    validar: (valor: unknown, valores: Record<string, unknown>) => string | null;
  };
}

/** Ejemplo real: las categorías de `pages/tramites/plantillas/form/plantilla-campos.ts`. */
export interface FieldSeleccion {
  /** Nombre del catálogo en minúscula, para los textos accesibles ("categorías"). */
  nombre: string;
  /** Lo que se dice sin nada elegido ("Ninguna categoría elegida."). */
  textoVacio?: string;
}

/**
 * Un panel de un formulario de página de dos paneles (`<app-dynamic-form [paneles]>`): la tarjeta
 * `.ficha-paneles` con una sección por panel (título, subtítulo, contador) y el pie de guardar integrado
 * abarcando todos. Sin `paneles` el motor dibuja la grilla de siempre. Un campo que no figura en ningún panel
 * no se dibuja (pero su control existe y viaja).
 *
 * Las variantes (`cuerpo`, `acotado`, `lateral`) son los modificadores de la familia global `.ficha-paneles`
 * (`shared-styles/_components.scss`), los mismos que usan a mano los detalles y la ficha por localidad; el
 * motor solo los expone. Qué cuerpo elegir, según lo que va en el panel:
 *
 * - Campos sueltos (+ interruptores al pie): `cuerpo` omitido (`'campos'`) + `opciones`.
 *   "Datos del rol" (`rol-campos.ts`), "Datos de la plantilla" (`plantilla-campos.ts`).
 * - Varios catálogos de selección múltiple, cada uno en su bloque: `cuerpo: 'grupos'`. "Clasificación"
 *   (`plantilla-campos.ts`).
 * - Un widget propio que se dibuja entero: `cuerpo: 'libre'` + campo `custom`. "Permisos" (`rol-campos.ts`).
 * - Una lista larga que no debe estirar la tarjeta: `acotado: true` (con `'libre'`). "Permisos" (scroll interno).
 *
 * Ejemplo real (`pages/roles/form/rol-campos.ts`):
 *
 *   export function panelesDeRol(esEdicion: boolean, resumen: string): PanelDeFormulario[] {
 *     return [
 *       { id: 'rolform-datos', titulo: 'Datos del rol', subtitulo: esEdicion ? 'Los cambios se aplican al guardar' : '…',
 *         campos: ['codigo', 'descripcion', 'scopeTipo'], opciones: ['asignablePorOrgAdmin', 'asignablePorBackoffice', 'active'] },
 *       { id: 'rolform-permisos', titulo: 'Permisos', subtitulo: 'Qué puede hacer quien tenga este rol.',
 *         total: resumen, lateral: true, acotado: true, cuerpo: 'libre', campos: ['permissionsIds'] },
 *     ];
 *   }
 *
 *   <app-dynamic-form [fields]="campos" [paneles]="paneles" [panelesIguales]="true" …>
 *     <ng-template appCampoPropio="permissionsIds" let-grupo>…grilla de permisos…</ng-template>
 *     <span formActionsInfo class="pill ficha-paneles__indicador">…</span>
 *   </app-dynamic-form>
 */
export interface PanelDeFormulario {
  /** `id` del título del panel (`<h3 id>`), al que apunta el `aria-labelledby` de la sección. Único en la página. */
  id: string;
  titulo: string;
  subtitulo?: string;
  /**
   * Contador o total a la derecha del título ("36 de 61 asignados", "6 opciones elegidas"). Es una región
   * viva (`role="status"`): cada cambio se anuncia una vez. Vacío: no se dibuja.
   */
  total?: string;
  /**
   * `name` de los campos del panel, en orden. Con `cuerpo: 'grupos'`, cada entrada es un grupo (con su aire y
   * su divisor) y puede reunir varios campos: `[['categoriaIds', 'principal'], 'etiquetaIds']` (la principal
   * va pegada a las categorías de las que depende). Un grupo que es SOLO contenido propio de la página (campos
   * `vista` sin componente, dibujados con `appCampoPropio`) va de borde a borde, sin aire ni divisor
   * (`.ficha-paneles__grupo--corrido`): ese contenido pone su padding y va al pie del panel (el "Después de
   * crearla" del alta de plantilla).
   */
  campos: (string | string[])[];
  /**
   * Campos que van al pie del panel, separados de los demás por un filete y entre sí por una línea fina: los
   * interruptores de configuración (`checkbox`) y alguna nota (`tip`). Solo con `cuerpo: 'campos'`.
   */
  opciones?: string[];
  /** Panel lateral: lleva la línea que lo separa del principal (a la izquierda, o arriba cuando se apilan). */
  lateral?: boolean;
  /**
   * El panel no aporta alto: lo marca el otro panel y lo que no entra se desplaza adentro. Para una lista que
   * puede ser larga (los 61 permisos de un rol) y no tiene que estirar la tarjeta ni empujar el pie. El
   * contenido que se desplaza lo marca el widget con `.ficha-paneles__desplazable` (lo de arriba, como un
   * buscador, queda fijo), así que va con `cuerpo: 'libre'`. Es `.ficha-paneles__panel--acotado`, el mismo
   * modificador que usa a mano el panel de puntos de atención de la ficha por localidad.
   */
  acotado?: boolean;
  /**
   * Cómo se acomodan los campos:
   * - `'campos'` (por defecto): apilados con el padding del panel y `opciones` al pie. Para datos sueltos.
   * - `'grupos'`: cada entrada de `campos` es un bloque de borde a borde con su divisor. Para catálogos de
   *   `select-multiple` (cada uno con su encabezado y contador) y lo que dependa de ellos.
   * - `'libre'`: sin envoltorio; el contenido (un campo `custom` o `vista` con su template) pone su propio
   *   padding. Para un widget que se dibuja entero, como la grilla de permisos (buscador + grupos).
   */
  cuerpo?: 'campos' | 'grupos' | 'libre';
}

export interface FormConfig {
  fields?: FieldConfig[];
  submitButtonText?: string;
  cancelButtonText?: string;
}
