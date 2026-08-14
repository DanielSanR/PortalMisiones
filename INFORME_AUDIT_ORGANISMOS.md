# Auditoría UX — Sección Organismos (backoffice)

**Fecha:** 2026-08-11 · **Modo:** AUDIT (sin modificar código)
**Herramienta:** skill `checklist-design` — corpus de checklist.design

**Checklists consultados:** `design-system/table` · `design-system/input-field` ·
`design-system/accessibility` · `flows/filtering-items` · `flows/submitting-a-form` ·
`flows/showing-input-error` · `flows/saving-changes` · `flows/deleting-account` ·
`web-app/empty-state`

**Alcance:** `pages/organismos/list/`, `pages/organismos/create/` y los componentes de
`@shared` que consumen (`table`, `dynamic-form`, `dynamic-form-field`, `confirm-dialog`,
`filter-tabs`).

**Sin hallazgos 🔴 bloqueantes.** Hay confirmación de borrado, foco visible vía mixin
`focus-ring`, y el feedback de error existe —aunque incompleto— vía el diálogo global.

---

## Los dos que son bugs, no pulido

### Ciclos en la jerarquía de organismos
`organismo-form.component.ts:51`

```ts
.filter((o) => o.id !== this.editId) // evita auto-referencia como padre
```

Se excluye la auto-referencia, pero **no los descendientes**. Editando un organismo se puede
elegir como padre a un hijo o nieto suyo, generando un ciclo en el árbol sin ningún aviso
cliente-side. La regla de borrado ya asume que la jerarquía es un árbol ("organismos hijos
activos"), así que un ciclo la deja en un estado que el propio código no contempla.

### "Cancelar" durante el guardado aborta el request en curso
`dynamic-form.component.html:24` · `organismo-form.component.ts:74-105`

El botón Cancelar no se deshabilita mientras `saving` está activo. Si el usuario hace click en
"Guardar cambios" y después en "Cancelar" con la request en vuelo, `goBack()` navega, destruye
el componente, y `takeUntilDestroyed` corta la suscripción — abortando el HTTP. **El guardado se
pierde en silencio**, sin error ni confirmación de que se descartó.

---

## Listado (`organismos-list`)

| # | Gap | Sev. | Evidencia |
|---|---|---|---|
| 1 | Estado de error no cableado: `load()` solo togglea `loading`, nunca setea `[error]`/`(retry)`. Si falla la carga, tras cerrar el diálogo global la lista muestra el empty state genérico como si estuviera vacía de verdad. El componente ya soporta error + Reintentar. | 🟡 | `organismos-list.component.ts:68-76` · `.html:12-17` · soporte en `table.component.ts:94-98` |
| 2 | `emptyMessage` estático: filtrar "Inactivos" sin resultados muestra el mismo texto que una tabla realmente vacía. No distingue *zero state* de *no-results*, ni ofrece quitar el filtro. | 🟡 | `organismos-list.component.html:12-17` · filtro en `.ts:41-46` |
| 3 | Sin buscador, sin orden y sin paginación, a diferencia de Trámites que usa el mismo `app-shared-table`. Solo hay 3 tabs Todos/Activos/Inactivos. | 🟡 | `.html:7-10` · `.ts:48-53` |
| 4 | **Jerarquía invisible**: `parentId` existe y el mensaje de borrado habla de "organismos hijos", pero la tabla es plana. No se puede saber si un organismo tiene hijos antes de intentar eliminarlo. | 🟡 | `.ts:48-53` (columnas sin `parentId`) · `.ts:86-94` · `organismo.vm.ts:8-17` |
| 5 | Borrado sin feedback de "en curso": el diálogo cierra al instante y recién después arranca el `delete()`. Con red lenta no hay señal entre el click y el snackbar. | 🔵 | `.ts:86-105` |
| 6 | Columna "Tipo" se oculta entera en mobile sin degradar a texto secundario en la celda Nombre: el dato se pierde, no se reordena. | 🔵 | `.ts:50` · `.html:19-21` |
| 7 | El empty state real no usa `emptyActionLabel`/`emptyAction` (ya soportados): solo queda el botón de arriba, gateado por permiso y menos visible. | 🔵 | `.html:12-17` |

## Formulario (`organismo-form` + `dynamic-form`)

| # | Gap | Sev. | Evidencia |
|---|---|---|---|
| 1 | Ciclos en la jerarquía — ver arriba. | 🟡 | `organismo-form.component.ts:48-53` |
| 2 | Un select con catálogo vacío muestra `"Cargando opciones..."` para siempre. Con `typeId` —requerido y sin opción "ninguno"— el usuario queda bloqueado sin entender que primero hay que crear un tipo. | 🟡 | `dynamic-form-field.component.html:119-121` y `137-139` · `dynamic-form.config.ts:212-220` |
| 3 | "Cancelar" no se deshabilita durante `saving` — ver arriba. | 🟡 | `dynamic-form.component.html:24-26` |
| 4 | Sin protección de cambios sin guardar: Cancelar y la navegación del sidenav descartan el formulario dirty sin confirmar. `CanDeactivate` no existe en todo el repo. | 🟡 | `organismo-form.component.ts:107-109` |
| 5 | Los errores de guardado los resuelve el interceptor global con mensajes genéricos por status; no se mapean al campo que los causó. El banner del `dynamic-form` solo cubre validación client-side. | 🔵 | `organismo-form.component.ts:100-104` · `http-error.service.ts:40-41` |
| 6 | `acronym` sin `maxLength` ni contador, a diferencia de `nombre` — riesgo de truncamiento silencioso si el backend sí limita. | 🔵 | `dynamic-form.config.ts:206-211` |

## Componentes compartidos

- **`app-shared-table`** — ya trae skeleton, empty state y **error state con retry** completos.
  El gap no es del componente: es que la pantalla no los cablea.
- **`app-confirm-dialog`** — sin estado "confirmando…": cierra optimistamente antes de saber si
  la acción async funcionó. Afecta al borrado de organismos.
- **`app-dynamic-form-field`** — el placeholder de select no diferencia "cargando" de "sin opciones".
- **`app-filter-tabs`** — `role="tablist"`/`role="tab"` sin roving-tabindex ni navegación con
  flechas (patrón ARIA APG). Deuda heredada del componente, no específica de Organismos.

---

## Backlog priorizado

**🟡 Primero — funcionalidad presente pero incompleta**

1. Excluir descendientes al armar "Organismo padre" — evitar ciclos. *(bug)*
2. Deshabilitar "Cancelar" durante `saving` — evitar abortar el guardado. *(bug)*
3. Cablear `[error]`/`(retry)` en el listado — distinguir error de lista vacía.
4. Placeholder distinto para select sin opciones vs. cargando (`typeId` bloquea el alta).
5. `emptyMessage` reactivo al filtro activo.
6. Mostrar la relación padre/hijo en el listado.
7. Buscador + orden en el listado, consistente con Trámites.
8. Guard de cambios sin guardar (afecta a todo el proyecto, no solo a Organismos).

**🔵 Después — pulido**

Loading durante el borrado · "Tipo" como texto secundario en mobile · CTA en el empty state ·
`confirm-dialog` con estado async · `filter-tabs` con roving-tabindex · `maxLength` en `acronym` ·
mapeo de errores de servidor a campos.

---

## Lo que ya está bien resuelto

Labels con `for`/`aria-labelledby`, asterisco de requerido y "(opcional)" explícito, banner
resumen de errores tras el primer submit inválido, botón Guardar con spinner y `[disabled]`,
snackbar de éxito con navegación de vuelta. Cubren la mayor parte de `flows/submitting-a-form`
y `flows/saving-changes`.
