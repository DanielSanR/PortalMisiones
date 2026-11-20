import { Injectable, Injector, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorCode } from '../models/api-response.model';
import { TipoDeErrorHttp, textoDeErrorHttp, tipoDeErrorHttp } from '../utils/http-error-text.utils';
import { API_CODES } from '../constants/api-codes.constants';

/** Título del diálogo global según el tipo de error. */
const TITULOS: Readonly<Record<TipoDeErrorHttp, string>> = {
  'sin-conexion': 'Sin conexión',
  'sesion-vencida': 'Sesión vencida',
  'sin-permiso': 'Acceso denegado',
  inexistente: 'No encontrado',
  conflicto: 'Conflicto',
  'datos-rechazados': 'Datos no aceptados',
  servidor: 'Error del servidor',
  otro: 'Error',
};

export const ERROR_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo; si sigue, avisá a Soporte.';

/**
 * Título y texto del diálogo global de error. SIEMPRE textos propios: el `message` del backend no se muestra
 * nunca. Se usa el compartido según el tipo de error (`textoDeErrorHttp`); los códigos de negocio que el
 * backend reusa con otro sentido (p. ej. `4002`) no llevan texto propio acá: cada pantalla declara los suyos.
 */
export function dialogoDeErrorHttp(error: unknown): { title: string; message: string } {
  // `4034` no se reusa para otra cosa y su status (400) solo daría "datos no aceptados": se dice la política.
  if (extractErrorCode((error as { error?: unknown } | null)?.error) === API_CODES.WEAK_PASSWORD) {
    return {
      title: 'Contraseña débil',
      message: 'La contraseña no cumple los requisitos: entre 8 y 20 caracteres, con al menos una mayúscula, una minúscula y un número.',
    };
  }
  return {
    title: TITULOS[tipoDeErrorHttp(error)],
    message: textoDeErrorHttp(error, ERROR_INESPERADO, { contexto: 'accion' }),
  };
}

@Injectable({ providedIn: 'root' })
export class HttpErrorService {
  private readonly injector = inject(Injector);

  /**
   * `MatDialog` y el componente del diálogo se cargan con `import()` recién al primer error: así
   * cdk/overlay + material/dialog (~75 kB) no viajan en el bundle inicial (el interceptor que usa
   * este servicio está en el composition root, antes del login).
   */
  handleHttpError(error: HttpErrorResponse): void {
    const { title, message } = dialogoDeErrorHttp(error);

    void Promise.all([
      import('@angular/material/dialog'),
      import('../../shared/components/error-dialog/error-dialog.component'),
    ]).then(([{ MatDialog }, { ErrorDialogComponent }]) => {
      this.injector.get(MatDialog).open(ErrorDialogComponent, {
        data: { title, message },
        role: 'alertdialog',
        panelClass: 'custom-modal-panel',
        width: '400px',
      });
    }).catch(() => {
      // Sin red el chunk del diálogo puede no estar cacheado: el error no puede quedar mudo.
      console.error(`[${title}] ${message}`);
      try {
        window.alert(`${title}

${message}`);
      } catch {
        /* entorno sin window (SSR/tests) */
      }
    });
  }
}
