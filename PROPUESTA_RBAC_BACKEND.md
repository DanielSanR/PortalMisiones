# Propuesta para el backend — Autorizar por PERMISO (no por rol)

> **Para el equipo backend (`PortalMisiones-backend`).** Documenta un problema de diseño del RBAC y un
> fix de bajo esfuerzo. Generado desde el frontend (backoffice) tras chocar repetidamente con 403 al
> probar roles/permisos custom.

## Resumen ejecutivo
El RBAC tiene el **modelo de datos** de permisos (tablas `permissions`, `role_permissions`) y **ya carga los
permisos como authorities** en el token, pero **la autorización (`@PreAuthorize`) se hace por ROL** (`hasRole`),
así que **los permisos no gatean nada** y **los roles custom no autorizan nada**. Resultado: el ABM de Permisos
no cumple función, y el sistema **no es escalable** (cada regla de acceso = editar `@PreAuthorize` + redeploy).
**Fix propuesto: cambiar `hasRole('ROL')` → `hasAuthority('PERMISO')`.** Es casi solo cambiar anotaciones,
porque las authorities (permisos) ya están en el token.

---

## 1. El problema (con evidencia)

**Todos los `@PreAuthorize` autorizan por rol.** 42 anotaciones, todas `hasRole`/`hasAnyRole`, cero `hasAuthority`:
```
21 × @PreAuthorize("hasRole('SUPERADMIN')")
20 × @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')")
 1 × @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE','ADMIN_ORGANIZATION')")
 1 × @PreAuthorize("isAuthenticated()")
```
El propio spec §4.1 lo dice: *"La autorización en endpoints se hace por código de rol, no por permiso individual."*

**Consecuencias:**
1. **Crear un permiso no gatea nada.** `@PreAuthorize` chequea el rol, nunca el permiso → el ABM de Permisos
   y el mapeo rol→permisos (seed §4.2) son **documentación, no enforcement**.
2. **Los roles custom no autorizan.** Cada `@PreAuthorize` hardcodea los 6 roles canónicos. Un rol custom
   (ej. `test_role`) no aparece en ninguno → no accede a nada (salvo público / `isAuthenticated`).
3. **No es escalable.** Restringir un endpoint o sumar una capacidad = editar código y redeployar. No se puede
   definir el acceso como **dato**.

**Ejemplo concreto (caso real que probamos):** creo el permiso `READ_ORGANISMO`, se lo asigno al rol `test_role`,
y un usuario con `test_role` entra a Organismos → **403**, porque `GET /api/organism` es `hasRole('SUPERADMIN')`:
ni mira el permiso, ni reconoce `test_role`.

---

## 2. La causa exacta — y por qué el fix es barato

`CustomeUserDetails.buildAuthorities()` **ya agrega los permisos como authorities**, además de los roles:
```java
// security/entity/CustomeUserDetails.java  (líneas 52-65)
grantedAuthorities.add(new SimpleGrantedAuthority("ROLE_" + roleCode));   // rol
role.getPermissions().stream()
    .filter(p -> Boolean.TRUE.equals(p.getActive()))
    .map(Permission::getCode)
    .map(SimpleGrantedAuthority::new)
    .forEach(grantedAuthorities::add);                                     // permisos (CREATE_USUARIO, ...)
```
Y `JwtTokenService` mete todas esas authorities en el claim `roles` del token. O sea, en el `SecurityContext`
un usuario ya tiene authorities = `["ROLE_TEST_ROLE", "READ_ORGANISMO", ...]`.

**→ `@PreAuthorize("hasAuthority('READ_ORGANISMO')")` ya funcionaría hoy.** No hay que tocar el modelo de datos
ni la carga de authorities: **solo cambiar las expresiones de las anotaciones.**

---

## 3. El fix

Reemplazar en los controllers el gating por rol por gating por permiso:
```java
// ANTES
@PreAuthorize("hasRole('SUPERADMIN')")            // GET /api/organism
// DESPUÉS
@PreAuthorize("hasAuthority('READ_ORGANISMO')")
```

