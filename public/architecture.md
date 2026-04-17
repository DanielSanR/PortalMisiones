# Arquitectura — Portal Público de Trámites (Misiones)

> **Aplicación**: `public/` — Next.js 15 / React 19 / App Router.
> **Propósito**: portal ciudadano público, read-only, que expone el catálogo de trámites provinciales de Misiones.
> **Monorepo**: convive con `backoffice/` (Angular 17 — panel admin) y `shared/types/` (modelos TypeScript compartidos).

---

## 1. Estructura del proyecto

Árbol de directorios agrupado por capa arquitectónica:

```
public/
│
├── app/                                 ⟵ [CAPA ROUTING] Next.js App Router (server components)
│   ├── layout.tsx                       Root layout — fuentes (Oak Sans local + Montserrat), metadata, <html lang="es">
│   ├── page.tsx                         / — Home: hero + destacados + tabs destinatarios + grilla de temas
│   ├── globals.css                      Tailwind v4 + @theme inline + keyframes del MLoader
│   ├── not-found.tsx                    404 global con PortalShell
│   └── tramites/
│       ├── page.tsx                     /tramites — catálogo con filtros por query params
│       ├── loading.tsx                  Suspense → <MLoader />
│       ├── [slug]/
│       │   ├── page.tsx                 /tramites/:slug — ficha detalle + acordeón + CTA + selector localidad
│       │   └── loading.tsx              Suspense → <MLoader />
│       └── categoria/
│           └── [slug]/
│               ├── page.tsx             /tramites/categoria/:slug — categoría raíz + subcategorías + trámites
│               └── loading.tsx          Suspense → <MLoader />
│
├── components/                          ⟵ [CAPA UI] componentes de presentación
│   ├── portal-shell.tsx                 Shell legacy (no usado en páginas actuales)
│   ├── portal-shell-fixed.tsx           ★ Shell activo: navbar pill azul + footer + botón accesibilidad
│   ├── search-filters.tsx               ★ "use client" — filtros maestros con 2 modos (hero / catálogo)
│   ├── search-form.tsx                  Form server-rendered alternativo (form action="/tramites")
│   ├── tramite-card.tsx                 Card de trámite (328×154) con icono lucide + organismo
│   ├── subcategoria-card.tsx            Card de subcategoría con badge de modalidad + chips de etiquetas
│   ├── featured-shortcut-card.tsx       Card "Lo más buscado" (240×140) con icono rotativo
│   ├── home-topic-card.tsx              Card de tema en home, vinculada a /tramites/categoria/:slug
│   ├── m-loader.tsx                     Loader de marca (M animada con anillo cónico + glow)
│   └── ui/                              Primitivos atómicos (shadcn-style, sin runtime de shadcn)
│       ├── badge.tsx
│       ├── button.tsx                   class-variance-authority para variantes
│       ├── card.tsx                     Card / CardContent
│       ├── input.tsx
│       └── select.tsx                   NativeSelect
│
├── lib/                                 ⟵ [CAPA DATOS / ACCESO] API pública del frontend
│   ├── public-data.ts                   ★ Data access layer — search, filter, sanitize. Hoy lee MOCKS, mañana fetchea API REST
│   ├── site-assets.ts                   Registry de rutas de assets estáticos (logos, íconos, hero)
│   └── utils.ts                         cn() = clsx + tailwind-merge
│
├── models/                              ⟵ [CAPA DOMINIO] TypeScript interfaces
│   ├── tramite.model.ts                 ★ Dominio completo: Tramite, Organismo, Modalidad, Etiqueta, Categoria,
│   │                                     Destinatario, Localidad, TramiteContenidoLocalidad, EventoDeVida,
│   │                                     TramiteEstado, PaginatedResponse
│   ├── auth.model.ts                    (arrastre desde backoffice, no usado en portal público)
│   ├── dashboard.model.ts               (arrastre desde backoffice)
│   ├── usuario.model.ts                 (arrastre)
│   └── field.interface.ts               (arrastre dynamic-form)
│
├── mocks/                               ⟵ [CAPA DATOS — temporal] Dataset en memoria
│   ├── mock-data.ts                     ★ Fuente de verdad: 10 trámites + organismos + localidades + categorías,
│   │                                     etiquetas, destinatarios, contenido-por-localidad
│   ├── mock-api.interceptor.ts          Interceptor Angular (excluido del build Next — heredado de backoffice)
│   └── mock-auth-init.ts                (no usado en portal)
│
├── enums/
│   └── user-role.enum.ts                (arrastre — no se usa en portal)
│
├── public/                              ⟵ [ASSETS] servidos estáticamente por Next
│   ├── assets/
│   │   ├── brands/                      Logos: Misiones, Ciudadano, Silicon Misiones (png + svg)
│   │   ├── hero/                        cataratas-hero.png
│   │   └── ui/                          20+ íconos svg (redes, temas, decorativos "M transparente")
│   └── fonts/
│       └── oak-sans/                    14 weights Oak Sans (Light→Black + italics)
│
├── next.config.ts                       typedRoutes: true
├── tsconfig.json                        paths "@/*" → ./ ; excluye mocks no-Next
├── postcss.config.mjs                   Tailwind v4 via @tailwindcss/postcss
├── package.json                         Next 15.2.4, React 19, Tailwind 4, lucide-react, clsx, cva
├── CLAUDE.md                            Instrucciones para Claude Code
└── README.md
```

