---
name: nueva-feature
description: Crea un feature completo del backoffice (Angular 17) en core/features/<f> siguiendo la arquitectura de capas (DTO, VM, mapper, datasources mock y http, repository, facade, barrel, providers) y lo cablea (environments, angular.json, app.config). Úsalo al sumar cualquier dominio o recurso nuevo del backend. Molde - core/features/etiquetas. No aplica a public/.
---

# Crear un feature nuevo (backoffice)

Copiá la forma de `backoffice/src/app/core/features/etiquetas/` (molde verificado). Norma: `.claude/rules/arquitectura-capas.md`.
Reglas duras: RxJS (nunca signals), dirección de capas estricta, la UI solo ve el Facade.

## Pasos
1. **Contrato**: leé el endpoint en `BACKEND_API_SPEC.md` (campos, permisos, códigos de error). Si no existe todavía, el
   feature nace en `mock` y el DTO se escribe como se espera que sea; anotá el pedido en `PEDIDOS_BACKEND.md`.
2. **`models/`**: `<entidad>.dto.ts` (forma exacta del backend, con sus rarezas) y `<entidad>.vm.ts` (lo que consume la UI:
   `XVM`, `XFormValue`, `XFormData`). Nada de reglas acá: van a `domain/` (opcional, funciones puras).
3. **`mappers/<f>.mapper.ts`**: funciones puras `toXVM(dto)` y `toXRequest(form)`. Absorben nullables, anidados y typos.
4. **`datasources/`**:
   - `<f>.datasource.ts`: `abstract class XDataSource` + `export const X_DS = new InjectionToken<XDataSource>('X_DS')`. Devuelve VMs.
   - `<f>.http.datasource.ts`: `@Injectable()`, `HttpClient`, `${environment.apiBaseUrl}/api/…`, desenvuelve `ResponseDTO<T>`
     y mapea. Las escrituras cuyo error muestra el formulario o la confirmación llevan `sinDialogoGlobal()`
     (`@core/interceptors/http-error.interceptor`).
   - `<f>.mock.datasource.ts` (+ `<f>.mock-data.ts` para la semilla): en memoria, y falla **igual que el backend**
     con `errorDeNegocio(API_CODES.X, …)` (`@core/mocks/mock-errors`).
5. **`repositories/<f>.repository.ts`**: `providedIn: 'root'`, `@Inject(X_DS)`. Pasamanos del DataSource.
6. **`facades/<f>.facade.ts`**: `providedIn: 'root'`; `BehaviorSubject` privado + `xxx$` público; `loadX()`, `getFormData(id)`,
   `create` / `update` / `delete` devuelven `Observable` y actualizan el stream. Para datos de otro feature inyectá su
   **Repository** (`@features/<otro>`), nunca su Facade. Sesión: solo los usos de la excepción documentada.
7. **`<f>.providers.ts`**: `export const provideXFeature = (): Provider[] => [provideDataSource(X_DS, '<f>', XHttpDataSource, XMockDataSource)];`
8. **`index.ts`**: exporta el Facade, los tipos (`export type { … }`) y `provideXFeature`. El Repository solo si otro feature
   lo consume (con un comentario que diga cuál). Nunca datasources ni mappers.
9. **Wiring**:
   - `core/config/data-source.config.ts`: sumar `'<f>'` a `FeatureKey`.
   - `src/environments/environment{,.local,.staging,.prod}.ts`: fuente del feature en `featureOverrides` (o un comentario
     que diga que hereda el default real).
   - `app.config.ts`: `...provideXFeature()`, importado de `./core/features/<f>/<f>.providers` (no del barrel).
   - Si va por HTTP en prod: `angular.json` → `production.fileReplacements` (reemplazar `<f>.mock.datasource.ts` por
     `src/app/core/mocks/excluded-mock.datasource.ts`) **y** `export const XMockDataSource = excluido;` en ese archivo.
   - Códigos de error nuevos en `core/constants/api-codes.constants.ts`; permisos nuevos en `permission.constants.ts`.
10. **Specs por capa** (`.claude/rules/tests.md`): mapper (rarezas), `.http.datasource.spec.ts` (URL y cuerpo;
    `describeDuplicadoSinDialogoGlobal` si hay unicidad), `.mock.datasource.spec.ts` (mismos códigos que el backend),
    `.facade.spec.ts` (orquestación y sesión).
11. **Pantalla**: skill `nueva-pantalla-lista` (lista + diálogo) o `nuevo-formulario`.

## Verificación (obligatoria)
- `cd backoffice && npm run check` en verde, sin `eslint-disable` ni entradas nuevas en `scripts/*.baseline.json`.
- Pasar el cambio por los agentes `arquitecto-capas` y `angular-ssr-reviewer`.
