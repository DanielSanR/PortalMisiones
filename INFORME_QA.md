# Informe de QA — Backoffice (integración con backend real)

**Alcance:** ABM de todos los módulos ya integrados, probados end-to-end contra el backend en ejecución,
incluyendo casos de error (unicidad, jerarquía, permisos). **Entorno:** dev (`:4200` front · `:8080` back).

## TL;DR
Todo el ABM anda ✅. Aparecieron **3 puntos a resolver** (2 son del backend, 1 es una pregunta de negocio).
Ninguno bloquea el uso; sí conviene resolverlos antes de cerrar.

---

## ✅ Módulos probados y funcionando

| Módulo | Estado |
|---|---|
| **Roles** (ABM) | OK |
| **Permisos** (ABM) | OK |
| **Usuarios** — alta (solo SUPERADMIN) | OK |
| **Categorías** (ABM, jerárquico) | OK — incluye **profundidad arbitraria** (sub-sub-…) |
| **Modalidades** (ABM) | OK |
| **Eventos de Vida** (ABM) | OK |
| **Destinatarios / Recipients** (ABM) | OK |
| **Organismos** + **Tipos de Organismo** (ABM) | OK |

**Detalles verificados:**
- Categorías: el árbol soporta N niveles; la localidad en el form de Organismos carga bien y es **read-only** (correcto, es dato maestro).
- RBAC: si se **elimina un rol asignado** a un usuario, ese usuario al loguear recibe *"Tu usuario no tiene acceso al panel de administración"* → **correcto** (queda sin autoridad).

---

## ✅ Manejo de errores (todos correctos)

| Caso | Código esperado | Resultado |
|---|---|---|
| Permiso con nombre duplicado | `4062` | ✅ |
| Categoría con slug duplicado | `4072` | ✅ |
| Eliminar sub-categoría que tiene sub-categorías | `4065` | ✅ |
| Modalidad con nombre duplicado | `4072` | ✅ |
| Evento de vida con nombre duplicado | `4072` | ✅ |
| Tipo de organismo con nombre duplicado | `4063` | ✅ |
| Desactivar/eliminar tipo de organismo con organismos asignados | `4066` | ✅ |
| Eliminar organismo con organismos hijos | `4067` | ✅ |
| Editar organismo cuyo padre está desactivado | `4071` (409) | ✅ |

---

## ⚠️ A resolver

### 1. Editar Rol no muestra el `active` — **(backend, contrato)**
Al editar un rol, el toggle de **"activo" no refleja el valor real**. Causa: el `RoleResponseDTO` del
backend **no devuelve el campo `active`** (sí lo acepta en el request de creación/edición, pero no lo expone
en la respuesta), así que el front no tiene con qué precargar el toggle y muestra el default.
**Fix sugerido:** agregar `active` al `RoleResponseDTO`. *(Mientras tanto, en el front el toggle en edición
queda en el default; podemos ocultarlo en edición si prefieren, pero lo correcto es que el backend lo devuelva.)*

### 2. Acrónimo de organismo duplicado devuelve `5000` — **(backend)**
Al crear un organismo con un **acrónimo ya existente**, el backend responde **`5000` (error genérico)**;
debería devolver el **código específico de acrónimo duplicado (`4069`)**. Efecto: el front muestra
"Ha ocurrido un error interno" en vez del mensaje claro de conflicto.
**Fix sugerido:** capturar la violación de unicidad del acrónimo y lanzar `4069` (409), como ya hace con el
resto de duplicados.

---

## ❓ Pregunta de negocio

### Desactivar un organismo con **hijos activos** no da error
- Eliminar un organismo con hijos activos → `4067` (bloqueado) ✅
- **Des**activar (poner `active=false`) un organismo con hijos activos → **sin error** (se permite).

¿Es intencional? Queda un padre inactivo con hijos activos colgando. Si el criterio es que no debería
permitirse (o que debería cascadear la desactivación), es una regla a definir del lado backend/producto.

---

## Notas
- **Front:** todo lo de arriba se probó contra el backend real; el frontend está alineado al contrato actual.
- **RBAC:** recordar que hoy el backend autoriza por **rol** (no por permiso). Ver `PROPUESTA_RBAC_BACKEND.md`
  para el fix que vuelve el sistema de permisos funcional y escalable.
- Los 2 ítems de "A resolver" y la pregunta abierta son **del lado backend** — el front ya los muestra/maneja
  con lo que recibe.
