# Brief — Rediseño del Design System (Backoffice Misiones)

> **Para:** el agente/sesión de Claude Code que ejecuta el rediseño.
> **Qué es esto:** la especificación de dirección visual + sistema de diseño + reglas para rediseñar
> **todo** el backoffice (Angular 17). No es un rediseño desde cero: **evoluciona** el design system que ya
> existe en `backoffice/src/shared-styles/`.
> **Ámbito:** solo `backoffice/`. El portal público (Next.js) es de otro equipo y queda fuera.
>
> **Nota (2026-10): documento histórico.** El sistema vigente está en `DESIGN.md` + `backoffice/src/shared-styles/`.
> Donde difieran, mandan esos. Correcciones conocidas: Oak Sans **no** está self-hosted (se renderiza Figtree);
> los íconos son **Phosphor regular** (no Material Symbols); el sidebar es claro (no navy); WCAG 2.2 AA gana sobre
> el diseño; el apéndice §14 (tokens actuales) está desactualizado.

---

## 0. Decisiones ya tomadas (no re-preguntar)

| Decisión | Valor |
|---|---|
| Base de componentes | **Retematizar Angular Material** (theming + overrides globales). No reemplazar Material. |
| Dirección visual | **Institucional moderno y sobrio**: limpio, confiable, respiro en blanco, azul como acento, jerarquía tipográfica fuerte. |
| Marca | **Azul institucional Misiones se mantiene** (`#2F6EB1` / `#3B82C4`). Se puede refinar la escala y los neutros, no el hue base. |
| Tema | **Solo claro.** Dejar los tokens preparados por si luego se agrega oscuro, pero no implementarlo. |
| Alcance | **Rediseño total**, incluyendo las ~14 pantallas. Se ejecuta por fases (§11). |
| Tipografía | **Oak Sans** (declarada, aún no self-hosted → se renderiza Figtree). Se mantiene; se define jerarquía/escala. No migrar a Inter/Roboto/Poppins. |

---

## 1. Contexto y qué NO se toca

Panel de administración provincial (Subsecretaría de Gobierno Inteligente, Vicegobernación de Misiones). Lo
usan **empleados públicos** que pasan horas adentro: prioridad **claridad, confianza, eficiencia y accesibilidad**,
no espectáculo. Es una herramienta institucional, no una landing.

**Prohibido tocar (esto es rediseño VISUAL, no funcional):**
- La **arquitectura de capas** (`core/features/<x>/`: Componente→Facade→Repository→DataSource). El rediseño vive
  en la capa de presentación: `.html`, `.scss`, y `.ts` **solo** de componentes de presentación.
- Los **facades/observables/contratos** con el backend. No cambiar lógica de datos ni endpoints.
- El **RBAC** recién migrado (nav/rutas por permiso, `*appHasPermission`). No alterar gating.
- Los nombres de rutas, selectores públicos ni las APIs de los componentes `@shared` (se pueden mejorar por dentro).

**Reglas duras del proyecto (leerlas antes de escribir una línea):** `.claude/rules/componentes-angular.md`,
`.claude/rules/scss-bem.md`, `.claude/rules/arquitectura-capas.md`. Y las skills `migrar-pantalla` / `nueva-feature`
para el patrón de cada pantalla.

---

## 2. Principios de diseño (el norte)

1. **Claridad institucional primero.** Cada pantalla comunica jerarquía en 1 segundo: qué es, qué puedo hacer,
   dónde estoy. La densidad es **cómoda** (no apretada): el empleado escanea tablas todo el día.
2. **El azul se gana su lugar.** Fondo neutro y mucho blanco; el azul institucional aparece con intención
   (acción primaria, estado activo, foco, acentos), nunca como relleno. Dominante neutro + acento azul nítido.
3. **Tipografía como sistema, no decoración.** Jerarquía fuerte con Oak Sans: títulos con peso y aire, cuerpo
   legible a 14px, labels en mayúscula con tracking. El texto ordena la página.
4. **Consistencia por tokens.** Cero valores hardcodeados. Todo sale de `--theme-*`. Un cambio de token se
   propaga a todo. Si un patrón se repite ≥2 veces → mixin/clase compartida en `shared-styles/`.
