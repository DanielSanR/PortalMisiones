# Brief — Integración de `checklist.design` como fuente de patrones UI/UX

**Fecha:** 2026-08-11 · **Estado:** spec aprobado, pendiente de implementación
**Objetivo:** que los agentes del repo (`front-design` y sucesores) implementen y auditen UI
siguiendo checklists de UX validados, en lugar de improvisar qué estados y casos borde cubrir.

---

## 1. Qué es la fuente

[`checklist.design`](https://www.checklist.design/) — colección de **112 checklists** de UI/UX,
agrupados en 5 categorías. Cada checklist es una lista de ítems (`title` + `description` +
`suggestion` opcional) que enumeran lo que hay que resolver para un componente, pantalla o flujo.

| Categoría | Slug | # | Relevancia para este repo |
|---|---|---|---|
| Design system | `design-system` | 29 | **Alta** — backoffice. `button`, `input-field`, `modal`, `table`, `tabs`, `toast`, `dropdown-menu`, `accordion`, `badge`, `avatar`, `card`, `checkbox`, `radio`, `toggle`, `slider`, `searchbar`, `tooltip`, `drawer`, `banner`, `carousel`, `skeleton`, `loading`, `date-picker`, `icon`, `accessibility`, `typography`, `color-system`, `spacing-and-grid`, `tokens` |
| Web app | `web-app` | 27 | **Alta** — backoffice. `admin-panel`, `user-management`, `settings`, `account`, `empty-state`, `search-results`, `multi-step-form`, `notifications`, `notification-settings`, `analytics`, `onboarding`, `login`, `2-factor-authentication`, `api-keys`, `integrations`, `version-history`, `comments`, `feed`, `timeline-gantt-view`, `kanban-board-view`, `single-item-detail`, `help-center`, `chat`, `billing`, `pricing`, `maintenance`, `public-profile` |
| Flows | `flows` | 13 | **Alta** — transversal. `submitting-a-form`, `showing-input-error`, `saving-changes`, `filtering-items`, `deleting-account`, `resetting-password`, `verifying-account`, `uploading-media`, `adding-to-cart`, `canceling-subscription`, `entering-promo-code`, `making-a-payment`, `contacting-support` |
| Website | `website` | 23 | **Media** — aplica a `portal/` (Next.js público), no al backoffice |
| Mobile app | `mobile` | 20 | **Baja** — se archiva por completitud |

---

## 2. Contrato de datos (fuente de verdad técnica)

`checklist.design` es una **SPA React (Vite + Supabase)**. El contenido NO está en el HTML servido.
Se accede por una **API JSON pública, sin autenticación**.

**Base:** `https://www.checklist.design`

### `GET /api/checklists/grouped`

Índice completo (~74 KB). Una sola llamada devuelve las 5 categorías con sus 112 checklists.

```jsonc
{
  "success": true,
  "grouped": [
    {
      "id": "uuid", "name": "Design system", "slug": "design-system",
      "tab_type": "documentation", "sort_order": 2,
      "checklists": [
        { "id": "uuid", "name": "Button", "slug": "button",
          "description": "…", "icon_url": "https://…svg",
          "category_id": "uuid", "sort_order": 0 }
      ]
    }
  ]
}
```

### `GET /api/checklists/by-slug?slug=<slug>&category=<category-slug>`

Checklist completo (~9 KB).

```jsonc
{
  "success": true,
  "checklist": { "id": "uuid", "name": "Button", "slug": "button", "description": "…" },
  "items": [                                  // ← EL CHECKLIST REAL
    { "title": "Base style",
      "description": "Your default style, one of the following: fill, outline, underline",
      "suggestion": null, "sort_order": 0 },
    { "title": "Copy",
      "description": "Instructional text that details what will happen if you click the button",
      "suggestion": "Users should understand what will happen before clicking a button…",
      "sort_order": 3 }
  ],
  "tabs": [                                   // notas explicativas con imagen de referencia
    { "title": "Sizes", "description": "Having multiple sizes helps…",
      "image_url": "https://framerusercontent.com/…svg", "sort_order": 0 }
  ],
  "related": [], "collections": [], "sameNameOnOtherPlatforms": []
}
```

**`category` es obligatorio en la práctica.** Nueve slugs existen en más de una categoría
(`login`, `billing`, `pricing`, `cart`, `search`, `onboarding`, `account`, `chat`, `settings`).
Sin `category`, la API responde **404** con
`{"success":false,"error":"JSON object requested, multiple (or no) rows returned"}`.
Verificado: `slug=login` → 404 · `slug=login&category=web-app` → 200.

### Anti-patrones verificados — NO hacer

| ❌ | Por qué |
|---|---|
| `WebFetch https://www.checklist.design/design-system/button` | SPA: el HTML es un shell de 3 KB con `<div id="root">`. Devuelve solo el `<title>`. |
| `GET https://qbvdnsyfihtqsnbioyoa.supabase.co/rest/v1/checklists` | Las tablas existen pero RLS devuelve `[]` a la clave anónima. |
| Scrapear con Playwright | Innecesario: la API JSON da el mismo contenido, estructurado y sin coste de render. |

---

## 3. Artefacto a construir

```
.claude/skills/checklist-design/
├── SKILL.md                    # protocolo de uso + índice bilingüe
├── references/
│   ├── design-system/{button,input-field,modal,table,…}.md      # 29
│   ├── web-app/{admin-panel,empty-state,search-results,…}.md    # 27
│   ├── flows/{showing-input-error,saving-changes,…}.md          # 13
│   ├── website/…                                                # 23
│   └── mobile/…                                                 # 20
└── scripts/sync.mjs            # regenera índice + references desde la API
```

**Por qué skill y no rule:** una `rule` path-scoped se inyecta en toda tarea que toque
`backoffice/src/**`, incluidas las que no son de UI, y no puede cargar 112 checklists.
La skill no consume contexto hasta invocarse y es el patrón que ya usa el repo
(`nueva-feature`, `migrar-pantalla`).

**Por qué snapshot local y no fetch en vivo:** lectura instantánea, offline, sin coste de red por
tarea, y degradación elegante si la API cambia o desaparece. El fetch queda como fallback
on-demand cuando falta un slug.

### Formato de cada `references/<categoría>/<slug>.md`

Contenido **en inglés literal**, tal como lo devuelve la API — así el `sync` sobrescribe sin
conflictos y todo queda trazable contra la fuente. La traducción vive en el índice, no en los datos.

```markdown
---
slug: button
category: design-system
source: https://www.checklist.design/design-system/button
synced: 2026-08-11
---

# Button

> A button is an interactive element that triggers an action when clicked or tapped…

## Checklist

- [ ] **Base style** — Your default style, one of the following: fill, outline, underline
- [ ] **Shape** — Visual properties of a button: padding, border, border radius, shadow
- [ ] **Copy** — Instructional text that details what will happen if you click the button
      💡 Users should understand what will happen before clicking a button. Buttons can have
      generic copy such as 'Okay' or 'Cancel', but only if there is context around that action.

## Notas

- **Sizes** — Having multiple sizes helps with a complex interface that has several actions.
- **States** — To help indicate an interaction (or lack of one) on a button.

## Relacionados

- design-system/badge · design-system/icon
```

### Índice bilingüe (en `SKILL.md`)

Tabla que mapea el vocabulario español del repo al par `categoría/slug`. Sin esto el agente
resuelve bien `modal` o `table`, pero falla en "mostrar error de validación" → `showing-input-error`.

| Pedido en español | Checklist |
|---|---|
| tabla, listado, grilla | `design-system/table` |
| filtros, filtrar resultados | `flows/filtering-items` |
| formulario, alta, edición | `flows/submitting-a-form` + `design-system/input-field` |
| error de validación, campo inválido | `flows/showing-input-error` |
| guardar, confirmar cambios | `flows/saving-changes` |
| sin resultados, lista vacía | `web-app/empty-state` |
| buscador, búsqueda | `design-system/searchbar` + `web-app/search-results` |
| usuarios, roles, permisos | `web-app/user-management` |
| dashboard, panel, home | `web-app/admin-panel` + `web-app/analytics` |
| detalle de trámite/organismo | `web-app/single-item-detail` |
| notificaciones, avisos | `design-system/toast` + `web-app/notifications` |
| eliminar, baja | `flows/deleting-account` (patrón de confirmación destructiva) |
| wizard, alta en pasos | `web-app/multi-step-form` |
| carga de archivos, adjuntos | `flows/uploading-media` |
| login, ingreso | `web-app/login` |
| configuración, preferencias | `web-app/settings` |
| accesibilidad, contraste, foco | `design-system/accessibility` |
| tokens, tema, colores, espaciados | `design-system/tokens` + `color-system` + `spacing-and-grid` |

(La tabla completa se genera durante la implementación; esto es la semilla.)

---

## 4. Los dos modos de uso

### Modo A — BUILD (implementar algo nuevo o pulir una pantalla)

1. **Resolver slug.** Pedido en español → índice bilingüe → `categoría/slug`.
   Sin match razonable: seguir sin checklist. **Nunca inventar un slug.**
2. **Leer** `references/<categoría>/<slug>.md`. Si el archivo falta → fetch on-demand a la API y
   cachear en `references/`.
3. **Componer varios.** Una pantalla casi nunca es un solo checklist.
   Ej. *"listado de trámites con filtros"* = `design-system/table` + `design-system/searchbar` +
   `flows/filtering-items` + `web-app/empty-state`.
4. **Reconciliar con el repo.** El checklist dice **qué considerar**, nunca **cómo implementarlo**.
   Ante cualquier conflicto ganan, en este orden: `.claude/rules/` → tokens `var(--theme-*)` →
   Angular Material y componentes de `@shared`. Un ítem que no aplica (ej. *dark mode*, que el
   backoffice no tiene) se marca **N/A con motivo**, no se implementa.
5. **Reportar el gate.** Al terminar, tabla de cobertura:

   | Ítem | Estado | Nota |
   |---|---|---|
   | Empty state | ✅ | `mat-table` con `*ngIf="!(rows$ \| async)?.length"` |
   | Loading skeleton | ⬜ | pendiente sugerido — fuera del pedido |
   | Dark mode | N/A | el backoffice no soporta tema oscuro |

   **Sin esa tabla el trabajo no está terminado.**

### Modo B — AUDIT (revisar lo existente y proponer upgrades)

Este es el uso que motiva el brief a mediano plazo: auditar el backoffice completo contra el
corpus de checklists (design-system + web-app + flows) y sacar un plan de mejora UI/UX priorizado.

1. **Inventariar** las pantallas y componentes del backoffice (`backoffice/src/app/pages/**`,
   `shared/components/**`).
2. **Mapear** cada uno a sus checklists aplicables vía índice bilingüe.
3. **Contrastar ítem por ítem** contra el código real (HTML + SCSS + TS de presentación).
   Cada veredicto se ancla a `archivo:línea` — un gap sin evidencia en el código no se reporta.
4. **Clasificar** los gaps:
   - 🔴 **Bloqueante** — rompe accesibilidad o deja al usuario sin feedback (error sin mensaje,
     acción destructiva sin confirmación, foco no visible).
   - 🟡 **Mejora** — el patrón existe pero incompleto (tabla sin empty-state, sin estado de carga).
   - 🔵 **Nice-to-have** — pulido (skeletons, densidad, microcopy).
5. **Entregar** un informe por pantalla + un backlog consolidado y priorizado.
   El informe **propone**, no implementa: cada ítem es un cambio acotado que después se ejecuta
   por separado con Modo A.

**Fuera de alcance explícito:** copiar la estética de `checklist.design` (tipografía, color,
densidad). El lenguaje visual del backoffice es el de la marca Misiones y no se toca. Lo que se
importa es **UX funcional**: estados, casos borde, feedback, accesibilidad, jerarquía.

---

## 5. Gancho en el agente `front-design`

Dos ediciones quirúrgicas a `.claude/agents/front-design.md` — no se reescribe el agente:

1. **Nuevo paso 0 en `## Flujo`:** identificar los checklists aplicables vía la skill
   `checklist-design` **antes** de escribir código.
2. **Nuevo paso final:** emitir la tabla de cobertura del §4.A.5 como parte del entregable.
3. **Regla anti-scope-creep** (crítica): un ítem del checklist **no autoriza** features fuera del
   pedido del usuario. Lo no pedido va a la tabla como ⬜ *pendiente sugerido*; no se implementa.

---

## 6. Sync

```bash
node .claude/skills/checklist-design/scripts/sync.mjs              # todo
node .claude/skills/checklist-design/scripts/sync.mjs --category design-system
node .claude/skills/checklist-design/scripts/sync.mjs --slug table --category design-system
```

- Sin dependencias: `fetch` nativo de Node 20.11.0 (versión del proyecto).
- Idempotente: reescribe `references/` y el bloque de índice generado de `SKILL.md`.
- Falla ruidosamente y con código de salida ≠ 0 si la forma de la respuesta cambia — no escribe
  archivos a medias.
- Rate limiting: 112 requests secuenciales con ~150 ms de pausa entre cada uno (≈20 s en total);
  no paraleliza contra un sitio ajeno.

---

## 7. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| La API no es pública ni versionada; puede cambiar o cerrarse | El snapshot local sigue sirviendo. `sync` falla ruidosamente y se ajusta el parser. |
| El agente trata el checklist como spec de features y agranda el alcance | Regla anti-scope-creep en `front-design` + estado ⬜ *pendiente sugerido*. |
| Los checklists contradicen las reglas del repo | Orden de precedencia explícito en §4.A.4: gana el repo, siempre. |
| Ruido: 112 checklists inflando el contexto | La skill carga solo el índice; los `references/` se leen bajo demanda, uno por uno. |
| El contenido en inglés choca con el repo en español | El índice bilingüe traduce a la entrada; el reporte del agente sale en español. |

---

## 8. Criterio de terminado

- [ ] `references/` con 112 archivos generados por `sync.mjs`
- [ ] `SKILL.md` con protocolo (modos A y B) + índice bilingüe completo
- [ ] `sync.mjs` corre limpio de punta a punta y es idempotente (segunda corrida = sin diff)
- [ ] `front-design.md` con paso 0, gate final y regla anti-scope-creep
- [ ] Prueba end-to-end: pedir a `front-design` un ajuste real sobre una pantalla existente y
      verificar que resuelve el slug, lee el reference y emite la tabla de cobertura