---

## 2. Diagrama del sistema (C4 Nivel 1 — Context)

```
                     ┌─────────────────────────────────────┐
                     │           CIUDADANO                 │
                     │  (navegador web — desktop / móvil)  │
                     └──────────────┬──────────────────────┘
                                    │  HTTPS / HTML streaming
                                    ▼
        ┌───────────────────────────────────────────────────────────────┐
        │       PORTAL PÚBLICO  (public/ — Next.js 15 App Router)       │
        │  ─────────────────────────────────────────────────────────── │
        │  • Server Components renderizan /, /tramites, /tramites/:slug │
        │  • Client Components mínimos: SearchFilters, PortalShellFixed │
        │  • Data access: lib/public-data.ts (hoy lee mocks sync)       │
        │  • SSR + Static optimization + typedRoutes                    │
        └──────────────┬────────────────────────────────────┬───────────┘
                       │                                    │
                       │ (roadmap)                          │ (actual)
                       │ fetch(API REST)                    │ import MOCKS
                       ▼                                    ▼
        ┌─────────────────────────────────┐   ┌──────────────────────────┐
        │   BACKEND REST API              │   │  mocks/mock-data.ts      │
        │  (a construir — Spring/Node)    │   │  (dataset en memoria)    │
        │  endpoints: /tramites, /orga-   │   │  10 trámites + taxonomías│
        │  nismos, /categorias, /search   │   └──────────────────────────┘
        └──────────────┬──────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────┐        ┌──────────────────────┐
        │       PostgreSQL                │◄──────►│  Meilisearch (roadmap)│
        │  Trámites + taxonomías +        │        │  Búsqueda semántica / │
        │  contenido por localidad        │        │  tipo-tolerante       │
        └─────────────────────────────────┘        └──────────────────────┘

                       ▲
                       │
        ┌──────────────┴──────────────────┐
        │  BACKOFFICE  (backoffice/ Angular 17)  │
        │  — carga trámites, los mueve por:      │
        │    borrador → revisión → publicado     │
        │  — sólo 'publicado' aparece en Portal  │
        └────────────────────────────────────────┘
```

**Actores**:
- **Ciudadano**: consume el portal sin autenticación.
- **Editor / Admin de organismo / Superadmin**: operan el backoffice; el portal sólo es consumidor de la data publicada.

**Flujo de datos actual**: todas las páginas son server components que invocan funciones síncronas de `lib/public-data.ts`, las cuales filtran `MOCK_TRAMITES` en memoria.
**Flujo de datos objetivo**: las mismas funciones pasarán a ser `async` y harán `fetch()` a la API REST (con `cache`/`revalidate` de Next).

---

## 3. Componentes principales

### 3.1 Routing & pages (`app/`)