5. **Calma y quietud.** Sombras suaves, bordes finos, transiciones cortas (150–250ms). Sin gradientes chillones,
   sin animación gratuita. El movimiento solo confirma acciones (hover, foco, entrada de fila, apertura de dialog).
6. **Accesible por defecto.** WCAG 2.1 AA: contraste ≥ 4.5:1 en texto, foco **siempre** visible, navegable por
   teclado, hit targets ≥ 40px, labels reales (es-AR).

**Firma memorable (elegí y aplicá de forma consistente):** un tratamiento distintivo y sobrio del **azul como
sistema de "presencia"** — barra/indicador de acento en el ítem de nav activo y en el encabezado de sección,
más un **anillo de foco azul** coherente en toda la app. Es el detalle que hace que se vea "diseñado", no
"tematizado por defecto". No lo conviertas en ruido: es un acento, no un patrón de fondo.

---

## 3. Fundaciones (tokens) — evolución de `_themes.scss`

Los tokens actuales son una buena base (paleta azul 50–900, grid 8px, radios, sombras, estados de trámite,
z-index, layout). **Refinar, no reemplazar.** Mantené los nombres de token existentes para no romper consumidores;
agregá los nuevos que se indican.

### 3.1 Color
- **Primario / acento:** mantener (`--theme-primary: #2F6EB1`, `--theme-primary-light/accent: #3B82C4` y la escala 50–900).
- **Neutros / superficies (refinar hacia un gris frío institucional):** definir un sistema explícito de superficies:
  - `--theme-surface-app` (fondo de la app): gris muy claro frío (evolucionar `#F4F6F8`).
  - `--theme-surface-card`: blanco puro `#FFFFFF`.
  - `--theme-surface-sunken` (tabla header, wells): un paso más oscuro que app.
  - Bordes: `--theme-border-primary` (1px divisores), `--theme-border-strong` (contornos de input/card).
- **Sidebar:** mantener el navy institucional (`--theme-bg-sidebar: #0F335D`) como ancla de marca; refinar
  estados hover/active con el nuevo indicador de acento (§6.15).
- **Semánticos:** mantener success/error/warning/info + sus `-bg`. Verificar contraste de cada par texto/fondo.
- **Estados de trámite:** conservar los 4 (borrador/revisión/publicado/despublicado) — ya son accesibles.

### 3.2 Tipografía (Oak Sans)
Definir una **escala tipográfica** explícita y usarla en todas las pantallas (no tamaños sueltos):

| Rol | Tamaño | Peso | Uso |
|---|---|---|---|
| Display / título de página | 24–28px | 600 | `<app-page-header>` título |
| Section / h2 | 18–20px | 600 | subsecciones, títulos de card |
| Subtítulo | 14–15px | 400 | subtítulo de page-header (color secundario) |
| Body | 14px | 400 | texto general, celdas de tabla |
| Small | 13px | 400 | metadatos, ayudas |
| Label / overline | 11–12px | 600 | **mayúscula + tracking 0.5px**, headers de tabla, etiquetas de campo |

Line-height: 1.25 títulos, 1.5 cuerpo. Números tabulares (`font-variant-numeric: tabular-nums`) en tablas y
métricas para que las columnas alineen.

### 3.3 Espaciado, radios, sombras, motion
- **Espaciado:** grid de 8px ya definido (`--theme-space-*`). Usar SIEMPRE tokens. Ritmo vertical consistente
  entre page-header → contenido → cards.
- **Radios:** institucional sobrio = radios **moderados**. Cards/inputs/botones `--theme-radius-md` (8px);
  chips/badges `--theme-radius-full`; dialogs `--theme-radius-lg` (12px). Evitar radios gigantes (eso era la
  opción "cálida", descartada).
- **Sombras / elevación:** definir una escala de elevación por capa (0 = plano con borde, 1 = card, 2 = menú/dropdown,
  3 = dialog). Sombras suaves y frías, sin "drop shadow" pesado. Reusar `--theme-shadow-card/-md/-dialog`.
- **Motion:** `--theme-transition-fast (150ms)` hover/foco; `-normal (250ms)` entradas/paneles. Sin animación
  decorativa. Respetar `prefers-reduced-motion`.

