---
paths:
  - "backoffice/src/**/*.spec.ts"
  - "backoffice/src/**/*.testing.ts"
---

# Tests unitarios (backoffice: Karma + Jasmine)

## Hacé
- El spec vive **al lado** del archivo que prueba, con el mismo nombre (`x.ts` → `x.spec.ts`).
- Probá **comportamiento observable**: qué emite el stream, qué llamada sale, qué texto, estado o foco ve la persona.
- Nombres en español que cuentan la regla: `'con filtros activos el CTA limpia aunque no haya ninguna etiqueta'`.
- Qué probar por capa:
  - **Mapper**: rarezas del contrato (nullables, campos anidados, typos del backend) en funciones puras.
  - **HttpDataSource**: URL, verbo, cuerpo y desenvuelto de `ResponseDTO` con `HttpTestingController`; las escrituras con
    unicidad, con `describeDuplicadoSinDialogoGlobal` (`@core/interceptors/testing/duplicado-sin-dialogo-global.testing`).
  - **MockDataSource**: que falle con el mismo código y status que el backend (`API_CODES`).
  - **Facade**: `TestBed` + `jasmine.createSpyObj` de los Repositories; orquestación, caché y la excepción de sesión
    (con y sin organismo, con y sin permiso).
  - **Helpers de sección** (`*-dialogo.ts`, `*-save-error.ts`): funciones puras, sin `TestBed`
    (campos `readonly`, payload de `guardar`, conflicto → campo).
  - **Componente**: `TestBed` con `imports: [Componente]`, el Facade reemplazado por un objeto con `BehaviorSubject`,
    `provideRouter([])` y `provideNoopAnimations()`. Estados cargando / error / vacío, gating y foco.
- Asincronía: `firstValueFrom` + `async/await`; `fakeAsync` + `tick` para `debounceTime` y timers.
- Datos de prueba mínimos y con nombre (`const LOCAL: EtiquetaVM = …`).
- Al arreglar un bug: primero el spec que lo reproduce.

## No hagas
- Specs que solo comprueban `toBeTruthy()` del componente, o que repiten la implementación (espiar un método privado y
  verificar que se llamó).
- Signals en specs (siguen prohibidos). Llamadas HTTP reales. `setTimeout` reales o `done` con esperas.
- Mockear el facade con otro facade real, o importar el `HttpClient` real en el spec de un componente.
- `fdescribe`, `fit`, `xdescribe`, `xit` commiteados. Borrar o aflojar un spec para que el check pase.
- Specs sueltos en la raíz de `pages/`: van junto al archivo que prueban.
- Depender del orden entre specs o de estado global (`localStorage`, sesión) sin limpiarlo.

Ejemplo canónico: `core/features/etiquetas/facades/etiquetas.facade.spec.ts` (facade),
`core/features/etiquetas/datasources/etiquetas.http.datasource.spec.ts` y `etiquetas.mock.datasource.spec.ts` (datasources),
`pages/etiquetas/etiqueta-dialogo.spec.ts` (helper) y `pages/etiquetas/list/etiquetas-list.component.spec.ts` (componente).
Lo verifica: `npm run test:ci` (ChromeHeadless; forma parte de `npm run check`) y `npm run check:structure` (spec sin su archivo).