| Ruta | Archivo | Propósito |
|---|---|---|
| `/` | `app/page.tsx` | Landing: hero con `SearchFilters` en modo hero, "Lo más buscado" (5 destacados), 3 tabs de destinatarios, grilla de 6 tarjetas de temas. |
| `/tramites` | `app/tramites/page.tsx` | Catálogo con filtros server-side (`search`, `organismoId`, `modalidadId`, `destinatarioId`, `localidadId`, `etiquetaId`). Renderiza `TramiteCard[]`. |
| `/tramites/[slug]` | `app/tramites/[slug]/page.tsx` | Ficha detalle: breadcrumb, resumen, 3 info-cards (organismo / modalidad / destinatarios), selector de localidad, acordeón (requisitos, costos, formularios, contacto, web), CTA "Iniciar trámite". Usa `notFound()` si el slug no existe. |
| `/tramites/categoria/[slug]` | `app/tramites/categoria/[slug]/page.tsx` | Vista de categoría raíz: subcategorías como cards + listado filtrable de trámites de la subcategoría seleccionada. |
| `loading.tsx` (×3) | — | Suspense boundaries que muestran `<MLoader />` durante la navegación SSR. |

Patrón común: `searchParams` y `params` son `Promise<>` (Next 15), se resuelven con `await` al tope de la función.

### 3.2 Data access layer (`lib/public-data.ts`)

Única superficie contra la cual las pages leen datos. Funciones clave:

| Función | Retorna | Uso |
|---|---|---|
| `getPublishedTramites()` | `Tramite[]` | Filtra `estado === 'publicado'` + `sanitizeTramite` para arreglar mojibake UTF-8 |
| `searchPublicTramites(params)` | `Tramite[]` | Normaliza acentos (NFD) + filtra por organismo, modalidad, destinatario, localidad, etiqueta, texto |
| `getFeaturedTramites(limit)` | `Tramite[]` | Trámites con `destacado=true` |
| `getTramiteBySlug(slug)` | `Tramite \| undefined` | Detalle |
| `getCategorias()` / `getCategoriaBySlug()` / `getSubcategorias()` / `getTramitesByCategoriaId()` | taxonomía + ruteo por categoría |
| `getContenidoLocalidad(tramiteId, localidadId)` | `TramiteContenidoLocalidad` | Override por localidad (costos, contacto, sitio web) |
| `getOrganismos()` / `getModalidades()` / `getEtiquetas()` / `getDestinatarios()` / `getLocalidades()` / `getEventosDeVida()` | taxonomías de catálogo |
| `sanitizeText()` | `string \| null` | Corrige double-encoding (`Ã³` → `o`, etc.) |

Todas **síncronas** hoy. El contrato es estable: cambiar la implementación a `async fetch()` no requiere tocar las páginas (excepto agregar `await`).

### 3.3 Shell y navegación (`components/portal-shell-fixed.tsx`)

