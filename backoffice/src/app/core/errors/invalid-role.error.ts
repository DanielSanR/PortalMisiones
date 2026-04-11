export class InvalidRoleError extends Error {
  constructor(role: string) {
    super(`Rol no reconocido: ${role}`);
    this.name = 'InvalidRoleError';
  }
}
