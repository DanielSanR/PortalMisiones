import { Type } from '@angular/core';

/**
 * Stub de los MockDataSource que el build de PRODUCCIÓN no necesita.
 *
 * `angular.json` (configuración `production` → `fileReplacements`) reemplaza cada
 * `core/features/<x>/datasources/<x>.mock.datasource.ts` cuyo feature resuelve a HTTP en
 * `environment.prod.ts` por ESTE archivo. Así `provideDataSource(TOKEN, '<x>', Http, Mock)` sigue
 * compilando sin tocar los `*.providers.ts`, pero los datos y la lógica mock no viajan al bundle.
 *
 * Si un feature reemplazado pasa a `'mock'` en `environment.prod.ts`, el stub lanza al instanciarse
 * (y `npm run check:prod-mocks`, que corre en `prebuild`, frena el build antes): sacar su entrada de
 * `fileReplacements` en ese caso.
 *
 * Cada export tiene el MISMO nombre que la clase original (es lo que importa cada `providers.ts`).
 */
class MockExcluidoDelBuild {
  constructor() {
    throw new Error(
      'MockDataSource excluido del build de producción (angular.json → fileReplacements). ' +
        'Si el feature debe correr en mock en prod, quitá su reemplazo.',
    );
  }
}

/** Una sola clase para todos: el stub pesa lo mismo con 1 o con 11 features excluidos. */
const excluido = MockExcluidoDelBuild as unknown as Type<never>;

export const CategoriasMockDataSource = excluido;
export const CuentaMockDataSource = excluido;
export const DestinatariosMockDataSource = excluido;
export const EventosDeVidaMockDataSource = excluido;
export const LocalidadesMockDataSource = excluido;
export const ModalidadesMockDataSource = excluido;
export const OrganismosMockDataSource = excluido;
export const PermisosMockDataSource = excluido;
export const RolesMockDataSource = excluido;
export const TiposOrganismoMockDataSource = excluido;
export const UsuariosMockDataSource = excluido;
