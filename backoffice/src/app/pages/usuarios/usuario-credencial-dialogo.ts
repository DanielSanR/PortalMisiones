import { Observable, map, throwError } from 'rxjs';
import { FormGroup } from '@angular/forms';
import { FieldConfig } from '@core/models/field.interface';
import { extractErrorMessage } from '@core/models/api-response.model';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';

/** Qué credencial se cambia. */
export type CredencialModo = 'email' | 'password';

export interface CredencialDeUsuario {
  modo: CredencialModo;
  /** Nombre visible del usuario afectado, para el subtítulo. */
  nombre: string;
  /** Email actual: precarga el campo en modo `email`. */
  emailActual?: string;
  /** Ejecuta el cambio. El diálogo espera su resultado antes de cerrar. */
  guardar: (valor: string) => Observable<unknown>;
}

/** Política de contraseña del backend (`UtilsCommons.validPassword`): 8–20, mayúscula, minúscula y número. */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;
const PASSWORD_PATTERN = '^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).+$';

const FALLBACK = 'No se pudo guardar el cambio. Intentá de nuevo.';
const NO_COINCIDEN_TEXTO = 'Las contraseñas no coinciden';
/** Marca interna: las dos contraseñas difieren. No llega al backend; se cuenta en "Repetir contraseña". */
const NO_COINCIDEN = Symbol('no-coinciden');

function camposDeEmail(emailActual: string): FieldConfig[] {
  const actual = emailActual.trim().toLowerCase();
  return [
    {
      name: 'email',
      label: 'Nuevo email',
      type: 'email',
      hint: 'Es el que usa para ingresar. Se guarda en minúsculas.',
      validations: {
        required: true,
        email: true,
        mensajes: { required: 'El email es obligatorio' },
        // Guardar el mismo email no tendría efecto.
        validar: (valor) => (valor.trim().toLowerCase() === actual ? 'Ingresá un email distinto al actual' : null),
      },
    },
  ];
}

const CAMPOS_DE_PASSWORD: FieldConfig[] = [
  {
    name: 'nueva',
    label: 'Nueva contraseña',
    type: 'password',
    hint: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres, con al menos una mayúscula, una minúscula y un número.`,
    validations: {
      required: true,
      minLength: PASSWORD_MIN,
      maxLength: PASSWORD_MAX,
      pattern: PASSWORD_PATTERN,
      patternErrorMessage: 'Tiene que incluir mayúscula, minúscula y número',
      mensajes: {
        required: 'La contraseña es obligatoria',
        minlength: `Tiene que tener al menos ${PASSWORD_MIN} caracteres`,
      },
    },
  },
  {
    name: 'repetida',
    label: 'Repetir contraseña',
    type: 'password',
    validations: { required: true, mensajes: { required: 'Repetí la contraseña' } },
  },
];

/** El backend no informa campos: su mensaje va al banner. La única marca en un campo es la de "no coinciden". */
function errorDeGuardado(err: unknown, form: FormGroup | undefined): string {
  if (err === NO_COINCIDEN) {
    const repetida = form?.get('repetida');
    if (!repetida) return NO_COINCIDEN_TEXTO;
    repetida.setErrors({ server: NO_COINCIDEN_TEXTO });
    repetida.markAsTouched();
    return 'Revisá el campo marcado.';
  }
  return extractErrorMessage((err as { error?: unknown })?.error) || FALLBACK;
}

/**
 * Configuración del diálogo (`FormDialogComponent`) para cambiar el email o la contraseña de un usuario
 * desde la lista. Queda abierto mientras el backend responde y, si falla, cuenta el error ahí mismo.
 * `afterClosed()` emite `true` solo si el cambio se guardó.
 */
export function dialogoDeCredencial(credencial: CredencialDeUsuario): FormDialogData<true> {
  const esEmail = credencial.modo === 'email';
  const emailActual = credencial.emailActual ?? '';
  const hecho = map((): true => true);

  return {
    ...formDialogEstatico<true>({
      titulo: esEmail ? 'Cambiar email' : 'Cambiar contraseña',
      subtitulo: `de ${credencial.nombre}`,
      textoGuardar: 'Guardar',
      requiereCambios: esEmail,
      mensajeDescartar: esEmail
        ? 'Hay un email sin guardar. Si cerrás ahora no se cambia.'
        : 'Hay una contraseña sin guardar. Si cerrás ahora no se cambia.',
      formId: 'usuario-credencial-dialog-form',
      fields: esEmail ? camposDeEmail(emailActual) : CAMPOS_DE_PASSWORD,
      initialData: esEmail ? { email: emailActual } : null,
      guardar: (valor) => {
        if (esEmail) return credencial.guardar(String(valor['email'] ?? '').trim()).pipe(hecho);
        const nueva = String(valor['nueva'] ?? '');
        // Se compara al enviar: una regla del campo no se reevalúa cuando cambia la otra contraseña.
        if (nueva !== String(valor['repetida'] ?? '')) return throwError(() => NO_COINCIDEN);
        return credencial.guardar(nueva).pipe(hecho);
      },
      fallback: FALLBACK,
    }),
    errorDeGuardado,
  };
}
