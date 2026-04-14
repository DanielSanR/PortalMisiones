# TODO — Nuevo Esquema (Alineacion con Figma)

Cambios necesarios para alinear el modelo de datos, backoffice y backend con el diseño real del portal (Figma).

---

## 1. Categorias Jerarquicas (entidad nueva, convive con Etiquetas)

El Figma muestra navegacion en 2 niveles: **Categoria > Sub-categoria > Tramites**.
Las categorias son la **estructura de navegacion** del portal (arbol). Las etiquetas son **filtros transversales** (chips) que cruzan categorias. Son conceptos distintos que conviven:

- **Categoria:** Automotor > Licencia de conducir (donde esta el tramite)
- **Etiqueta:** "Personas", "DNI", "Adultos Mayores" (como se filtra transversalmente)

Un tramite pertenece a una categoria (nivel 2) y puede tener N etiquetas.

### 1.1 Backend

**Nueva tabla SQL:**

```sql
CREATE TABLE categorias (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(50) DEFAULT 'folder',
  color       VARCHAR(7) DEFAULT '#666666',
  parent_id   INTEGER REFERENCES categorias(id),  -- NULL = nivel 1, con parent = nivel 2
  orden       INTEGER DEFAULT 0,                   -- para controlar orden visual
  activo      BOOLEAN DEFAULT true
);

-- Relacion N:N con tramites (reemplaza tramite_etiquetas)
CREATE TABLE tramite_categorias (
  tramite_id    UUID REFERENCES tramites(id) ON DELETE CASCADE,
  categoria_id  INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
  PRIMARY KEY (tramite_id, categoria_id)
);
```

**Seed de datos iniciales (del Figma):**

```
Nivel 1                              Nivel 2
─────────────────────────────────    ────────────────────────────
Automotor, transporte y transito  →  Licencia de conducir
                                     Infracciones
                                     Tasas
                                     Permisos y solicitudes
Denuncias                         →  (sub-categorias por definir)
Jubilaciones y pensiones          →  (sub-categorias por definir)
Impuestos, pagos y deudas         →  (sub-categorias por definir)
Actividades comerciales           →  (sub-categorias por definir)
```

**Nueva interfaz:**

```typescript
interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  icono: string;
  color: string;
  parentId: number | null;       // null = categoria raiz (nivel 1)
  orden: number;
  activo: boolean;
  children?: Categoria[];        // sub-categorias (populate en GET)
  tramitesCount?: number;        // campo calculado
}

interface CategoriaCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  parentId?: number;
  orden?: number;
}

interface CategoriaUpdate extends Partial<CategoriaCreate> {
  activo?: boolean;
}
```

**Nuevos endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/categorias` | Listar todas (arbol completo, hijos anidados) | `PaginatedResponse<Categoria>` |
| GET | `/categorias/:id` | Obtener por ID (incluye children y tramitesCount) | `Categoria` |
| GET | `/categorias/slug/:slug` | Obtener por slug (portal publico) | `Categoria` |
| POST | `/categorias` | Crear categoria | `Categoria` |
| PUT | `/categorias/:id` | Editar categoria | `Categoria` |
| DELETE | `/categorias/:id` | Eliminar (solo si no tiene tramites asociados) | `void` |

**Cambios en Tramite:**

```typescript
// En TramiteCreate / TramiteUpdate, AGREGAR (sin eliminar etiquetaIds):
categoriaIds: number[];   // IDs de categorias nivel 2 (sub-categorias)

// etiquetaIds: number[];  ← SE MANTIENE, no se elimina
```

```sql
-- En tabla tramites, agregar FK opcional para categoria principal (nivel 2)
ALTER TABLE tramites ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);
```

### 1.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Nuevo modulo `pages/categorias/` | ABM con vista de arbol (nivel 1 > nivel 2). Reemplaza el modulo de Etiquetas actual |
| Servicio `categoria.service.ts` | CRUD + getTree() que devuelve categorias con children anidados |
| Interfaz en `core/models/` | Agregar `Categoria`, `CategoriaCreate`, `CategoriaUpdate` |
| Formulario de tramite | Reemplazar selector de etiquetas por selector de categorias (nivel 2). Mostrar agrupado por categoria padre |
| Nav item | Agregar "Categorias" en `role-mapping.constants.ts` (mantener "Etiquetas" tambien) |

---

## 2. Destinatarios / Audiencia (entidad nueva)

El Figma muestra 3 tabs en el home y un badge en la ficha de tramite: Ciudadania, Organizaciones y empresas, Organismos.

### 2.1 Backend

**Nueva tabla SQL:**

```sql
CREATE TABLE destinatarios (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL,   -- 'Ciudadanía', 'Organizaciones y empresas', 'Organismos'
  slug    VARCHAR(100) UNIQUE NOT NULL,
  icono   VARCHAR(50) DEFAULT 'people',
  orden   INTEGER DEFAULT 0,
  activo  BOOLEAN DEFAULT true
);

