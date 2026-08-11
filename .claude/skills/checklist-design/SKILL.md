---
name: checklist-design
description: Corpus local de 112 checklists de UI/UX (checklist.design) para implementar o auditar interfaz. Úsalo al crear o pulir cualquier pantalla, componente o flujo del backoffice/portal, y para auditar UX de lo ya construido. Resuelve el checklist aplicable desde un pedido en español y obliga a reportar cobertura.
---

# Checklist Design — patrones de UI/UX

Corpus local de **112 checklists** (**818 puntos de verificación**) extraídos de
[checklist.design](https://www.checklist.design/). Sirven para no improvisar qué estados,
casos borde y feedback tiene que cubrir una interfaz.

**Los checklists dicen QUÉ considerar, nunca CÓMO implementarlo.** El *cómo* lo mandan
`.claude/rules/`, los tokens `var(--theme-*)` y Angular Material.

## Cómo leer un checklist

1. Resolvé el par `categoría/slug` con el **índice bilingüe** de más abajo.
2. Leé `references/<categoría>/<slug>.md`.
3. Si el archivo no existe, traelo y cacheálo:
   `node .claude/skills/checklist-design/scripts/sync.mjs --category <cat> --slug <slug>`

**Nunca inventes un slug.** Si el pedido no mapea a ninguno, seguí sin checklist y decilo.

## Modo BUILD — implementar o pulir

1. **Resolver** los checklists aplicables. Una pantalla casi nunca es uno solo:
   *"listado de trámites con filtros"* = `design-system/table` + `design-system/searchbar`
   + `flows/filtering-items` + `web-app/empty-state`.
2. **Leer** los references correspondientes.
3. **Reconciliar.** Ante conflicto gana, en este orden: `.claude/rules/` → tokens del tema →
   Material y componentes de `@shared`. Un ítem que no aplica se marca **N/A con motivo**.
4. **Reportar el gate.** Al terminar, tabla de cobertura:

   | Ítem | Estado | Nota |
   |---|---|---|
   | Empty state | ✅ | `tramites-list.html:42` |
   | Loading skeleton | ⬜ | pendiente sugerido — fuera del pedido |
   | Dark mode | N/A | el backoffice no tiene tema oscuro |

   **Sin esa tabla el trabajo no está terminado.**

**Anti-scope-creep (crítico):** un ítem del checklist **no autoriza** features fuera de lo que
pidió el usuario. Lo no pedido va como ⬜ *pendiente sugerido*; no se implementa.

## Modo AUDIT — revisar lo existente

1. **Inventariar** pantallas y componentes (`backoffice/src/app/pages/**`, `shared/components/**`).
2. **Mapear** cada uno a sus checklists vía el índice bilingüe.
3. **Contrastar** punto por punto contra el código real (HTML + SCSS + TS de presentación).
   Cada veredicto se ancla a `archivo:línea`. **Un gap sin evidencia en el código no se reporta.**
4. **Clasificar**:
   - 🔴 **Bloqueante** — rompe accesibilidad o deja al usuario sin feedback (error sin mensaje,
     acción destructiva sin confirmación, foco no visible).
   - 🟡 **Mejora** — el patrón existe pero incompleto (tabla sin empty-state, sin estado de carga).
   - 🔵 **Nice-to-have** — pulido (skeletons, densidad, microcopy).
5. **Entregar** informe por pantalla + backlog consolidado y priorizado.
   El informe **propone, no implementa**: cada ítem se ejecuta después con el modo BUILD.

**Fuera de alcance:** copiar la estética de checklist.design. El lenguaje visual del backoffice
es el de la marca Misiones y no se toca. Se importa UX funcional, no diseño gráfico.

## Índice bilingüe — pedido en español → checklist

| Pedido | Checklist(s) |
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
| notificaciones, avisos, toast | `design-system/toast` + `web-app/notifications` |
| eliminar, baja, borrar | `flows/deleting-account` (patrón de confirmación destructiva) |
| wizard, alta en pasos | `web-app/multi-step-form` |
| carga de archivos, adjuntos | `flows/uploading-media` |
| login, ingreso, acceso | `web-app/login` |
| configuración, preferencias | `web-app/settings` |
| perfil, mi cuenta | `web-app/account` |
| modal, diálogo, popup | `design-system/modal` |
| panel lateral, drawer | `design-system/drawer` |
| menú desplegable, select | `design-system/dropdown-menu` |
| pestañas, solapas | `design-system/tabs` |
| tarjeta, card, widget | `design-system/card` |
| botón, acción | `design-system/button` |
| chip, etiqueta, estado | `design-system/badge` |
| carga, spinner, esqueleto | `design-system/loading` + `design-system/skeleton` |
| fecha, calendario, rango | `design-system/date-picker` |
| tooltip, ayuda contextual | `design-system/tooltip` |
| aviso, banner, alerta | `design-system/banner` |
| accesibilidad, contraste, foco | `design-system/accessibility` |
| tokens, tema, colores, espaciados | `design-system/tokens` + `design-system/color-system` + `design-system/spacing-and-grid` |
| tipografía, jerarquía de texto | `design-system/typography` |
| onboarding, primeros pasos | `web-app/onboarding` |
| historial, versiones, auditoría | `web-app/version-history` |
| ayuda, soporte | `web-app/help-center` + `flows/contacting-support` |
| mantenimiento, caída | `web-app/maintenance` |
| 2FA, doble factor | `web-app/2-factor-authentication` |
| recuperar contraseña | `flows/resetting-password` |
| verificar cuenta, validar mail | `flows/verifying-account` |

Para lo que no esté en esta tabla, buscá el slug en el catálogo de abajo.

## Catálogo completo

<!-- BEGIN:CATALOGO-GENERADO -->
<!-- Se llena al correr scripts/sync.mjs -->
<!-- END:CATALOGO-GENERADO -->

## Mantenimiento

```bash
node .claude/skills/checklist-design/scripts/sync.mjs                       # las 112
node .claude/skills/checklist-design/scripts/sync.mjs --category flows      # una categoría
node .claude/skills/checklist-design/scripts/sync.mjs --category design-system --slug table
node --test .claude/skills/checklist-design/scripts/                        # tests
```

Fuente y contrato de la API: `BRIEF_CHECKLIST_DESIGN.md` en la raíz del repo.
