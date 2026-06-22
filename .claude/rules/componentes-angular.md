---
paths:
  - "backoffice/src/app/**/*.component.ts"
  - "backoffice/src/app/**/*.ts"
---

# Convenciones de componentes y async (backoffice Angular 17)

## Estado y asincronía — RxJS, NUNCA signals
- **PROHIBIDO usar Angular signals** (`signal`, `computed`, `effect`, `toSignal`, inputs/model signal-based).
- Los facades exponen **Observables** (`xxx$`); los componentes consumen con **`async` pipe**.
- Llamadas one-shot imperativas (guards, lógica secuencial) → **`firstValueFrom()`** (promesas).
- `subscribe` manual solo si es estrictamente necesario, y siempre con `takeUntilDestroyed(this.destroyRef)`.

## Componentes
- **Standalone** (`standalone: true`), `ChangeDetectionStrategy.OnPush`.
- Vista SIEMPRE en archivos separados: `templateUrl` + `styleUrl`. PROHIBIDO `template:`/`styles:` inline.
- Inyectar SOLO el facade del feature (ver regla de arquitectura). Sin `HttpClient`/Services directos.
- Locale es-AR, fechas DD/MM/YYYY, labels en español.

## Reutilización
- Reusar componentes/pipes de `@shared` y utilidades de `@core/utils` antes de crear nuevos.
- Evitar boilerplate: si un patrón se repite en ≥2 lugares, extraerlo.