### 3.4 Iconografía
> Corrección: el sistema usa **Phosphor Icons regular** (ver `DESIGN.md` §8); lo de abajo quedó superado.

Mantener **Material Symbols** (ya en uso). Un solo set, un solo estilo (recomendado: Rounded, weight 400,
optical size consistente). **Nunca emojis como íconos.** Tamaño base 20px en acciones, 24px en nav.

---

## 4. Grid, layout y shell

- **Sidebar** fijo (`--theme-sidebar-width: 264px`), navy institucional, con logo/marca arriba, nav agrupado,
  usuario/logout abajo. Colapsable a `64px` (solo íconos). Ítem activo con indicador de acento (§6.15).
- **Header** superior (`64px`): breadcrumb / contexto a la izquierda, acciones globales / usuario a la derecha.
  Sticky. Definir si el header es azul (`--theme-bg-header`) o blanco con borde — **recomendado blanco con borde
  inferior fino** para maximizar calma y que el azul quede para acciones (validar con el usuario si dudás).
- **Área de contenido:** fondo `surface-app`, `max-width: var(--theme-content-max-width)` centrado, padding
  generoso y consistente. Formularios a `--theme-form-max-width`.
- **Responsive:** usar los breakpoints/mixins de `shared-styles/_responsive.scss`. Sidebar → drawer en mobile;
  tablas → columnas colapsables (patrón `hideOnMobile` ya existente en `SharedTable`).

---

## 5. Anatomía de página (patrones transversales)

Toda pantalla de gestión sigue uno de 3 patrones. Rediseñarlos como **plantillas** consistentes:

- **List (el patrón dominante):** `<app-page-header título + subtítulo + acción primaria>` → tabla (`SharedTable`)
  con acciones por fila → estados **loading** (skeleton), **empty** (ilustración + CTA) y **error**. Ejemplos:
  Organismos, Categorías, Usuarios, Roles, etc.
- **Form (create/edit):** page-header con back → card de formulario a `form-max-width`, campos agrupados en
  secciones, footer con acciones (Cancelar / Guardar) alineado y sticky si el form es largo. Validación inline es-AR.
- **Detail:** page-header → bloques de información legibles (definición de datos), acciones contextuales.

Consistencia obligatoria: mismo espaciado, misma posición del botón primario (arriba a la derecha en list;
footer en form), mismos estados vacíos/carga en todas las listas.

---

## 6. Biblioteca de componentes (specs)

Para **cada** componente: definir anatomía, variantes, **estados** (default/hover/focus/active/disabled/loading),
y tokens usados. Todos accesibles (foco visible, ARIA, teclado). Retematizar el equivalente Material vía overrides
globales (§10), no por copia local.

1. **Botón** — variantes: `primary` (azul lleno), `secondary` (contorno), `ghost` (texto), `danger`. Tamaños sm/md.
   Estado loading con spinner inline. Ícono opcional izq/der. Foco con anillo azul.
2. **Icon-button / acción de fila** — plano, hover sutil, variante `danger`. Tooltip obligatorio (aria-label).
3. **Input / textarea / form-field** — label arriba, borde `border-strong`, foco azul, mensaje de error inline
   (rojo, con ícono), estado disabled. Placeholder tenue. Prefijo/sufijo opcional.
4. **Select / autocomplete** (Material overlay retematizado) — mismo lenguaje visual que input; panel con sombra 2.
5. **Checkbox / radio / slide-toggle** — colores de marca, foco visible, tamaños táctiles.
6. **Card** — `surface-card`, borde fino + `shadow-card`, header opcional con título section y acciones.
7. **Tabla (`SharedTable`) — pieza central, invertir más acá:** header `surface-sunken` con labels overline,
   filas 52–56px, hover `bg-table-hover`, zebra opcional sutil, números tabulares, columna de acciones alineada
   a la derecha, densidad cómoda. Orden/paginación consistentes. Skeleton de carga. Empty state integrado.
8. **Badge / chip** — pill (`radius-full`), variantes semánticas (neutro/info/success/warning/danger) y scope.
9. **Estado de trámite** (`EstadoBadgePipe`) — usar los 4 tokens de estado; badge con punto/ícono + texto.
10. **Page-header (`@shared`)** — título display + subtítulo secundario + slot de acción primaria a la derecha.
    Opcional: back-button, breadcrumb. Es el "membrete" de cada pantalla; que se vea impecable.