**Qué desbloquea:**
- Crear un permiso + asignarlo a roles **realmente gatea**. El ABM de Permisos cobra sentido.
- **Roles y permisos custom funcionan**: `test_role` con `READ_ORGANISMO` accede a Organismos. Escalable.
- El acceso pasa a ser **dato** (permiso), no código. Nueva capacidad = nuevo permiso + asignación, sin deploy.

### Mapa de migración sugerido (endpoint → permiso, según el seed §4.2)
| Endpoint (hoy) | Gating actual | Propuesto |
|---|---|---|
| `GET/POST/PUT/DELETE /api/organism`, `/api/organism-type` | `hasRole('SUPERADMIN')` | `hasAuthority('READ/CREATE/UPDATE/DELETE_ORGANISMO')` |
| `POST/PUT/DELETE /api/category|modality|life-event|recipient` | `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')` | `hasAuthority('CREATE/UPDATE/DELETE_TAXONOMIA')` |
| `/api/role/**` | `hasRole('SUPERADMIN')` | `hasAuthority('READ/CREATE/UPDATE/DELETE_ROL')` |
| `GET/PUT/DELETE/PATCH /api/user/**` | `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')` | `hasAuthority('READ/UPDATE/DELETE_USUARIO')` |
| `POST /api/user` | `hasAnyRole(SA,AB,AO)` | `hasAuthority('CREATE_USUARIO')` |
| `GET` de taxonomía/geografía (público) | `permitAll` | *(sin cambio)* |

### Puntos a revisar (el seed no coincide 100% con el gating actual)
- **Taxonomía DELETE**: hoy `hasAnyRole(SA,AB)` deja borrar a `ADMIN_BACKOFFICE`, pero el seed **no** le da
  `DELETE_TAXONOMIA`. Al pasar a `hasAuthority('DELETE_TAXONOMIA')` AB dejaría de poder borrar. Decidir:
  ¿darle `DELETE_TAXONOMIA` a AB en el seed, o que solo SUPERADMIN borre?
- **`POST /api/user`**: hoy lo permite AB por rol, pero el seed no le da `CREATE_USUARIO`. Idem: alinear el seed.
- **`/api/permission/**` y algún endpoint sin permiso atómico propio** (no hay permiso "gestionar permisos"):
  crear un permiso para eso (ej. `MANAGE_PERMISO`) o dejarlo por rol como excepción.
- **`GET /api/role/allowed`** tiene lógica *context-aware por rol* (filtra según el rol del caller) — ahí el
  rol sí es parte de la lógica de negocio, no solo del gating; revisar caso por caso.

---

## 3.b. (Opcional pero recomendado) Estructura del JWT: `roles` y `permissions` separados
Hoy el token emite un único claim `roles` coma-separado que **mezcla** roles y permisos
(`"ROLE_SUPERADMIN,READ_USUARIO,CREATE_USUARIO"`). Más limpio y explícito sería emitir dos claims:
```json
{
  "roles": ["ROLE_SUPERADMIN", "ROLE_TEST"],
  "permissions": ["READ_USUARIO", "CREATE_USUARIO"]
}
```
Cambio acotado en `JwtTokenService` (separar authorities por prefijo `ROLE_` al armar los claims). No es
requisito del fix de §3, pero simplifica el consumo (front, portal, y cualquier resource server).
**El frontend ya está preparado para ambos formatos** (el viejo mezclado y el nuevo separado), así que
pueden hacer este cambio sin coordinar con el front.

## 4. Impacto en el frontend (ya está preparado)
El backoffice ya tiene la infra lista: `AccessRule` soporta gatear por `permissions` **y** por `requireRoles`,
con un guard único (`accessGuard`) y una función única de evaluación. **Hoy el front gatea por ROL** (para
reflejar el backend actual y no romper). Cuando el backend pase a `hasAuthority`, **damos vuelta las reglas de
`requireRoles` a `permissions`** (cambio de config, no reescritura). Así los dos quedan alineados y el sistema
por permiso funciona punta a punta.

---
*Verificado leyendo `security/**` @ backend en ejecución (13/07/2026). Contrastar con Swagger/Postman ante dudas.*
