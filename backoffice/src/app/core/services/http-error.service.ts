import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from '../../shared/components/error-dialog/error-dialog.component';

@Injectable({ providedIn: 'root' })
export class HttpErrorService {
  constructor(private dialog: MatDialog) {}

  handleHttpError(error: HttpErrorResponse): void {
    let title = 'Error';
    let message = 'Ha ocurrido un error inesperado.';

    if (error.status === 0) {
      title = 'Error de conexión';
      message = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
    } else if (error.status === 400) {
      title = 'Solicitud inválida';
      message = error.error?.message || 'Los datos enviados no son válidos.';
    } else if (error.status === 403) {
      title = 'Acceso denegado';
      message = 'No tiene permisos para realizar esta acción.';
    } else if (error.status === 404) {
      title = 'No encontrado';
      message = 'El recurso solicitado no existe.';
    } else if (error.status === 409) {
      title = 'Conflicto';
      message = error.error?.message || 'Ya existe un registro con esos datos.';
    } else if (error.status >= 500) {
      title = 'Error del servidor';
      message = 'Ha ocurrido un error interno. Intente nuevamente más tarde.';
    }

    this.dialog.open(ErrorDialogComponent, {
      data: { title, message },
      panelClass: 'custom-modal-panel',
      width: '400px',
    });
  }
}
