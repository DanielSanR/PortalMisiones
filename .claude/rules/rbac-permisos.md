---
paths:
  - "backoffice/src/app/pages/**"
  - "backoffice/src/app/core/guards/**"
  - "backoffice/src/app/core/constants/**"
  - "backoffice/src/app/core/utils/authorization.utils.ts"
  - "backoffice/src/app/shared/directives/has-permission.directive.ts"
  - "backoffice/src/app/shared/layouts/**"
---

# RBAC: se autoriza por permiso, con un solo motor (backoffice)

El backend autoriza con `hasAuthority(<PERMISO>)`. El claim `roles` del JWT mezcla roles (`ROLE_*`) y permisos atómicos
separados por coma (`core/utils/role.utils.ts`). Códigos: `core/constants/permission.constants.ts` (`PERMISSIONS`).

## Hacé
- Toda decisión de acceso pasa por `canPerform` / `evaluateAccess` (`@core/utils/authorization.utils`) con una `AccessRule`
  (`permissions`, `mode`, `requireRoles`, `anyOf`, `organismoPropio`). Nav, ruta, botón y fila usan **la misma regla**:
  - **Ruta**: `canActivate: [accessGuard]` + `data: { access: <AccessRule>, redirectTo: HOME, breadcrumb: [...] }`.
  - **Nav y buscador de comandos**: `NAV_GROUPS` (`core/constants/role-mapping.constants.ts`) y `COMANDOS` (`comandos.constants.ts`).
  - **Botón o bloque**: `*appHasPermission="'CREATE_X'"` o `*appHasPermission="REGLA_ACCESS"`.
  - **Acción de fila**: `RowAction.permission` o `RowAction.rule`. CTA del vacío: `[emptyActionPermission]`.
  - **Diálogo por URL**: `validarDialogoDeLista({ nuevo: …, editar: … })` en la ruta de la lista.
- Regla compuesta (el permiso solo no alcanza para que la pantalla funcione): una constante con nombre en
  `core/constants/policy-overrides.constants.ts` (`CREAR_ETIQUETA_ACCESS`, `ADOPTAR_ACCESS`, `EDITAR_USUARIO_ACCESS`) y se
  reutiliza en ruta, nav, comando, botón y fila. Si el prerrequisito vale para **todo** uso del permiso: `PERMISSION_PREREQUISITES`.
- Lo que depende de sesión **y** del estado del dominio (acciones del workflow de una ficha) lo expone el facade como
  Observable (`FichasLocalesFacade.accionesWorkflow$`); quién publica lo decide `PUBLISH_VARIANT`, no el rol.
- Al sumar una pantalla: ruta + nav + comando + botones + filas con la misma regla, y probarla con un rol que **no** la tiene.

## No hagas
- Gatear por rol (`UserRole`, `requireRoles`) algo que el backend autoriza por permiso. **Escape por rol cerrado**:
  Roles y Permisos (`LEER_ROLES_PERMISOS_ACCESS` = SUPERADMIN o ADMIN_BACKOFFICE; `ESCRIBIR_ROLES_PERMISOS_ACCESS` = solo
  SUPERADMIN) y las secciones sin backend real (Auditoría, Feedback).
- Inyectar `AuthTokenService` o `AuthService` en `pages/` para preguntar `can(...)`: usá la directiva, `RowAction` o el facade.
- Comparar strings de rol o de permiso a mano (`user.role === 'SUPERADMIN'`, `permissions.includes(...)`).
- Mostrar un botón que termina en 403, o esconderlo con CSS. Asumir que el usuario tiene localidad (el backend real no la da).
- Confiar en el front: el backend valida igual; el gating es solo para no ofrecer lo que va a rechazar.
- Poner reglas de acceso en un facade fuera de la excepción de sesión (`arquitectura-capas.md`).

Ejemplo canónico: rutas `etiquetas/*` en `pages/pages.module.ts` + `CREAR_ETIQUETA_ACCESS` + `accionEditar` / `accionesDe`
en `pages/etiquetas/list/etiquetas-list.component.ts`.
Lo verifica: `core/utils/authorization.utils.spec.ts`, `core/guards/dialogo-en-lista.guard.spec.ts`; `npm run lint`
(`no-restricted-imports`: sesión en `pages/`, error); el e2e por rol de `e2e/roles/` (ver `e2e-staging.md`).
