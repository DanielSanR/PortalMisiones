---
paths:
  - "backoffice/src/app/core/features/**"
  - "backoffice/src/app/pages/**"
  - "backoffice/src/app/app.config.ts"
  - "backoffice/src/environments/**"
---

# Arquitectura de capas (backoffice)

```
Componente → Facade → Repository → DataSource (abstract + token) → { HttpDataSource | MockDataSource }
mappers, models y domain = hojas · index.ts = superficie pública · <f>.providers.ts = wiring
```

## Árbol de `core/features/<f>/` (nada más en la raíz ni subcarpetas dentro de una capa)
`index.ts` · `<f>.providers.ts` · `models/` (`*.dto.ts`, `*.vm.ts`) · `mappers/<f>.mapper.ts` · `domain/` (opcional: reglas
puras como workflow, vigencia, errores propios) · `datasources/` (`<f>.datasource.ts`, `.http.datasource.ts`,
`.mock.datasource.ts`, `.mock-data.ts` opcional) · `repositories/<f>.repository.ts` · `facades/<f>.facade.ts`.

## Hacé
- **Componente**: inyecta solo el Facade, importado del barrel `@features/<f>`. Trabaja con ViewModels.
- **Facade** (`providedIn: 'root'`): `BehaviorSubject` privado + `xxx$` público; comandos devuelven `Observable`. Depende de
  Repositories: el propio y, para coordinar con otro feature, el **Repository** de ese feature vía su barrel.
- **Repository**: inyecta el DataSource por token (`@Inject(<F>_DS)`). **DataSource**: único que conoce la fuente y usa `HttpClient`;
  el `.http` desenvuelve `ResponseDTO` y devuelve VMs con el mapper. **Mapper**: funciones puras DTO↔VM.
- **Barrel**: exporta Facade, tipos y `provide<F>Feature`. El Repository se exporta **solo si otro feature lo consume**
  (comentá cuál); nunca datasources ni mappers.

## No hagas
- `facade→facade`, `repository→repository`, imports hacia arriba, ni rutas internas de otro feature (`@features/x/…`).
- `HttpClient`, Repository o DataSource en `pages/`, `shared/` o `auth/`. Reglas de dominio en `models/` (van a `domain/`).
- Saber arriba del DataSource si la fuente es mock o real. Una **capacidad de la fuente** se expone como propiedad
  datasource → repository → facade (`UsuariosFacade.accionesDeCuentaDisponibles`).

## Excepción: sesión (`AuthTokenService`) en facades y mocks
- Un facade puede leerla **solo** para: (1) no pedir un catálogo cross-feature sin permiso (evita el 403 con diálogo global);
  (2) invalidar su caché con `getCurrentUser$()`; (3) armar el **organismo fijo** de un form con `getUserOrganismo()` +
  `etiquetaDeOrganismo` / `hintDeOrganismoPropio` (`@core/utils/session.utils`): entrega `organismoFijo: { id, nombre, motivo }`
  y la UI lo muestra `readonly`; (4) exponer como Observable un hecho que depende de sesión + dominio
  (`FichasLocalesFacade.accionesWorkflow$`, `EtiquetasFacade.soloEtiquetasLocales$`, `RolesFacade.puedeEscribir$`,
  `DashboardFacade.rolDeSesion$`) para que la pantalla no inyecte la sesión (`pages/` no puede importarla: error de lint).
- Nunca para reglas de negocio ni gating general (eso es guard, `*appHasPermission`, `RowAction`); el backend valida igual.
  El facade es singleton: lee la sesión en cada llamada o la deriva de `getCurrentUser$()`, no la captura al construirse.
- Un **MockDataSource** puede leerla solo si el endpoint real responde según quién consulta (`RolesMockDataSource.listAllowed`).

## Alta de un feature (checklist; paso a paso en la skill `nueva-feature`)
1. Clave en `FeatureKey` (`core/config/data-source.config.ts`) y fuente en `featureOverrides` de los 4 `src/environments/*.ts`.
2. `...provide<F>Feature()` en `app.config.ts`, importado de `<f>.providers.ts` (no del barrel: única excepción, por bundle).
3. Si va por HTTP en prod: entrada en `angular.json` → `production.fileReplacements` + export en `core/mocks/excluded-mock.datasource.ts`.
4. Escrituras cuyo error muestra el formulario o la confirmación: `sinDialogoGlobal()` en el `.http.datasource.ts`.

Ejemplo canónico: `core/features/etiquetas/**`.
Lo verifica: `npm run lint` (`boundaries/element-types`, `no-restricted-imports`), `npm run check:structure`,
`npm run check:circular`, `npm run check:prod-mocks`.