-- Relacion N:N (un tramite puede ser para ciudadanos Y empresas)
CREATE TABLE tramite_destinatarios (
  tramite_id      UUID REFERENCES tramites(id) ON DELETE CASCADE,
  destinatario_id INTEGER REFERENCES destinatarios(id) ON DELETE CASCADE,
  PRIMARY KEY (tramite_id, destinatario_id)
);
```

**Seed:**

```sql
INSERT INTO destinatarios (nombre, slug, icono, orden) VALUES
  ('Ciudadanía', 'ciudadania', 'person', 1),
  ('Organizaciones y empresas', 'organizaciones-empresas', 'business', 2),
  ('Organismos', 'organismos', 'account_balance', 3);
```

**Nueva interfaz:**

```typescript
interface Destinatario {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  orden: number;
  activo: boolean;
}
```

**Nuevos endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/destinatarios` | Listar todos | `Destinatario[]` |

Es un catalogo chico (3 registros). No necesita ABM completo ahora — se precarga con seed. Si a futuro se quiere gestionar desde el backoffice, se agrega CRUD.

**Cambios en Tramite:**

```typescript
// Agregar a la interfaz Tramite:
destinatarios?: Pick<Destinatario, 'id' | 'nombre'>[];

// Agregar a TramiteCreate / TramiteUpdate:
destinatarioIds: number[];

// Agregar a TramiteFilter:
destinatarioId?: number;
```

### 2.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Formulario de tramite | Agregar campo `select-multiple` de destinatarios (precargado del endpoint GET /destinatarios) |
| Lista de tramites | Agregar columna o chip de destinatario |
| Filtro en lista | Agregar dropdown de destinatario en los filtros |
| Interfaz en `core/models/` | Agregar `Destinatario` |
| Servicio | `destinatario.service.ts` con `getAll()` |

---

## 3. Modalidades Actualizadas

El Figma muestra 4 modalidades, no 3.

### 3.1 Backend

**Actualizar seed:**

```sql
-- Eliminar las 3 actuales y reemplazar:
INSERT INTO modalidades (nombre, descripcion, icono, color) VALUES
  ('Digital de punta a punta', 'El tramite se realiza completamente en linea', 'computer', '#4CAF50'),
  ('Digital con instancia presencial', 'Inicio digital con paso presencial obligatorio', 'swap_horiz', '#2196F3'),
  ('Presencial con apoyo digital', 'Atencion presencial con soporte de herramientas digitales', 'storefront', '#FF9800'),
  ('Informativo / derivacion', 'Solo informacion, redirige al organismo correspondiente', 'info', '#9E9E9E');
```

### 3.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Mock data | Actualizar `mock-data.ts` con las 4 modalidades nuevas |
| Sin cambios de codigo | El selector de modalidades ya se carga dinamicamente del endpoint |

---

## 4. Campos Estructurados en Tramite (acordeon del Figma)

La ficha de tramite en `tramites2.png` muestra secciones de acordeon. Los campos `resumen` y `descripcionLarga` no alcanzan.

### 4.1 Backend

**Agregar columnas a tabla `tramites`:**

```sql
ALTER TABLE tramites ADD COLUMN requisitos TEXT;       -- Guia de Requisitos Generales
ALTER TABLE tramites ADD COLUMN formularios TEXT;      -- Formularios e instructivos
ALTER TABLE tramites ADD COLUMN contacto TEXT;         -- Contacto (default provincial)
ALTER TABLE tramites ADD COLUMN costos TEXT;            -- Costos (default provincial)
ALTER TABLE tramites ADD COLUMN sitio_web_tramite TEXT; -- Sitio web especifico del tramite
```

**Actualizar interfaces:**

```typescript
// Agregar a Tramite:
requisitos: string | null;
formularios: string | null;
contacto: string | null;
costos: string | null;
sitioWebTramite: string | null;

// Agregar a TramiteCreate:
requisitos?: string;
formularios?: string;
contacto?: string;
costos?: string;
sitioWebTramite?: string;
```

