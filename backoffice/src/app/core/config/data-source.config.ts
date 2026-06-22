import { InjectionToken, Provider, Type } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Adaptador de fuente de datos.
 *
 * Modelo híbrido: `environment.dataSource` define el default global y `environment.featureOverrides`
 * permite forzar la fuente por feature. Un `InjectionToken` por feature recibe la implementación
 * correcta. El DataSource es el ÚNICO punto que conoce mock vs. real.
 */
export type DataSourceKind = 'mock' | 'local' | 'prod';

export type FeatureKey =
  | 'usuarios'
  | 'roles'
  | 'permisos'
  | 'municipios'
  | 'cuenta'
  | 'storage'
  | 'tramites'
  | 'organismos'
  | 'categorias'
  | 'etiquetas'
  | 'modalidades'
  | 'eventos-de-vida'
  | 'localidades'
  | 'dashboard'
  | 'auditoria'
  | 'feedback';

interface DataSourceEnvironment {
  dataSource?: DataSourceKind;
  featureOverrides?: Partial<Record<FeatureKey, DataSourceKind>>;
}

/** Resuelve la fuente efectiva de un feature: override puntual o default global. */
export function resolveKind(feature: FeatureKey): DataSourceKind {
  const env = environment as DataSourceEnvironment;
  return env.featureOverrides?.[feature] ?? env.dataSource ?? 'local';
}

/** ¿El feature debe usar datos mockeados? (`local` y `prod` ⇒ HTTP). */
export function isMock(feature: FeatureKey): boolean {
  return resolveKind(feature) === 'mock';
}

/**
 * Provee la implementación de DataSource (Http o Mock) bajo el token del feature,
 * según la config resuelta. El Repository inyecta el token, nunca una clase concreta.
 *
 * @example
 *   providers: [provideDataSource(USUARIOS_DS, 'usuarios', UsuariosHttpDataSource, UsuariosMockDataSource)]
 */
export function provideDataSource<T>(
  token: InjectionToken<T>,
  feature: FeatureKey,
  httpImpl: Type<T>,
  mockImpl: Type<T>
): Provider {
  return { provide: token, useClass: isMock(feature) ? mockImpl : httpImpl };
}
