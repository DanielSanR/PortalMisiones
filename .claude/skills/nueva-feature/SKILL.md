---
name: nueva-feature
description: Scaffold de un feature completo del backoffice siguiendo la arquitectura de capas (Componente→Facade→Repository→DataSource) con foldering por capa, barrel, providers y adaptador mock/real. Úsalo al crear cualquier dominio nuevo (roles, permisos, municipios, etc.). Respeta RxJS sin signals.
---

# Crear un feature nuevo (backoffice)

Genera un feature en `backoffice/src/app/core/features/<feature>/` idéntico al molde (ver feature
`usuarios` como referencia). **Reglas duras:** RxJS/Observables (NUNCA signals), vistas separadas,
dirección de capas estricta (ver `.claude/rules/arquitectura-capas.md`).

## Pasos

1. **Confirmá el contrato** en `BACKEND_API_SPEC.md`: ¿hay endpoint real? Si no, el feature corre en
   `mock` (agregar a `environment.featureOverrides`).

2. **Estructura de carpetas** `core/features/<feature>/`:
   ```
   models/        <feature>.vm.ts        (ViewModels)  [+ <feature>.dto.ts si el DTO es propio]
   mappers/       <feature>.mapper.ts    (puros DTO↔VM)
   datasources/   <feature>.datasource.ts (abstract + InjectionToken)
                  <feature>.http.datasource.ts  (real, desenvuelve ResponseDTO)
                  <feature>.mock.datasource.ts  (mock)
   repositories/  <feature>.repository.ts (@Inject(<FEATURE>_DS))
   facades/       <feature>.facade.ts     (estado xxx$ + orquestación)
   <feature>.providers.ts                 (provide<Feature>Feature)
   index.ts                               (barrel: facade + VM types + provider)
   ```

3. **VM y mapper**: el ViewModel es lo que consume la UI; el mapper absorbe rarezas del backend
   (typos como `lockeTime`, `role` anidado, nullables). Mapper = funciones puras.

4. **DataSource**: interface abstracta + token (`export const <FEATURE>_DS = new InjectionToken(...)`).
   `*.http` usa el cliente HTTP/servicio real y mapea; `*.mock` usa el servicio mock. Devuelven VMs.

5. **Repository**: inyecta el token con `@Inject`, `providedIn: 'root'`. Source-agnostic.

6. **Facade** (`providedIn: 'root'`): `BehaviorSubject` privado + `xxx$` público; métodos de comando
   devuelven `Observable`. Para coordinar con otro feature, inyectá su **Repository** (vía `@features/<x>`),
   nunca su Facade. NADA de signals.

7. **Providers + barrel**:
   ```ts
   // <feature>.providers.ts
   export const provide<Feature>Feature = (): Provider[] =>
     [provideDataSource(<FEATURE>_DS, '<feature>', <Feature>HttpDataSource, <Feature>MockDataSource)];
   // index.ts → export facade, VM types, provide<Feature>Feature (NO datasources/repos)
   ```
   Registrar `...provide<Feature>Feature()` en `app.config.ts` (o en `providers` de la ruta lazy).

8. **Pantallas** (`pages/<feature>/`): standalone + OnPush + `templateUrl`/`styleUrl`. Consumen SOLO el
   facade (async pipe; `firstValueFrom` para one-shot). Import desde `@features/<feature>`.

## Verificación (obligatoria al terminar)
- `cd backoffice && npx ng build` limpio.
- `npm run check:circular` → 0 ciclos.
- Pasar el cambio por el subagente **angular-ssr-reviewer** y **arquitecto-capas**.