11. **Dialog / confirm (`ConfirmDialogComponent`)** — `radius-lg`, sombra dialog, título + cuerpo + acciones
    (Cancelar ghost / confirmar primary o danger). Foco atrapado, cierre con Esc.
12. **Menú contextual (`mat-menu`)** — sombra 2, ítems con ícono, ítem `danger` diferenciado, disabled con tooltip
    (ya se usa en Roles para proteger la fila SUPERADMIN — mantener ese patrón).
13. **Snackbar / toast** — variantes success/error/info, breve, no intrusivo.
14. **Tooltip** — texto corto, contraste alto.
15. **Nav item (sidebar)** — reposo (texto tenue sobre navy), hover (`bg-sidebar-hover`), **activo** (indicador de
    acento azul + `bg-sidebar-active` + texto pleno). Este es el detalle de firma (§2).
16. **Empty state** — ícono grande tenue + título + texto + CTA. Uno reusable, usado por todas las listas.
17. **Skeleton / loading** — placeholders con shimmer sutil para listas y forms.
18. **Breadcrumb, tabs, pagination, avatar/user-chip** — definir si aparecen; mantenerlos en el mismo lenguaje.

---

## 7. Recorrido por pantalla (alcance total)

Aplicar los patrones §5–6. Notas específicas:

- **Login / Auth** (`auth/`): la cara de la marca. Layout centrado o split, logo institucional, azul de marca,
  form limpio, mensajes de error claros (incluye "sin acceso al backoffice"). Es la primera impresión: cuidarla.
- **Dashboard / Home:** tarjetas de métricas (números tabulares), accesos rápidos, quizás gráficos (si hay datos).
  Sobrio, informativo, sin saturar.
- **Listas ABM** (Organismos, Tipos de Organismo, Categorías —jerárquica, ya rediseñada con árbol expandible—,
  Modalidades, Eventos de Vida, Destinatarios, Etiquetas, Usuarios, Roles, Permisos): patrón List uniforme.
  Respetar el gating por permiso existente en cada botón.
- **Forms** (create/edit de cada ABM): patrón Form uniforme, validación inline, footer de acciones consistente.
- **Categorías:** ya tiene tabla jerárquica con dropdown por fila (default colapsado, acciones planas +/lápiz/
  papelera roja). **Alinear su estilo al nuevo sistema** sin perder la interacción de árbol.
- **Roles:** conservar la protección de la fila SUPERADMIN (editar/eliminar disabled con tooltip).
- **Feedback Ciudadano, Auditoría, Reportes:** pantallas de lectura/analítica. Reportes puede llevar gráficos
  (definir set de colores accesible derivado de la marca). Auditoría = timeline/tabla densa legible.

---

## 8. Accesibilidad (no negociable)

- Contraste texto ≥ 4.5:1, UI ≥ 3:1. Verificar cada par sobre navy (sidebar) y sobre azul (botones/acentos).
- Foco **siempre** visible (anillo azul con offset). Nunca `outline: none` sin reemplazo.
- Navegación completa por teclado; orden lógico; `Esc` cierra overlays; foco atrapado en dialogs.
- Hit targets ≥ 40px. `aria-label` en icon-buttons. Labels reales asociados a inputs.
- Respetar `prefers-reduced-motion`. Íconos decorativos `aria-hidden`.
- Locale **es-AR**, fechas DD/MM/YYYY, labels en español, títulos con verbo en infinitivo (Obtener, Inscribirse).

---

## 9. Anti-patrones (qué NO hacer)

- ❌ Migrar de Oak Sans a Inter/Roboto/Poppins/Arial/system-ui.
- ❌ Gradientes violeta / gradientes chillones / "AI slop". El azul se usa plano y con intención.
- ❌ Hardcodear colores, espaciados, breakpoints, sombras. **Todo por token.**
- ❌ `template:`/`styles:` inline. Vistas SIEMPRE en `.html` + `.scss` separados.
- ❌ Emojis como íconos. ❌ Sombras pesadas por todos lados. ❌ Densidad apretada tipo hoja de cálculo.
- ❌ Romper la dirección de capas o inyectar servicios/HttpClient en componentes de presentación.
- ❌ Introducir Angular **signals** (regla dura del proyecto: RxJS + `async` pipe siempre).

