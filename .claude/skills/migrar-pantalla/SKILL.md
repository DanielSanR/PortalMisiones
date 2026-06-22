---
name: migrar-pantalla
description: Migra una pantalla existente del backoffice (que consume servicios directos/mocks) a la arquitectura de capas, haciendo que consuma SOLO el facade del feature. Úsalo para refactorizar list/form/detail viejos. Respeta RxJS sin signals y vistas separadas.
---

# Migrar una pantalla al facade

Convierte un componente que hoy inyecta servicios/HTTP directo en uno que consume solo el **facade**
de su feature, sin cambiar la UX. Si el feature no existe aún, primero correr la skill `nueva-feature`.

## Pasos
1. **Mapear dependencias actuales**: qué servicios usa el componente y qué datos necesita (lista, detalle,
   datos de formulario). Identificar el feature destino.
2. **Asegurar la capa**: el feature debe tener facade + repository + datasource(s) + mapper + VM. Si falta,
   crearlos con `nueva-feature`. La orquestación multi-llamada (ej. `getFormData`) va en el **facade**, no en el componente.
3. **Refactor del componente**:
   - Inyectar SOLO el facade (desde `@features/<x>`). Quitar `HttpClient`/Services/Repos.
   - Estado de lista → `xxx$` del facade + **`async` pipe** en el template (`(data$ | async) ?? []`).
   - Cargas/acciones one-shot → `await firstValueFrom(facade.metodo())` en métodos `async` (loading en try/finally).
   - NUNCA signals. `subscribe` manual solo si es imprescindible, con `takeUntilDestroyed`.
   - Vista en `templateUrl`/`styleUrl` (si estaba inline, extraerla). OnPush + standalone.
   - El componente trabaja con **ViewModels**, no DTOs.
4. **Estilos**: si tocás SCSS, BEM anidado con `&` + tokens `var(--theme-*)` (ver `.claude/rules/scss-bem.md`).

## Verificación
- `cd backoffice && npx ng build` limpio + `npm run check:circular`.
- Revisar con el subagente **angular-ssr-reviewer**.
- Probar el flujo manual de la pantalla (alta/edición/listado según corresponda).
