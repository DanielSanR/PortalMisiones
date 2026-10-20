/**
 * Reemplazo de `mock-auth-init.ts` en el build de producción (angular.json → production →
 * fileReplacements): prod nunca corre con `dataSource: 'mock'`, así que la sesión mock no viaja.
 * `npm run check:prod-mocks` falla si `environment.prod.ts` pasa a `dataSource: 'mock'`.
 */
export function initMockAuth(): void {
  /* sin sesión mock en producción */
}