---

## 10. Cómo retematizar Angular Material (mecánica)

- Definir el **theme de Material desde los tokens** (`shared-styles/_material.scss`): paletas primary/accent/warn
  derivadas de la escala azul y del warn existentes; tipografía = Oak Sans; densidad acorde a "cómoda".
- **Overrides globales** de componentes Material en `_material.scss` / `_components.scss` (mat-button, mat-form-field,
  mat-select, mat-menu, mat-dialog, mat-table, mat-slide-toggle, mat-snackbar…), consumiendo `var(--theme-*)`.
  Centralizado, no override local por componente.
- Evitar `::ng-deep` disperso; preferir estilos globales tematizados + clases. Si hace falta perforar encapsulación,
  hacerlo acotado y documentado.
- Los tokens `--theme-*` siguen siendo la **fuente de verdad**; Material los consume, no al revés.

---

## 11. Plan de trabajo por fases (aunque el alcance sea total, ejecutar ordenado)

Cada fase termina **verde**: `npx tsc -p tsconfig.app.json --noEmit`, `npm run check:circular`, `npm run lint`,
`npx ng build`. Y revisión con los agentes del proyecto (`front-design`, `angular-ssr-reviewer`).

1. **Fase 0 — Foundation:** refinar `_themes.scss` (superficies, tipografía, elevación, focus ring), retematizar
   Material (`_material.scss`), definir mixins nuevos en `shared-styles/`. Sin cambios de pantalla todavía.
2. **Fase 1 — Shell:** sidebar (nav item de firma), header, layout, estados vacíos/carga/skeleton compartidos.
3. **Fase 2 — Biblioteca de componentes `@shared`:** botón, form-field, card, `SharedTable`, badge/estado,
   page-header, dialog, menú, snackbar. Rediseñados y documentados (ideal: una página de "kitchen sink").
4. **Fase 3 — Pantallas List:** migrar todas las listas ABM al patrón nuevo (una tanda, patrón idéntico).
5. **Fase 4 — Pantallas Form + Detail:** todos los create/edit y detalles.
6. **Fase 5 — Especiales:** Login, Dashboard, Reportes, Auditoría, Feedback.
7. **Fase 6 — Pulido y QA:** contraste, foco, teclado, responsive, `prefers-reduced-motion`, consistencia final.

Commits chicos por fase (rama + PR), como viene trabajando el equipo.

---

## 12. Definition of Done

- [ ] Toda superficie usa `--theme-*` (0 valores hardcodeados; grep de hex/px sueltos = limpio).
- [ ] SCSS en BEM anidado con `&`, un bloque por componente, vistas separadas.
- [ ] Sin signals; RxJS + `async` pipe; `OnPush`; suscripciones con `takeUntilDestroyed`.
- [ ] Material retematizado globalmente; sin overrides locales duplicados.
- [ ] Las 3 plantillas (List/Form/Detail) son visualmente consistentes en todas las pantallas.
- [ ] WCAG AA: contraste, foco visible, teclado, targets ≥ 40px, `prefers-reduced-motion`.
- [ ] `tsc`, `check:circular`, `lint`, `ng build` verdes. Arquitectura de capas intacta. RBAC intacto.
- [ ] Revisado por `front-design` + `angular-ssr-reviewer`.

---

## 13. Referencias de tono (institucional moderno, NO copiar)

GOV.UK Design System y U.S. Web Design System (claridad institucional, accesibilidad, jerarquía tipográfica);
la contención y el uso del espacio de Linear/Vercel (aplicado con densidad **cómoda**, no compacta). Tomar el
**rigor y la calma**, no la estética literal. El resultado debe verse inconfundiblemente **Misiones** (azul
institucional + Oak Sans), no un template genérico.

---

## 14. Apéndice — Tokens actuales (referencia inline, para evolucionar)

Estos son los tokens que ya existen hoy (`shared-styles/_themes.scss`). Son el **punto de partida**: refinalos
(superficies, tipografía, elevación, focus), no los tires. Conservá los nombres para no romper consumidores.