### 4.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Formulario de tramite — Tab "Contenido Provincial" | Agregar 5 campos `textarea` (o rich text a futuro): requisitos, costos, formularios, contacto, sitioWebTramite |
| Preview de tramite | Actualizar `tramite-preview.component` para mostrar las secciones en acordeon como en el Figma |
| Mock data | Agregar contenido de ejemplo para los campos nuevos |

---

## 5. Contenido por Localidad (el cambio mas grande)

Cuando el ciudadano cambia la localidad en la ficha, el contenido de costos, contacto, horarios y URL de inicio cambian.

### 5.1 Backend

**Nueva tabla SQL:**

```sql
CREATE TABLE tramite_contenido_localidad (
  id              SERIAL PRIMARY KEY,
  tramite_id      UUID NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
  localidad_id    INTEGER NOT NULL REFERENCES localidades(id),
  costos          TEXT,              -- override de costos para esta localidad
  contacto        TEXT,              -- override de contacto
  sitio_web       TEXT,              -- URL del organismo local
  url_tramite     TEXT,              -- "Iniciar tramite" especifico
  horarios        TEXT,              -- Horarios de atencion local
  notas           TEXT,              -- Info adicional
  activo          BOOLEAN DEFAULT true,
  UNIQUE(tramite_id, localidad_id)
);
```

**Logica de resolucion (backend):**
```
Para cada seccion (costos, contacto, sitioWeb):
  1. Buscar en tramite_contenido_localidad WHERE tramite_id = X AND localidad_id = Y
  2. Si existe y no es null → usar ese valor
  3. Si no existe o es null → usar el valor base de la tabla tramites (fallback provincial)
```

**Nueva interfaz:**

```typescript
interface TramiteContenidoLocalidad {
  id: number;
  tramiteId: string;
  localidadId: number;
  localidadNombre?: string;        // campo join
  costos: string | null;
  contacto: string | null;
  sitioWeb: string | null;
  urlTramite: string | null;
  horarios: string | null;
  notas: string | null;
  activo: boolean;
}

interface TramiteContenidoLocalidadCreate {
  localidadId: number;
  costos?: string;
  contacto?: string;
  sitioWeb?: string;
  urlTramite?: string;
  horarios?: string;
  notas?: string;
}

interface TramiteContenidoLocalidadUpdate extends Partial<TramiteContenidoLocalidadCreate> {
  activo?: boolean;
}
```

**Nuevos endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/tramites/:id/localidades` | Listar contenido de todas las localidades de un tramite | `TramiteContenidoLocalidad[]` |
| GET | `/tramites/:id/localidades/:localidadId` | Contenido resuelto (con fallback) para una localidad | `TramiteContenidoLocalidad` |
| POST | `/tramites/:id/localidades` | Agregar contenido para una localidad | `TramiteContenidoLocalidad` |
| PUT | `/tramites/:id/localidades/:localidadId` | Editar contenido de una localidad | `TramiteContenidoLocalidad` |
| DELETE | `/tramites/:id/localidades/:localidadId` | Eliminar override de localidad | `void` |

**Cambios en el GET de tramite para el portal:**

```typescript
// GET /tramites/:id?localidadId=5
// Devuelve el tramite con los campos de contenido ya resueltos (merge base + override local)
interface TramiteDetalle extends Tramite {
  // Campos ya resueltos segun localidad:
  costosResuelto: string | null;       // override local o fallback provincial
  contactoResuelto: string | null;
  sitioWebResuelto: string | null;
  urlTramiteResuelto: string | null;
  horariosResuelto: string | null;
  notasResuelto: string | null;
  localidadActual?: Pick<Localidad, 'id' | 'nombre'>;
  localidadesDisponibles: Pick<Localidad, 'id' | 'nombre'>[];  // para el dropdown
}
```

### 5.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Formulario de tramite — Tab nueva "Contenido por Localidad" | Tabla editable con columnas: Localidad, Costos, Contacto, Sitio Web, URL Tramite, Horarios, Notas. Boton "+ Agregar localidad" que abre un row nuevo con selector de localidad |
| Servicio | Agregar metodos en `tramite.service.ts`: `getLocalidades(tramiteId)`, `addLocalidad(tramiteId, data)`, `updateLocalidad(tramiteId, localidadId, data)`, `removeLocalidad(tramiteId, localidadId)` |
| Interfaz | Agregar `TramiteContenidoLocalidad`, `TramiteContenidoLocalidadCreate`, `TramiteContenidoLocalidadUpdate` en models |
| Preview | El preview dialog debe tener un selector de localidad que cambie el contenido mostrado |
| Lista de tramites | Agregar indicador visual (chip/badge) de cuantas localidades tiene configuradas cada tramite |
| Mock API | Agregar handlers para los endpoints nuevos de localidades |

---

## 6. Cambios en el Formulario de Tramite (resumen visual)

El formulario pasa de ser una pantalla unica a tener tabs:

```
┌─────────────────┬──────────────────────┬────────────────────────┐
│ Datos Generales │ Contenido Provincial │ Contenido por Localidad│
└─────────────────┴──────────────────────┴────────────────────────┘

