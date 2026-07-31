/**
 * El usuario se autenticó OK pero no tiene autoridad para el backoffice (ej. rol `USER`/visitante
 * del portal, sin permisos). Su `message` se muestra tal cual en el LoginComponent.
 */
export class NoBackofficeAccessError extends Error {
  constructor() {
    super('Tu usuario no tiene acceso al panel de administración.');
    this.name = 'NoBackofficeAccessError';
  }
}
