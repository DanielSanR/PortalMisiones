---
paths:
  - "backoffice/src/app/core/features/**"
  - "backoffice/src/app/pages/**"
---

# Arquitectura de capas (backoffice)

Flujo unidireccional descendente. Cada capa solo conoce la inmediatamente inferior vía interface:

```
Componente → Facade → Repository → DataSource(interface) → {HttpDataSource | MockDataSource}
mappers + models = HOJAS (no dependen de capas superiores)
```

## Reglas
- **Componentes** consumen SOLO el facade del feature (importado desde su barrel `@features/<x>`).
  Prohibido inyectar `HttpClient`, Services, Repositories o DataSources en un componente.
- **Facade** depende solo de Repositories. Para coordinar con otro feature, depende del **Repository**
  de ese feature (importado de su barrel), NUNCA de su Facade. Prohibido `facade → facade`.
- **Repository** inyecta el `DataSource` vía `InjectionToken` (`@Inject(XXX_DS)`), nunca una clase concreta.
  Prohibido `repository → repository` y `repository → facade`.
- **DataSource** es el adaptador: interface abstracta + impl `*.http.datasource.ts` (real) y
  `*.mock.datasource.ts` (mock). El `*.http` desenvuelve `ResponseDTO`. Prohibido `datasource → datasource`.
- **Mappers** son funciones puras DTO↔ViewModel; solo dependen de models.
- Cero dependencias circulares (verificar con `npm run check:circular`).

## Foldering por feature
Todo el feature vive en `core/features/<feature>/` con subcarpetas por capa:
`models/`, `mappers/`, `datasources/`, `repositories/`, `facades/`, más `<feature>.providers.ts` e `index.ts` (barrel).
El barrel expone SOLO la superficie pública (facade, VM types, `provide<Feature>Feature`); datasources y repos quedan internos.

## Mock vs. real
La fuente la decide el adaptador vía `environment.dataSource` + `featureOverrides` (`provideDataSource`).
Ningún componente/facade/repo debe saber si los datos son mock o reales.

## Imports
Usar path aliases `@core/*`, `@features/*`, `@shared/*`, `@env/*`. Prohibido importar internals de otro
feature por ruta profunda: siempre vía su barrel `@features/<x>`.
