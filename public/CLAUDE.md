# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Portal publico ciudadano (Next.js 15 / React 19 / App Router) for the Portal Provincial de Tramites - Misiones. Read-only public-facing catalog of provincial government procedures (tramites). Part of a monorepo where `backoffice/` is the Angular admin panel and `public/` (this directory) is the citizen portal.

## Commands

```bash
npm run dev     # Next.js dev server
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint
```

Node version: 20.11.0

## Architecture

Next.js 15 App Router with `experimental.typedRoutes` enabled. No client components yet — all pages are server components using synchronous mock data (no API calls).

### Routes

- `/` — Homepage: featured tramites, life events, stats, search
- `/tramites` — Catalog with server-side search/filter via query params (`search`, `organismoId`, `modalidadId`, `etiquetaId`)
- `/tramites/[slug]` — Detail page, uses `notFound()` for missing slugs

### Key Directories

- `lib/public-data.ts` — All data access: search, filtering, sanitization. Currently reads from mock data, will switch to API calls.
- `mocks/mock-data.ts` — Static dataset (shared with backoffice mock layer). Excluded from tsconfig compilation except `mock-data.ts`.
- `models/` — TypeScript interfaces (`Tramite`, `Organismo`, `Modalidad`, `Etiqueta`, `PaginatedResponse`). Duplicated from backoffice models — canonical shared types live in `../shared/types/`.
- `components/` — Reusable UI: `SearchForm` (handles both hero and sidebar filter modes via `compact` prop), `TramiteCard`.
- `enums/` — `UserRole` enum (not used in portal yet, carried over from backoffice).

### Data Flow

All data functions in `lib/public-data.ts` are synchronous, filtering `MOCK_TRAMITES` in-memory. Only tramites with `estado === 'publicado'` are shown. Text search uses NFD-normalized accent-insensitive matching. A `sanitizeText` function fixes mojibake (UTF-8 double-encoding artifacts like `Ã³` → `o`).

### Path Aliases

`@/*` maps to the project root (e.g., `@/lib/public-data`, `@/models/tramite.model`).

## Conventions

- Spanish for all UI text and model field names
- Locale: es-AR, dates formatted with `toLocaleDateString('es-AR')`
- No CSS framework — plain CSS with CSS custom properties in `globals.css`
- Design tokens: `--brand: #0d6b45` (green), `--accent: #e6a33b` (gold), `--clay: #b96f52`
- Font stack: Avenir Next / Trebuchet MS (sans), Iowan Old Style / Palatino (display)
- `SearchForm` uses native `<form action="/tramites">` for zero-JS filtering via query params

## Tramite Workflow States

`borrador → revision → publicado ↔ despublicado` — only `publicado` is visible in this portal.