Tab 1 — Datos Generales:
  ├── Titulo *
  ├── Resumen *
  ├── URL Oficial (default)
  ├── Organismo * (select)
  ├── Modalidad * (select, ahora 4 opciones)
  ├── Categoria * (select agrupado: nivel 1 > nivel 2)
  ├── Destinatarios * (select-multiple: Ciudadania, Organizaciones, Organismos)
  ├── Icono (icon-picker)
  └── Destacado (toggle)

Tab 2 — Contenido Provincial (igual para toda la provincia):
  ├── Descripcion Larga (textarea / rich text futuro)
  ├── Requisitos (textarea)
  ├── Costos default (textarea)
  ├── Formularios e Instructivos (textarea)
  ├── Contacto default (textarea)
  └── Sitio Web del tramite (url)

Tab 3 — Contenido por Localidad (overrides):
  ┌───────────┬──────────┬─────────────────┬─────────────┬──────────┬────────┐
  │ Localidad │ Costos   │ Contacto        │ URL Tramite │ Horarios │ Acciones│
  ├───────────┼──────────┼─────────────────┼─────────────┼──────────┼────────┤
  │ Posadas   │ $15.000  │ Av. Roque P...  │ link-pos    │ 8-14hs   │ ✏️ 🗑️  │
  │ Obera     │ $12.000  │ Calle Italia... │ link-obe    │ 8-13hs   │ ✏️ 🗑️  │
  └───────────┴──────────┴─────────────────┴─────────────┴──────────┴────────┘
  [+ Agregar localidad]

  Nota: los campos vacios heredan el valor de Tab 2 (fallback provincial)
```

---

## 7. Preparacion para Roles por Localidad (futuro)

No se implementa ahora, pero se deja la estructura lista.

### 7.1 Backend

```sql
-- Agregar campo nullable a usuarios (no se usa todavia)
ALTER TABLE usuarios ADD COLUMN localidad_id INTEGER REFERENCES localidades(id);
```

```typescript
// Agregar a interfaz Usuario:
localidadId: number | null;
localidadNombre?: string;

// Agregar a UsuarioCreate:
localidadId?: number;
```

### 7.2 Backoffice

| Tarea | Detalle |
|-------|---------|
| Formulario de usuario | Agregar campo `localidad` (select, opcional). Visible solo cuando rol es EDITOR |
| Nota: no se filtra nada por localidad todavia | Solo se almacena el dato. El filtro se activa cuando se implemente el rol EDITOR_LOCAL |

---

## 8. Etiquetas — Se Mantienen como Filtros Transversales

El Figma (`tramites3.png`) muestra una fila de chips "Filtrar por etiquetas" con: Personas, Niños, DNI, Salud, Educacion, Alimentos, Adultos Mayores, Discapacidad, Reciclaje, Seguridad, Medio Ambiente, Jubilaciones, Cultura, Deportes, Turismo.

Las etiquetas **no se eliminan**. Conviven con las categorias:

| Concepto | Rol | Ejemplo |
|----------|-----|---------|
| Categoria | Estructura de navegacion (arbol 2 niveles) | Automotor > Licencia de conducir |
| Etiqueta | Filtro transversal (chips, cruza categorias) | "Personas", "DNI", "Adultos Mayores" |

### Cambios en Etiquetas

| Paso | Detalle |
|------|---------|
| 1 | Eliminar el campo `categoria` de la interfaz `Etiqueta` (ya no agrupa, eso lo hacen las Categorias) |
| 2 | Actualizar seed con las etiquetas del Figma: Personas, Niños, DNI, Salud, Educacion, Alimentos, Adultos Mayores, Discapacidad, Reciclaje, Seguridad, Medio Ambiente, Jubilaciones, Cultura, Deportes, Turismo |
| 3 | Mantener tabla `tramite_etiquetas` (relacion N:N) |
| 4 | Mantener modulo ABM de Etiquetas en backoffice |
| 5 | Mantener `etiqueta.service.ts` y endpoints `/etiquetas` |

**Interfaz actualizada:**

```typescript
interface Etiqueta {
  id: number;
  nombre: string;
  slug: string;
  // categoria: string;    ← ELIMINADO, ya no aplica
  icono: string;
  color: string;
  activo: boolean;
  tramitesCount?: number;
}

