# Rediseño del Home (Dashboard) — definición de KPIs y widgets

> Complementa `BRIEF_DESIGN_SYSTEM.md`. Este documento define **qué datos muestra el Home y por qué**
> (producto), no solo cómo se ve. Léelo junto al brief de design system.

## Decisiones tomadas
- **Home de configuración real + placeholders honestos** (no números inventados).
- **Role-aware desde el arranque**: base compartida + slots por rol.
- **Propuesta de endpoints de analítica** para el backend → `PROPUESTA_ANALYTICS_BACKEND.md`.

---

## 1. Principio rector: KPIs *representativos*, no *vanity*

Un KPI sirve solo si **dispara una decisión o acción**. Reemplazos que aplicamos:

| ❌ Vanity (número suelto) | ✅ Representativo (accionable) |
|---|---|
| "Total trámites: 214" | **Cola de revisión**: "8 trámites esperando revisión" (bandeja de trabajo) |
| "Organismos: 34" | (baja a una tira de *configuración*, no es un hero) |
| "Búsquedas hoy: 128" | **Búsquedas sin resultados (7d)**: qué buscan y NO encuentran los ciudadanos → qué crear |
| "Satisfacción: 4.3/5" | **Feedback pendiente de responder: 5** (cola de calidad) |
| Donut "distribución por estado" decorativo | Estado como **pipeline** con foco en lo que requiere acción |

**La métrica de oro de un portal de trámites** es *búsquedas sin resultados*: dice exactamente qué contenido
falta. Vale más que todos los charts juntos. Priorizarla cuando exista el dato.

---

## 2. Realidad del dato (qué se puede hoy)

| Fuente | Estado backend | Sirve para |
|---|---|---|
| `/api/organism`, `/api/organism-type` | ✅ real (solo SUPERADMIN) | contar organismos/tipos |
| `/api/category`, `/api/modality`, `/api/life-event`, `/api/recipient` | ✅ real (GET público) | contar taxonomía |
| `/api/role`, `/api/permission` | ✅ real (SUPERADMIN/ADMIN_BACKOFFICE) | contar roles/permisos |
| **Trámites / Variantes** | ❌ sin controller | pipeline, por organismo, más consultados |
| **SearchLog / VisitLog** | ❌ sin endpoints | búsquedas sin resultados / más consultados |
| **Feedback** | ❌ mock | satisfacción, cola de feedback |
| **Audit** | ❌ mock | actividad reciente |
| **Usuarios (GET lista)** | ❌ solo POST | contar usuarios activos |

→ **Hoy** el Home solo puede mostrar con verdad los **catálogos de configuración**. Todo lo operativo/analítico
va como **placeholder** hasta que existan los endpoints (§ propuesta backend).

---

## 3. Arquitectura del Home

- **Feature `dashboard`** en capas (Componente→Facade→Repository→DataSource), hoy `mock`, mañana `local`.
  El componente consume solo el facade; los widgets no saben si el dato es real o placeholder.
- **Base compartida (todos los roles):**
  1. **Saludo + contexto** (page-header): "Hola, {nombre}" + rol + fecha.
  2. **Tira de configuración**: cards de conteo de catálogos — **cada card gateada por permiso** (la de
     Organismos solo la ve quien tenga `READ_ORGANISM`, etc.). Card sin permiso → no se renderiza.
  3. **Accesos rápidos**: botones a "Nueva categoría / organismo / modalidad…" gateados por `CREATE_*`.
- **Slots por rol**: debajo de la base, cada rol tiene su bloque (hoy real o placeholder — §4).
- **Placeholder honesto** (componente reusable): ícono tenue + "Se activa cuando el módulo *X* esté disponible"
  + (opcional) link a la propuesta. Nunca un número falso.
- Reglas del proyecto: standalone + OnPush, **RxJS sin signals** (`async` pipe / `firstValueFrom`), vistas
  separadas, tokens `--theme-*`, BEM anidado. Charts: `ng2-charts`/`chart.js` (ya es dependencia) — solo cuando
  haya dato real; colores accesibles derivados de la marca (ver `dataviz`/design system).

---

## 4. Matriz por rol (widget → HOY real / Horizonte B)

| Rol | Foco | HOY (dato real) | Horizonte B (placeholder hoy) |
|---|---|---|---|
| **SUPERADMIN** | Dueño del sistema | Config completa (todos los catálogos + roles/permisos) · accesos rápidos · salud del sistema (conteos) | Pipeline de trámites · búsquedas sin resultados · más consultados · feedback · actividad · usuarios activos |
| **ADMIN_BACKOFFICE** | Contenido y taxonomía global | Config de taxonomía (categorías/modalidades/eventos/destinatarios) · roles/permisos · accesos rápidos | **Cola de revisión** · búsquedas sin resultados · más consultados · contenido desactualizado |
| **ADMIN_ORGANIZATION** | Su organismo (variantes/contactos) | (casi nada real: variantes/contactos sin API) | Sus variantes por estado · sus contactos · actividad de su organismo |
| **AGENT** | Carga de variantes | (nada real) | Sus variantes pendientes de completar · contactos |
| **MANAGER** | Visualizador de estadísticas | (nada real) | **Dashboard analítico read-only** completo (demanda, gaps de búsqueda, satisfacción, tendencias) |

> Consecuencia asumida: hoy ADMIN_ORGANIZATION / AGENT / MANAGER ven **base compartida + placeholders**. El
> componente ya queda role-aware; se llenan solos cuando lleguen los endpoints. Es intencional.

---

## 5. Catálogo de widgets

| Widget | Fuente | Horizonte | Gate |
|---|---|---|---|
| Tira de configuración (conteos) | GET de cada catálogo (length) | **A (hoy)** | por permiso `READ_*` / público por card |
| Accesos rápidos | rutas | **A (hoy)** | por permiso `CREATE_*` |
| Cola de revisión (bandeja) | Trámites (estado + fecha) | B | `READ_PROCEDURE` |
| Búsquedas sin resultados | SearchLog | B | `VIEW_ANALYTICS` |
| Trámites más consultados | VisitLog | B | `VIEW_ANALYTICS` |
| Pipeline por estado (donut/bar) | Trámites | B | `READ_PROCEDURE` |
| Trámites por organismo | Trámites | B | `READ_PROCEDURE` |
| Feedback pendiente | Feedback | B | `VIEW_ANALYTICS` / scope |
| Actividad reciente | Audit | B | rol |
| Mis variantes / contactos | Variant/Contact | B | `READ_VARIANT` / `READ_CONTACT` |

---

## 6. UX / layout (alineado al design system)

- Densidad **cómoda**, mucho blanco, azul como acento. La tira de config = cards compactas con número tabular
  grande + label overline + ícono tenue; **no** 8 KPIs gigantes coloridos (eso era el mock).
- Jerarquía: saludo → (lo accionable primero: cola/gaps cuando exista) → config → accesos rápidos.
- Placeholders con el mismo lenguaje que los empty-states del sistema (no cajas grises tristes: ícono + copy claro).
- Todo responsive (grid que colapsa), accesible (contraste, foco, teclado), es-AR.

---

## 7. Definition of Done (Home)
- [ ] Cero números inventados: cada dato mostrado tiene fuente real, o es placeholder explícito.
- [ ] Cards/slots gateados por permiso (nada visible que dé 403).
- [ ] Role-aware: cada rol ve su composición.
- [ ] Feature `dashboard` en capas, sin signals, OnPush, vistas separadas, tokens.
- [ ] `tsc` / `lint` / `check:circular` / `build` verdes.
