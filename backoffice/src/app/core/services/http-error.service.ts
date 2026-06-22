import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from '../../shared/components/error-dialog/error-dialog.component';
import { extractErrorMessage } from '../models/api-response.model';
import { API_CODES } from '../constants/api-codes.constants';

@Injectable({ providedIn: 'root' })
export class HttpErrorService {
  constructor(private dialog: MatDialog) {}

  handleHttpError(error: HttpErrorResponse): void {
    const { title, message } = this.resolve(error);

    this.dialog.open(ErrorDialogComponent, {
      data: { title, message },
      panelClass: 'custom-modal-panel',
      width: '400px',
    });
  }

  /**
   * Normaliza los dos formatos del backend (MessageDTO de negocio y ErrorDTO de seguridad)
   * y prioriza el texto que venga del servidor. `code` es de NEGOCIO, no el HTTP status.
   */
  private resolve(error: HttpErrorResponse): { title: string; message: string } {
    const body = error.error;
    const businessCode = typeof body?.code === 'number' ? body.code : undefined;
    const serverMessage = extractErrorMessage(body);

    if (error.status === 0) {
      return {
        title: 'Error de conexión',
        message: 'No se pudo conectar con el servidor. Verifique su conexión a internet.',
      };
    }

    // Mensajes derivados de códigos de negocio frecuentes.
    switch (businessCode) {
      case API_CODES.VALIDATION:
        return { title: 'Datos inválidos', message: serverMessage || 'Verifique los campos enviados.' };
      case API_CODES.USER_ALREADY_REGISTERED:
        return { title: 'Conflicto', message: serverMessage || 'El usuario ya está registrado.' };
      case API_CODES.WEAK_PASSWORD:
        return {
          title: 'Contraseña débil',
          message: serverMessage || 'La contraseña no cumple con los requisitos mínimos de seguridad.',
        };
      case API_CODES.NO_PERMISSION:
      case API_CODES.ACCESS_DENIED:
        return { title: 'Acceso denegado', message: serverMessage || 'No tiene permisos para realizar esta acción.' };
      case API_CODES.USER_NOT_FOUND:
      case API_CODES.ROLE_NOT_FOUND:
      case API_CODES.PERMISSION_NOT_FOUND:
        return { title: 'No encontrado', message: serverMessage || 'El recurso solicitado no existe.' };
    }

    // Fallback por HTTP status.
    switch (true) {
      case error.status === 400:
        return { title: 'Solicitud inválida', message: serverMessage || 'Los datos enviados no son válidos.' };
      case error.status === 403:
        return { title: 'Acceso denegado', message: serverMessage || 'No tiene permisos para realizar esta acción.' };
      case error.status === 404:
        return { title: 'No encontrado', message: serverMessage || 'El recurso solicitado no existe.' };
      case error.status === 406:
        return { title: 'No aceptable', message: serverMessage || 'La solicitud no pudo procesarse.' };
      case error.status === 409:
        return { title: 'Conflicto', message: serverMessage || 'Ya existe un registro con esos datos.' };
      case error.status >= 500:
        return { title: 'Error del servidor', message: 'Ha ocurrido un error interno. Intente nuevamente más tarde.' };
      default:
        return { title: 'Error', message: serverMessage || 'Ha ocurrido un error inesperado.' };
    }
  }
}