Client component (`"use client"`) — envuelve cada página con:
- **Hero band opcional**: cuando `hero={true}` (sólo home) la imagen de cataratas queda libre para que `/` ponga su propio hero encima; cuando `hero={false}` el shell pinta un spacer de 480–520 px con la imagen de cataratas como fondo decorativo + overlay azul.
- **Navbar pill azul** (#2f6eb1) con logo Misiones + links estáticos + hamburguesa mobile.
- **Footer** con redes sociales, dirección, logos Ciudadano/Silicon Misiones, copyright.
- **Botón flotante de accesibilidad** fixed bottom-right.

`portal-shell.tsx` existe como variante legacy — todas las páginas importan `PortalShellFixed as PortalShell`.

### 3.4 Filtros y búsqueda (`components/search-filters.tsx`)

Client component con dos modos:

- **Modo hero** (`hero`): input grande centrado sobre cataratas con quick-actions ("Licencia de conducir", "Partida de nacimiento", "Antecedentes"). Submit vía `router.push()` hacia `/tramites?search=…`.
- **Modo catálogo** (default): barra horizontal con `h2 "Categorías"` + botón "Etiquetas" colapsable + pills de modalidad + grid `search + destinatarios + organismos + localidades + Limpiar`.

Detalles clave:
- Construye URLs con `buildUrl(overrides)` que preserva filtros actuales y soporta un `basePath` + `preserveParams` (usado por `/tramites/categoria/:slug` para mantener `sub=…`).
- `scroll: false` en casi todos los `router.push()` y `<Link>` → evita saltar al top cuando cambia un filtro (ancla implícita en `#detalle`).
- Los catálogos (`organismos`, `modalidades`, `destinatarios`, `localidades`, `etiquetas`) se resuelven a nivel de módulo (ejecución síncrona sobre mocks). Cuando migre a API, estos tendrán que moverse a props server-side.

### 3.5 Cards (`components/*-card.tsx`)

- **`TramiteCard`**: 328×154, ícono en círculo + título (2 líneas) + organismo (1 línea) + "Más información". Link a `/tramites/:slug#detalle`. Mapa de íconos Material-style → lucide-react (`directions_car` → `Car`, etc.).
- **`SubcategoriaCard`**: misma dimensión, añade badge de modalidad dominante + chips de top-3 etiquetas. Estado `selected` con borde azul cuando coincide con el `?sub=` actual.
- **`FeaturedShortcutCard`**: 240×260 (home "Lo más buscado"), ícono por posición (rota sobre `iconMap[index % 5]`), link `?search=<titulo>`.
- **`HomeTopicCard`**: tema en home, acepta `href` opcional — si se pasa va a `/tramites/categoria/:slug#detalle`, si no, a `/tramites?search=<search>#detalle`.

### 3.6 MLoader (`components/m-loader.tsx`)

Loader de marca: círculo azul con "M" corporativa SVG + anillo cónico rotando (1.6s lineal) + glow exterior pulsante (2.4s) + dots animados. Usado por todos los `loading.tsx` con `fullscreen=true`. Keyframes viven en `globals.css`.

### 3.7 Primitivos UI (`components/ui/`)

Estilo shadcn pero sin runtime de shadcn — componentes mínimos tipados:
- `Button` con `class-variance-authority` (variantes `default`, `outline`, `ghost` + sizes `sm`, `default`, `lg`).
- `Card` / `CardContent` — wrapper de estilo.
- `Input`, `NativeSelect`, `Badge`.
- Compone con `cn()` (clsx + tailwind-merge).

### 3.8 Modelo de dominio (`models/tramite.model.ts`)

Entidades:

```
Tramite ──1..N── Etiqueta
  │     ──0..N── Destinatario
  │     ──0..N── Localidad
  │     ──0..N── EventoDeVida
  │     ──0..N── Categoria
  │     ──1──── Organismo (FK organismoId)
  │     ──1──── Modalidad (FK modalidadId)
  │     ──0..N── TramiteContenidoLocalidad  (override por localidad:
  │                                           costos, contacto, sitioWeb, horarios)
  │
  └── estado: 'borrador' | 'revision' | 'publicado' | 'despublicado'
              (sólo 'publicado' se ve en el portal público)
```

La duplicación con `backoffice/src/app/core/models/` está planeada para resolverse migrando a `shared/types/`.

---

## 4. Integraciones externas

### 4.1 Estado actual

**No hay integraciones externas activas.** El portal es 100 % autocontenido:

- **Datos**: `mocks/mock-data.ts` importado directamente.
- **Fuentes**: Oak Sans servida localmente desde `public/fonts/oak-sans/` (14 pesos); Montserrat servida vía `next/font/google` (subset latin, weights 400/500/700).
- **Íconos**: `lucide-react` (bundle cliente) + SVGs propios en `public/assets/ui/`.
- **Imágenes**: `next/image` con assets locales — no se usa CDN externa ni `remotePatterns`.

### 4.2 Integraciones en el roadmap

| Servicio | Rol previsto | Disparador |
|---|---|---|
| **API REST backend** | Reemplazar mocks — endpoints `/tramites`, `/tramites/:slug`, `/categorias`, `/organismos`, `/modalidades`, `/etiquetas`, `/destinatarios`, `/localidades`, `/tramites/:id/contenido-localidad/:localidadId`. | Bloquea todo lo demás; `lib/public-data.ts` debe pasar a async. |
| **Meilisearch** | Búsqueda semántica con tolerancia a typos, sinónimos, stemming español, ponderación por título/etiqueta. Reemplaza el `normalize().includes()` actual en `searchPublicTramites`. | Cuando el catálogo crezca más allá de ~50 trámites y el texto flat deje de escalar. |
| **OAuth / SSO "Mi Portal"** | Navbar ya tiene link "Mi Portal" — supondrá login ciudadano (posiblemente ciudadano-misiones SSO o Miid). | Cuando se decida qué datos personales expone el portal (turnos, expedientes, pagos). |
| **Analytics** | Métrica de trámites más buscados, filtros más usados, tiempos al CTA. Matomo / Plausible self-hosted preferible por datos de ciudadanos. | A definir con la Subsecretaría. |
| **Boletín / notificaciones** | Suscribirse a actualizaciones de un trámite (email/WhatsApp). | Backlog posterior. |

### 4.3 Contratos asumidos para la API REST futura

La firma de `lib/public-data.ts` es el **contrato vivo** contra el cual se diseñará el backend:

```
GET /tramites?estado=publicado&search&organismoId&modalidadId
             &destinatarioId&localidadId&etiquetaId&page&pageSize
GET /tramites/{slug}
GET /tramites/{id}/contenido-localidad/{localidadId}
GET /categorias?parentId={id|null}&activo=true
GET /organismos | /modalidades | /etiquetas | /destinatarios | /localidades | /eventos-vida
```

Respuesta esperada: los DTOs ya tipados en `models/tramite.model.ts` (con `PaginatedResponse<T>` para listados).

---

## 5. Consideraciones futuras

### 5.1 Deuda técnica conocida

1. **Delays artificiales de 1.5 s en `page.tsx`** (`/tramites`, `/tramites/[slug]`, `/tramites/categoria/[slug]`) — están marcados `TODO: remove — test-only delay to preview MLoader`. Deben eliminarse antes de prod, no sólo por UX sino porque bloquean el TTFB.
2. **Modelos duplicados**: `models/tramite.model.ts` es una copia de `backoffice/src/app/core/models/`. El CLAUDE.md del root apunta a `shared/types/` como destino canónico — la consolidación está pendiente. : RESUELTO
3. **`mocks/mock-data.ts` compartido vía `import`** entre dos stacks (Angular + Next). Funciona sólo porque `tsconfig` del portal `excluye` los archivos Angular-only (`mock-api.interceptor.ts`, `mock-auth-init.ts`). Frágil. : RESUELTO
4. **Catálogos resueltos a nivel de módulo** en `search-filters.tsx` (líneas 30-34). Cuando migre a API, esos `getOrganismos()` etc. deben pasar como props server-side (el componente es client).
5. **`portal-shell.tsx` legacy** — ya nadie lo importa pero sigue en el árbol (124 líneas). Borrar. : RESUELTO
6. **`enums/user-role.enum.ts`, `models/auth.model.ts`, `models/dashboard.model.ts`, `models/usuario.model.ts`, `models/field.interface.ts`, `mocks/mock-auth-init.ts`, `mocks/mock-api.interceptor.ts`** — arrastres del backoffice sin uso en el portal. Eliminables. : RESUELTO
7. **`components/search-form.tsx`** coexiste con `components/search-filters.tsx` resolviendo la misma necesidad con enfoques distintos (server-form vs client-router). Uno debe ganar.
8. **Texto mojibake en `mock-data.ts`** — existe `sanitizeText` en `public-data.ts` que parchea `Ã³` → `o`. Cuando la data venga de la API limpia, ese sanitizer debería removerse.
9. **`<select>` nativo dentro del hero del detalle** (línea 152, `[slug]/page.tsx`) no cambia nada al elegir localidad — renderiza el contenido de la primera localidad siempre. El switch de localidad no está conectado.
10. **`getIcon(icono)` duplicado** en `tramite-card.tsx` y `tramites/categoria/[slug]/page.tsx` con mapas muy similares. Extraer a `lib/`.
11. **Rutas hardcoded** en `PortalShellFixed.navLinks` ("Organismos" → `/tramites`, "Mi Portal" → `/tramites`) — placeholders hasta que existan las pages reales.

### 5.2 Funcionalidades en el roadmap

1. **Integración real con API** (bloqueante de todo lo demás).
2. **Página de organismo**: `/organismos/:slug` listando todos los trámites del organismo.
3. **Página de evento de vida**: `/eventos/:slug` (el modelo `EventoDeVida` ya existe).
4. **Selector de localidad funcional** en ficha detalle: al cambiar localidad, refrescar las secciones del acordeón con `TramiteContenidoLocalidad` del nuevo `localidadId`.
5. **"Mi Portal"**: área autenticada con trámites guardados, historial, notificaciones. : posponer
6. **Búsqueda semántica (Meilisearch)** con autocompletado en el hero. : posponer
7. **Accesibilidad completa WCAG 2.2 AA**: el botón flotante ya existe como placeholder — falta panel con tamaño de texto, alto contraste, lectura, etc. : posponer
8. **i18n** (es-AR / pt-BR) — Misiones es provincia frontera; tráfico brasileño esperable. : posponer
9. **PWA** para operar offline sobre trámites ya visitados. : posponer
10. **Sitemap dinámico + robots.txt + metadata OG por trámite** — hoy sólo hay `metadata` global en `layout.tsx`.
11. **Analítica de búsquedas fallidas** (endpoint del backoffice existe — `TopBusqueda` está en `dashboard.model.ts`).

---

## 6. Improves (mejoras propuestas)

### 6.1 Estructura

- **Aplanar `public/public/`**: tener `public/public/assets/` es confuso; convencional de Next sí, pero se podría documentar mejor en el CLAUDE.md de la página.
- **Segregar `lib/` por responsabilidad**:
  ```
  lib/
  ├── data/
  │   ├── tramites.ts
  │   ├── categorias.ts
  │   └── taxonomias.ts      (organismos, modalidades, etiquetas, destinatarios, localidades)
  ├── format/
  │   ├── sanitize.ts        (sanitizeText + sanitizeTramite)
  │   └── normalize.ts       (NFD + acento-insensitive)
  ├── ui/
  │   └── icon-map.ts        (Material→lucide — deduplica tramite-card y categoria/[slug])
  └── utils.ts               (cn)
  ```
- **Mover `components/ui/`** al patrón shadcn completo (agregar `components.json`) → habilita `npx shadcn add` para futuras piezas sin inventar APIs.
- **Crear `components/portal/`** para agrupar lo propio del dominio (PortalShell, SearchFilters, Cards) y distinguirlo de `components/ui/` (primitivos).

### 6.2 Arquitectura

- **Hacer `lib/public-data.ts` async desde hoy**, aunque la implementación siga siendo síncrona sobre mocks. Así cuando llegue la API, el cambio es 1 línea por función y no requiere tocar las pages.
- **Introducir un adapter pattern**:
  ```ts
  // lib/data/tramite-repository.ts
  export interface TramiteRepository {
    findPublished(filters: PublicSearchParams): Promise<PaginatedResponse<Tramite>>
    findBySlug(slug: string): Promise<Tramite | null>
  }
  // implementaciones: MockTramiteRepository, HttpTramiteRepository, MeiliTramiteRepository
  ```
  Las páginas consumen la interfaz, no la implementación. Facilita tests y feature-flag del backend.
- **Server Actions o Route Handlers** (Next 15) para formularios (futuro "Mi Portal", suscripciones): hoy `SearchFilters` empuja `router.push()`, lo cual está bien, pero para POST conviene dejar el patrón trazado.
- **Mover los catálogos a server components**: `SearchFilters` es client (por los `useState`, `router.push`), pero los arrays `organismos`, `modalidades`, `etiquetas`, `destinatarios`, `localidades` deben bajar como props desde el server para cuando se conecten a API y poder cachearse con `unstable_cache` o `fetch({ next: { revalidate } })`.
- **Caché con revalidate**: al migrar a fetch, usar `revalidate: 300` por defecto para listados y `revalidate: 60` para detalle. Los catálogos (organismos, etc.) pueden ser `revalidate: 3600`.
- **Streaming + Suspense granular**: hoy el `loading.tsx` bloquea toda la página. Envolver secciones pesadas (`<FeaturedShortcutCard>`, grilla de temas) en `<Suspense>` propias para streamear el hero primero.

### 6.3 Componentes

- **`PortalShellFixed` → SSR-first**: casi todo el shell es markup estático; el `useState(menuOpen)` del hamburger se puede extraer a un `<MobileMenu client />` sub-componente de 30 líneas, dejando el shell como server component y reduciendo el bundle inicial.
- **`SearchFilters` en 2 archivos**: un `SearchFiltersServer` (que recibe catálogos como props) + un `SearchFiltersInteractive` (los handlers de submit/change). Hoy el componente hace ambas cosas.
- **Abstraer `buildUrl`**: vive inline en `search-filters.tsx`. Llevarlo a `lib/url/tramite-filters.ts` + testear con vitest.
- **Deduplicar `getIcon` y `lucideIconMap`** entre `tramite-card.tsx` y `categoria/[slug]/page.tsx`.
- **`MLoader` props**: agregar `size` (`sm` | `md` | `lg`) para reusarlo en casos in-page (no-fullscreen) además del Suspense global.
- **`TramiteCard` + `SubcategoriaCard`**: comparten layout (328×154, ícono + título + metadata). Extraer un `<BaseCard>` compartido con slots.

### 6.4 Rendimiento

- **Quitar los `setTimeout(1500)`** de las 3 pages (ver deuda técnica #1).
- **`priority` en más imágenes de lo necesario**: `cataratas-hero.png` está bien; revisar que logos en footer no lleven `priority`.
- **Purgar dependencias arrastre**: `lucide-react: ^1.8.0` está pinned a una versión antigua (la actual es ≥0.400 con tree-shaking moderno) — investigar si el `^1.8.0` es un typo.
- **`sizes` en `<Image fill>`** ya está, pero revisar los 100vw de hero en móvil (el ancho real es menor).
- **Bundle analysis**: `next build --analyze` para medir el peso real de `lucide-react` + `class-variance-authority` + `tailwind-merge` en el client bundle.

### 6.5 DX / Tooling

- **ESLint + Prettier + husky + lint-staged**: `npm run lint` existe pero no hay `prettier.config` ni pre-commit. Agregar.
- **`typedRoutes` ya activado** — aprovecharlo: hoy hay varios `as never` casts (`href={... as never}`) que son señal de que `typedRoutes` está estrecho. Convertir las rutas dinámicas con generadores tipados.
- **Tests**: no existen. Mínimo: Vitest + Testing Library para componentes puros (`TramiteCard`, `SubcategoriaCard`, `MLoader`) y para `lib/public-data.ts` (filtros, normalize, sanitize).
- **Playwright e2e** sobre los flujos golden: home → buscar → filtrar → detalle → iniciar trámite.
- **Storybook** (opcional) para las cards y el `MLoader` — el diseño del portal tiene muchos componentes visuales con estados (selected/hover/badge/chips).

### 6.6 Accesibilidad

- Revisar contraste de `text-[rgba(26,26,46,0.5)]` en placeholders (probable < 4.5:1).
- `<select>` nativos sin label visible en `SearchFilters` — agregar `aria-label` explícitos.
- `<details>/<summary>` del acordeón en detalle está bien por defecto, pero verificar anuncio por screen readers del estado open/closed con `aria-expanded`.
- El ícono de accesibilidad flotante es un placeholder: debería abrir un panel real (tamaño texto, contraste, animaciones off).

### 6.7 SEO

- `metadata` en `layout.tsx` es global — agregar `generateMetadata` por ruta (especialmente `[slug]` con título, descripción, OG image del organismo).
- `sitemap.ts` en `app/` listando todos los trámites publicados + categorías.
- `robots.ts` permitiendo todo.
- JSON-LD `GovernmentService` schema.org en la ficha de trámite.

---

## Apéndice — stack versionado

| Paquete | Versión | Nota |
|---|---|---|
| `next` | 15.2.4 | App Router, `experimental.typedRoutes` |
| `react` / `react-dom` | 19.0.0 | Server Components, async params |
| `tailwindcss` | ^4.2.2 | Tailwind v4 (config-less, `@theme inline`) |
| `@tailwindcss/postcss` | ^4.2.2 | Integración PostCSS |
| `tw-animate-css` | ^1.4.0 | Animaciones Tailwind |
| `lucide-react` | ^1.8.0 | Íconos — revisar pin |
| `class-variance-authority` | ^0.7.1 | Variantes de componentes (Button) |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.5.0 | Helper `cn()` |
| `typescript` | 5.8.2 | strict=true |
| Node | 20.11.0 | Recomendado por CLAUDE.md |