interface EtiquetaCreate {
  nombre: string;
  // categoria: string;    ← ELIMINADO
  icono?: string;
  color?: string;
}
```

---

## 9. Cambios en TramiteFilter (busqueda)

```typescript
interface TramiteFilter {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  estado?: TramiteEstado;
  categoriaId?: number;          // NUEVO
  etiquetaId?: number;           // SE MANTIENE
  destinatarioId?: number;       // NUEVO
  localidadId?: number;
  destacado?: boolean;
  page?: number;
  pageSize?: number;
}
```

---

## 10. Resumen de Endpoints Nuevos y Modificados

### Nuevos

| Metodo | Ruta | Modulo |
|--------|------|--------|
| GET | `/categorias` | Categorias |
| GET | `/categorias/:id` | Categorias |
| GET | `/categorias/slug/:slug` | Categorias |
| POST | `/categorias` | Categorias |
| PUT | `/categorias/:id` | Categorias |
| DELETE | `/categorias/:id` | Categorias |
| GET | `/destinatarios` | Destinatarios |
| GET | `/tramites/:id/localidades` | Contenido por localidad |
| GET | `/tramites/:id/localidades/:localidadId` | Contenido por localidad |
| POST | `/tramites/:id/localidades` | Contenido por localidad |
| PUT | `/tramites/:id/localidades/:localidadId` | Contenido por localidad |
| DELETE | `/tramites/:id/localidades/:localidadId` | Contenido por localidad |

### Modificados

| Endpoint | Cambio |
|----------|--------|
| `GET /tramites` | Agregar filtros `categoriaId`, `destinatarioId`. Mantener `etiquetaId` |
| `GET /tramites/:id` | Aceptar query param `localidadId` para resolver contenido. Incluir `localidadesDisponibles` |
| `POST /tramites` | Body ahora incluye `categoriaIds`, `destinatarioIds`, campos estructurados (requisitos, costos, etc.). Mantiene `etiquetaIds` |
| `PUT /tramites/:id` | Idem POST |

### Endpoints de Etiquetas — Se mantienen sin cambios

Los endpoints `/etiquetas` (GET, GET/:id, POST, PUT, DELETE) siguen existiendo. Las etiquetas conviven con las categorias como filtros transversales.

---

## 11. Orden de Ejecucion Sugerido

```
Fase A — Modelo de datos (backend primero)
  1. Crear tabla categorias + seed inicial
  2. Crear tabla destinatarios + seed (3 registros)
  3. Agregar columnas estructuradas a tramites (requisitos, costos, etc.)
  4. Crear tabla tramite_contenido_localidad
  5. Crear tabla tramite_categorias y tramite_destinatarios
  6. Actualizar seed de modalidades (4 valores)
  7. Agregar localidad_id nullable a usuarios
  8. Actualizar seed de etiquetas (chips del Figma), eliminar campo categoria de etiquetas

Fase B — Backend endpoints
  1. CRUD /categorias (con soporte de arbol padre-hijo)
  2. GET /destinatarios
  3. Actualizar CRUD /tramites (campos nuevos, relaciones nuevas, mantener etiquetas)
  4. CRUD /tramites/:id/localidades
  5. Resolver contenido por localidad en GET /tramites/:id?localidadId=X
  6. Actualizar filtros en GET /tramites (agregar categoriaId, destinatarioId, mantener etiquetaId)

Fase C — Backoffice
  1. Nuevo modulo Categorias (ABM con vista de arbol)
  2. Nuevo servicio destinatario.service.ts
  3. Refactorizar formulario de tramite (3 tabs, incluye selector de categorias Y etiquetas)
  4. Actualizar mock-api.interceptor.ts con endpoints nuevos
  5. Actualizar tramite-preview con acordeon y selector de localidad
  6. Actualizar modulo Etiquetas (eliminar campo categoria del formulario)
  7. Actualizar nav items y rutas (agregar Categorias, mantener Etiquetas)
```