**Primario — Azul institucional Misiones**
```
50 #E8F1FA · 100 #C5DCF2 · 200 #9EC4E8 · 300 #77ABDE · 400 #5A98D6
500 #3B82C4 · 600 #2F6EB1 · 700 #245A95 · 800 #1A4779 · 900 #0F335D
--theme-primary #2F6EB1 · -dark #245A95 · -darker #1A4779 · -light #3B82C4 · -lighter #5A98D6 · -contrast #FFF
```
**Acento (botones/íconos):** `--theme-accent #3B82C4` (escala 50–800 análoga).
**Warn/destructivo:** `#D32F2F` (light `#EF5350`, dark `#B71C1C`).

**Neutros (grises):** `50 #FAFAFA · 100 #F5F5F5 · 200 #EEEEEE · 300 #E0E0E0 · 400 #BDBDBD · 500 #9E9E9E · 600 #757575 · 700 #616161 · 800 #424242 · 900 #212121`

**Backgrounds:** `app/secondary #F4F6F8` · `card #FFFFFF` · `sidebar #0F335D` · `header #2F6EB1` ·
`table-header #F4F6F8` · `table-hover #F0F5FA` · `table-stripe #F7FAFE` · `overlay rgba(0,0,0,.5)`
(sidebar hover `rgba(255,255,255,.08)`, active `rgba(255,255,255,.20)`).

**Texto:** `primary #1A1A2E · secondary #5F6368 · tertiary #9AA0A6 · disabled #BDBDBD · on-primary #FFF ·
on-dark rgba(255,255,255,.92) / .75 · link #2F6EB1`.

**Bordes:** `primary #E0E0E0 · secondary #EEEEEE · focus #2F6EB1 · input rgba(229,231,235,1)`.

**Semánticos (+ bg):** `success #16A34A / #F0FDF4 · error #D32F2F / #FFEBEE · warning #F57C00 / #FFF3E0 · info #2F6EB1 / #E8F1FA`.

**Estados de trámite (bg / text / border / icon):**
- borrador `#FFF3E0 / #BF360C / #FFCC80 / #E65100`
- revisión `#E8F1FA / #1A4779 / #9EC4E8 / #2F6EB1`
- publicado `#F0FDF4 / #166534 / #86EFAC / #16A34A`
- despublicado `#FFEBEE / #B71C1C / #EF9A9A / #C62828`

**Espaciado (grid 8px):** `2xs 2 · xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64` (px).

**Tipografía:** `--theme-font-family: 'Oak Sans', -apple-system, 'Segoe UI', Roboto, sans-serif`.
Escala: `2xs 11 · xs 12 · sm 13 · base 14 · md 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30` (px).
Pesos: `300/400/500/600/700`. Line-height: `tight 1.25 · normal 1.5 · relaxed 1.75`.

**Radios:** `xs 2 · sm 4 · md 8 · lg 12 · xl 16 · 2xl 20 · full 9999` (px).

**Sombras:**
```
xs   0 1px 2px rgba(0,0,0,.04)
sm   0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)
md   0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)
lg   0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04)
xl   0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.04)
card        0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)
card-hover  0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)
dialog      0 24px 48px rgba(0,0,0,.16), 0 8px 16px rgba(0,0,0,.08)
```

**Layout:** sidebar `264px` (colapsada `64px`) · header `64px` (mobile `56px`) · content-max `1400px` · form-max `1200px`.
**Transiciones:** fast `150ms` · normal `250ms` · slow `350ms` (todas `cubic-bezier(.4,0,.2,1)`).
**Z-index:** dropdown 100 · sticky 200 · header 1000 · sidebar 1100 · overlay 1200 · modal 1300 · toast 1400.

> **Nota para Claude Design:** el stack real es **Angular 17 + Angular Material + SCSS (BEM anidado con `&`)**,
> tokens como **CSS custom properties `--theme-*`**. No es React/Tailwind. Cualquier propuesta visual debe poder
> expresarse como tokens CSS + overrides de Material. La marca (azul `#2F6EB1`/`#3B82C4`) y la tipografía
> (**Oak Sans**) son fijas.
