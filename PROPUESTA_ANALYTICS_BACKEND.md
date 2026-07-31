# Propuesta — Endpoints de analítica para el Home del backoffice

> **Para:** el equipo de backend. **Contexto:** el permiso `VIEW_ANALYTICS` ya existe en el catálogo (§4.2)
> pero **no hay ningún endpoint detrás**. El Home del backoffice hoy no puede mostrar nada operativo con dato
> real (todo lo de trámites/logs/feedback/audit está sin controller). Esta es la lista de endpoints que
> harían el Home genuinamente útil, ordenados por prioridad e impacto.

---

## Prerequisito (bloqueante): Trámites y Variantes

Casi todo depende de exponer el CRUD de **Procedure/ProcedureVariant** con `status` (workflow
`BORRADOR/PUBLICADO/...`) y timestamps (`createdAt/updatedAt`). Sin eso no hay pipeline, ni "por organismo",
ni cola de revisión, ni "más consultados". Es el primer desbloqueo.

---

## Endpoints propuestos

### 1. `GET /api/analytics/summary` — KPIs pre-agregados  ·  `hasAuthority('VIEW_ANALYTICS')`
Evita que el front sume a mano. Scope-aware: para roles locales (ADMIN_ORGANIZATION/AGENT) filtra por su organismo.
```json
{
  "procedures": { "total": 214, "published": 180, "draft": 22, "review": 8, "unpublished": 4 },
  "reviewQueue": 8,                     // trámites en revisión (accionable)
  "staleOver90d": 12,                   // publicados sin update hace >90 días
  "byOrganism": [ { "organismId": "..", "acronym": "DGR", "total": 41 } ],
  "feedbackPending": 5,
  "satisfactionAvg": 4.3
}
```

### 2. `GET /api/analytics/search-gaps?days=7&limit=10` — búsquedas sin resultados  ·  `VIEW_ANALYTICS`
**La métrica de mayor valor.** Desde `SearchLog`. Dice qué buscan los ciudadanos y NO encuentran.
```json
{ "range": "7d", "items": [ { "term": "licencia de conducir", "count": 42, "results": 0 } ] }
```

### 3. `GET /api/analytics/top-procedures?days=30&limit=10` — más consultados  ·  `VIEW_ANALYTICS`
Desde `ProcedureVisitLog`. Señal de demanda.
```json
{ "range": "30d", "items": [ { "procedureId": "..", "title": "Inscribirse en IPS", "visits": 1280 } ] }
```

### 4. `GET /api/feedback` (+ `?status=pending`) — feedback ciudadano  ·  `VIEW_ANALYTICS` / scope
Cola de feedback a responder + promedio de satisfacción. Hoy el módulo Feedback del front corre en mock.

### 5. `GET /api/audit?limit=N` — actividad reciente  ·  rol admin
Últimas acciones (quién, qué acción, sobre qué entidad, cuándo). Alimenta "Actividad reciente" y la pantalla
Auditoría (hoy mock). Idealmente paginado y filtrable por entidad/usuario.

---

## Notas de diseño para que rinda en el front
- **Pre-agregar del lado backend** (sumar/agrupar en SQL), no devolver crudo para que el front cuente.
- **Rango temporal** por query param (`days`) en los que aplique; devolver el rango usado en la respuesta.
- **Scope por organismo**: para ADMIN_ORGANIZATION/AGENT, filtrar automáticamente por su organismo (como ya se
  hace en otros endpoints), así el mismo endpoint sirve el Home por rol sin lógica extra en el front.
- **Envelope** consistente con el resto (`ResponseDTO<...>`) y códigos de error habituales.
- Gatear todo por **`hasAuthority('VIEW_ANALYTICS')`** (ya existe el permiso; MANAGER/ADMIN_* lo tienen en el seed).

## Prioridad sugerida
1. **Trámites/Variantes** (desbloquea todo) → 2. `analytics/summary` → 3. `search-gaps` (oro) →
4. `top-procedures` → 5. `feedback` → 6. `audit`.

Con (1)+(2)+(3) el Home ya pasa de "maqueta" a herramienta real.
