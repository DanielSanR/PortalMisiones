import { isDevMode } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { EscrituraDeVista, FieldConfig } from '@core/models/field.interface';

/** Lo que `ngComponentOutletInputs` le pasa al componente de un campo `vista`. */
export type EntradasDeVista = { grupo: FormGroup; datos?: unknown; escribir?: EscrituraDeVista };

/** ¿El campo `name` está fijado (`readonly`) en el formulario? Lo consulta `escribir` en cada escritura. */
export type CampoFijo = (name: string) => boolean;

/**
 * Inputs del componente de un campo `vista`: siempre `grupo`; `datos` solo si el campo los declara y `escribir`
 * solo si declara `vista.escribe` (Angular avisa si se le pasa un input que el componente no tiene). Se arma
 * una vez por campo: un objeto nuevo en cada detección de cambios reasignaría los inputs cada vez.
 * `esFijo` dice qué campos están en `readonly` AHORA (los `fields` se pueden recalcular).
 */
export function entradasDeVista(field: FieldConfig, grupo: FormGroup, esFijo?: CampoFijo): EntradasDeVista | null {
  const vista = field.type === 'vista' ? field.vista : undefined;
  if (!vista) return null;
  const entradas: EntradasDeVista = { grupo };
  if (vista.datos !== undefined) entradas.datos = vista.datos;
  if (vista.escribe?.length) entradas.escribir = escrituraDeVista(grupo, vista.escribe, field.name, esFijo);
  return entradas;
}

/**
 * `escribir` de una vista (ver `FieldVista.escribe`): cambia solo los controles permitidos y solo si el valor
 * difiere. Cada control queda dirty y touched ANTES de `setValue`, para que quien escucha `valueChanges` (el
 * diálogo decide "hay cambios" ahí) ya lo vea modificado. Un campo fijado (`readonly` o `disabled`) no se toca:
 * la persona tampoco podría cambiarlo.
 */
export function escrituraDeVista(grupo: FormGroup, permitidos: readonly string[], vista: string, esFijo?: CampoFijo): EscrituraDeVista {
  return (valores) => {
    for (const [nombre, valor] of Object.entries(valores)) {
      const control = permitidos.includes(nombre) ? grupo.get(nombre) : null;
      if (!control) {
        if (isDevMode()) console.warn(`[app-dynamic-form] La vista "${vista}" no puede escribir "${nombre}": no está en \`vista.escribe\` o no existe.`);
        continue;
      }
      if (control.disabled || esFijo?.(nombre)) {
        if (isDevMode()) console.warn(`[app-dynamic-form] La vista "${vista}" no puede escribir "${nombre}": el campo está fijado (readonly o disabled).`);
        continue;
      }
      if (control.value === valor) continue;
      control.markAsDirty();
      control.markAsTouched();
      control.setValue(valor);
    }
  };
}
