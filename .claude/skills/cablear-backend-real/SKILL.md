---
name: cablear-backend-real
description: Pasa un feature del backoffice (Angular 17) de mock a backend real - verifica el DTO real, ajusta mapper y HttpDataSource, alinea la UI al contrato (quita lo que el backend no persiste), iguala el mock, cambia la fuente por entorno y excluye el mock del build de producción. Úsalo cuando el backend publica o cambia un endpoint. No aplica a public/.
---

# Pasar un feature de mock a real (backoffice)

Normas: `.claude/rules/arquitectura-capas.md`, `textos-y-errores.md`, `rbac-permisos.md`, `e2e-staging.md`.
Principio: **la UI se alinea al contrato real**. Un campo editable que no se guarda es peor que uno ausente.

## Pasos
1. **Verificá el contrato real, no el esperado**: `BACKEND_API_SPEC.md` y, si hay backend local, la respuesta real del
   endpoint (`npm run start:local`). Anotá: campos y tipos, nullables, permisos (`hasAuthority`), alcance por organismo,
   códigos de negocio de cada rechazo y su status. Diferencias y faltantes → `PEDIDOS_BACKEND.md`.
2. **DTO y mapper** (`models/*.dto.ts`, `mappers/<f>.mapper.ts`): el DTO copia la forma real; el mapper absorbe las
   rarezas. El VM solo cambia si la UI gana o pierde un dato.
3. **HttpDataSource**: URL, verbos, `ResponseDTO<T>`, `encodeURIComponent` en ids, `sinDialogoGlobal()` en las escrituras
   con error propio. Operación sin endpoint: no se simula; se expone como **capacidad de la fuente**
   (datasource → repository → facade, como `UsuariosFacade.accionesDeCuentaDisponibles`).
4. **Alineá la UI al contrato**:
   - Quitá de formularios, columnas y detalle los campos que el backend no persiste ni devuelve.
   - Acciones sin endpoint: `appUnavailable="<motivo>"` (visibles), o fuera si no están en el diseño.
   - Filtros solo sobre campos reales. Si el backend impone el organismo: `organismoFijo` + `readonly` + `hint`.
5. **Errores por código**: sumá los códigos a `core/constants/api-codes.constants.ts`; declaralos en
   `pages/<sección>/<x>-save-error.ts` (`ConflictoDeCampo`, `errorDeAccionPorCodigo`). Nunca el `message` del backend.
6. **Permisos**: los códigos reales en `permission.constants.ts`; la misma `AccessRule` en ruta, nav, comando, botón y fila.
   Si la pantalla necesita leer otro recurso para funcionar, regla compuesta en `policy-overrides.constants.ts`.
7. **Igualá el mock al backend** (sigue siendo la fuente de `ng serve` y de los specs): mismos campos, mismo alcance por
   sesión si el endpoint lo aplica, mismos códigos y status (`errorDeNegocio`).
8. **Fuente por entorno** (`src/environments/environment{,.local,.staging,.prod}.ts` → `featureOverrides`): features que
   se referencian por id van **todos con la misma fuente** (mezclar manda ids del mock al backend). Dejá escrito desde
   qué versión del backend funciona.
9. **Build de producción**: si el feature queda por HTTP en `environment.prod.ts`, sumá su `*.mock.datasource.ts` a
   `angular.json` → `production.fileReplacements` y su export a `core/mocks/excluded-mock.datasource.ts`
   (lo valida `npm run check:prod-mocks`). Si vuelve a mock en prod, quitá ambos.
10. **Specs**: `.http.datasource.spec.ts` (URL, cuerpo, desenvuelto; `describeDuplicadoSinDialogoGlobal`), mapper con un DTO
    real de ejemplo, `.mock.datasource.spec.ts` (códigos), facade (sesión y alcance), helpers `*-save-error`.
11. **Documentación**: actualizá en `CLAUDE.md` la línea de qué sigue en mock, y `BACKLOG_BACKOFFICE.md` / `PEDIDOS_BACKEND.md`.

## Verificación (obligatoria)
- `cd backoffice && npm run check` en verde.
- `npm run start:local` (o `start:staging`): listar, crear, editar, duplicado, eliminar, y un rol sin permiso. Pestaña de
  red sin requests al recurso viejo ni 4xx inesperados; ningún diálogo global en un error que el formulario ya muestra.
- En staging respetá `.claude/rules/e2e-staging.md` (datos con marca de muestra, sin tocar cuentas reales).
- Agentes: `arquitecto-capas` y `angular-ssr-reviewer`.
