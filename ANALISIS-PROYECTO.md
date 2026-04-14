# Portal Provincial de Tramites de Misiones — Documento de Proyecto

**Entidad:** Subsecretaria de Gobierno Inteligente — Vicegobernacion de Misiones
**Fecha:** Abril 2026

---

## 1. Introduccion

El Portal Provincial de Tramites de Misiones es una plataforma digital que centraliza la informacion sobre tramites provinciales dispersa en multiples sitios web. Funciona como ventanilla unica de descubrimiento y orientacion: el ciudadano busca, encuentra la informacion del tramite (requisitos, costos, modalidad, organismo) y es derivado a la URL oficial del organismo correspondiente.

El sistema se compone de tres piezas:

- **Portal publico** (Next.js 14) — interfaz ciudadana con buscador, filtros y fichas de tramites
- **Backoffice** (Angular 17) — panel de administracion donde organismos cargan y gestionan sus tramites
- **API REST** (NestJS / PostgreSQL) — backend compartido que alimenta ambos frontends

La gestion es descentralizada: cada organismo administra sus propios tramites bajo reglas comunes, con un workflow de publicacion (borrador > revision > publicado) y control de calidad central.

---

## 2. Arquitectura General

```
                    ┌─────────────────────┐
                    │   Portal Publico    │
                    │   Next.js 14 (SSR)  │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │      API REST       │
                    │  NestJS + PostgreSQL │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │     Backoffice      │
                    │    Angular 17       │
                    └─────────────────────┘
```

**Stack tecnologico:**

| Capa | Tecnologia | Justificacion |
|------|-----------|---------------|
| Portal publico | Next.js 14 (App Router), Tailwind CSS | SSR/SSG para SEO, performance <2s |
| Backoffice | Angular 17 (standalone components), Angular Material | Panel admin robusto, formularios complejos |
| Backend | NestJS (Node.js) | API REST tipada, modular, compatible con TypeScript |
| Base de datos | PostgreSQL + PostGIS | Relacional, georreferenciacion futura |
| Busqueda | Meilisearch | Tolerancia a errores ortograficos, busqueda semantica |
| Infraestructura | Docker, CI/CD (GitHub Actions) | Contenedores, deploy automatizado |

---

## 3. Roles y Permisos (RBAC)

| Rol | Descripcion | Acceso |
|-----|-------------|--------|
| SUPERADMIN | Administrador general de la plataforma | Todo: organismos, usuarios, tramites de todos los organismos, etiquetas, modalidades, eventos de vida, auditoria, reportes, feedback |
| ADMIN_ORGANISMO | Administrador de un organismo especifico | Tramites de su organismo, usuarios de su organismo, feedback, reportes |
| EDITOR | Operador de carga | Crear y editar tramites (solo los propios) |

---

## 4. Modulos y Features

### 4.1 Autenticacion

Login con email/password. El backend retorna un JWT que el frontend almacena y envia en cada request. Incluye refresh token.

**Interfaces:**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  code: number;
  message: string;
  data: {
    token: string;        // JWT
    refreshToken?: string;
  };
}

interface JwtPayload {
  sub: string;            // email
  roles: string;          // "ROLE_SUPERADMIN" | "ROLE_ADMIN_ORGANISMO" | "ROLE_EDITOR"
  userId: string;         // UUID
  nombre: string;
  apellido: string;
  organismoId: string | null;
  exp: number;
  iat: number;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/auth/login` | Login, retorna JWT + refresh token |
| POST | `/auth/refresh` | Renueva token con refresh token |

---

### 4.2 Tramites

Entidad central del sistema. Cada tramite pertenece a un organismo, tiene una modalidad, multiples etiquetas, puede estar asociado a localidades y eventos de vida. Sigue un workflow de estados: `borrador > revision > publicado <> despublicado`.

**Interfaces:**

```typescript
type TramiteEstado = 'borrador' | 'revision' | 'publicado' | 'despublicado';

interface Tramite {
  id: string;                  // UUID
  titulo: string;
  slug: string;                // URL-friendly, unico
  resumen: string | null;
  descripcionLarga: string | null;
  urlOficial: string;          // URL externa del organismo
  organismoId: string;         // FK UUID
  modalidadId: number;         // FK
  icono: string;               // nombre de icono Material
  estado: TramiteEstado;
  destacado: boolean;
  etiquetas: Etiqueta[];
  localidades?: Pick<Localidad, 'id' | 'nombre'>[];
  eventosDeVida?: Pick<EventoDeVida, 'id' | 'nombre'>[];
  organismo?: Organismo;       // populate opcional
  modalidad?: Modalidad;       // populate opcional
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}

interface TramiteCreate {
  titulo: string;
  resumen: string;
  descripcionLarga?: string;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  icono: string;
  etiquetaIds: number[];
  localidadIds?: number[];
  eventoDeVidaIds?: number[];
  destacado?: boolean;
}

interface TramiteUpdate extends Partial<TramiteCreate> {
  estado?: TramiteEstado;
}

interface TramiteFilter {
  search?: string;             // texto libre sobre titulo/resumen
  organismoId?: string;
  modalidadId?: number;
  estado?: TramiteEstado;
  etiquetaId?: number;
  localidadId?: number;
  destacado?: boolean;
  page?: number;
  pageSize?: number;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/tramites` | Listar con filtros y paginacion | `PaginatedResponse<Tramite>` |
| GET | `/tramites/:id` | Obtener por UUID | `Tramite` |
| GET | `/tramites/slug/:slug` | Obtener por slug (portal publico) | `Tramite` |
| POST | `/tramites` | Crear tramite (estado inicial: borrador) | `Tramite` |
| PUT | `/tramites/:id` | Editar tramite completo | `Tramite` |
| DELETE | `/tramites/:id` | Baja logica | `void` |
| PATCH | `/tramites/:id/publicar` | Cambiar estado a publicado | `Tramite` |
| PATCH | `/tramites/:id/despublicar` | Cambiar estado a despublicado | `Tramite` |
| PATCH | `/tramites/:id/revision` | Enviar a revision | `Tramite` |

**Notas para backend:**
- El `slug` se autogenera a partir del `titulo` y debe ser unico.
- Al crear, el estado siempre arranca en `borrador`.
- Las transiciones de estado validas son: `borrador > revision > publicado > despublicado > publicado`.
- Las relaciones N:N (etiquetas, localidades, eventos de vida) se envian como arrays de IDs en el create/update.
- El GET con filtros debe soportar busqueda por texto libre sobre `titulo` y `resumen` (ILIKE o Meilisearch).

---

### 4.3 Organismos

Entidades gubernamentales que gestionan tramites. Soportan jerarquia (un organismo puede tener parent).

**Interfaces:**

```typescript
interface Organismo {
  id: string;                  // UUID
  nombre: string;
  sigla: string | null;        // ej: "IPS", "ANSES"
  logoUrl: string | null;
  sitioWeb: string | null;
  parentId: string | null;     // FK UUID, jerarquia
  parent?: Organismo;          // populate opcional
  children?: Organismo[];      // populate opcional
}

interface OrganismoCreate {
  nombre: string;
  sigla?: string;
  logoUrl?: string;
  sitioWeb?: string;
  parentId?: string;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/organismos` | Listar todos | `PaginatedResponse<Organismo>` |
| GET | `/organismos/:id` | Obtener por UUID | `Organismo` |
| POST | `/organismos` | Crear organismo | `Organismo` |
| PUT | `/organismos/:id` | Editar organismo | `Organismo` |
| DELETE | `/organismos/:id` | Baja logica | `void` |

**Acceso:** Solo SUPERADMIN.

---

### 4.4 Etiquetas

Clasifican tramites por tematica (Salud, Educacion, Niñez, DNI, etc). Relacion N:N con tramites.

**Interfaces:**

```typescript
interface Etiqueta {
  id: number;                  // autoincremental
  nombre: string;
  slug: string;                // autogenerado
  categoria: string;           // agrupacion (ej: "Documentacion", "Salud")
  icono: string;
  color: string;               // hex
  activo: boolean;
  tramitesCount?: number;      // campo calculado, cantidad de tramites asociados
}

interface EtiquetaCreate {
  nombre: string;
  categoria: string;
  icono?: string;
  color?: string;
}

interface EtiquetaUpdate extends Partial<EtiquetaCreate> {
  activo?: boolean;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/etiquetas` | Listar todas | `PaginatedResponse<Etiqueta>` |
| GET | `/etiquetas/:id` | Obtener por ID | `Etiqueta` |
| POST | `/etiquetas` | Crear etiqueta | `Etiqueta` |
| PUT | `/etiquetas/:id` | Editar etiqueta | `Etiqueta` |
| DELETE | `/etiquetas/:id` | Eliminar etiqueta | `void` |

**Acceso:** Solo SUPERADMIN.

---

### 4.5 Modalidades

Tipo de atencion del tramite: Digital, Presencial o Mixto.

**Interfaces:**

```typescript
interface Modalidad {
  id: number;                  // autoincremental
  nombre: string;              // "Digital" | "Presencial" | "Mixto"
  descripcion: string | null;
  icono: string;
  color: string;               // hex
  activo: boolean;
  tramitesCount?: number;      // campo calculado
}

interface ModalidadCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
}

interface ModalidadUpdate extends Partial<ModalidadCreate> {
  activo?: boolean;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/modalidades` | Listar todas | `PaginatedResponse<Modalidad>` |
| GET | `/modalidades/:id` | Obtener por ID | `Modalidad` |
| POST | `/modalidades` | Crear modalidad | `Modalidad` |
| PUT | `/modalidades/:id` | Editar modalidad | `Modalidad` |
| DELETE | `/modalidades/:id` | Eliminar modalidad | `void` |

**Acceso:** Solo SUPERADMIN.

---

### 4.6 Usuarios

Usuarios internos del backoffice. Cada usuario tiene un rol y puede estar asociado a un organismo.

**Interfaces:**

```typescript
enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN_ORGANISMO = 'ADMIN_ORGANISMO',
  EDITOR = 'EDITOR',
}

interface Usuario {
  id: string;                  // UUID
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  organismoId: string | null;  // FK UUID, null para SUPERADMIN
  organismoNombre?: string;    // campo join, solo lectura
  activo: boolean;
  createdAt: string;           // ISO 8601
}

interface UsuarioCreate {
  email: string;
  nombre: string;
  apellido: string;
  password: string;
  rol: UserRole;
  organismoId?: string;        // requerido si rol != SUPERADMIN
}

interface UsuarioUpdate {
  nombre?: string;
  apellido?: string;
  rol?: UserRole;
  organismoId?: string;
  activo?: boolean;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/usuarios` | Listar (SUPERADMIN ve todos, ADMIN_ORGANISMO ve los de su organismo) | `PaginatedResponse<Usuario>` |
| GET | `/usuarios/:id` | Obtener por UUID | `Usuario` |
| POST | `/usuarios` | Crear usuario | `Usuario` |
| PUT | `/usuarios/:id` | Editar usuario | `Usuario` |
| PATCH | `/usuarios/:id/toggle-active` | Activar/desactivar usuario | `Usuario` |

**Acceso:** SUPERADMIN (todos), ADMIN_ORGANISMO (solo su organismo).

**Notas para backend:**
- El password se hashea con bcrypt.
- ADMIN_ORGANISMO solo puede crear usuarios con rol EDITOR dentro de su propio organismo.
- No hay endpoint DELETE; la baja es logica via toggle-active.

---

### 4.7 Localidades

Localidades de la provincia de Misiones. Son datos maestros que se precargan. Los tramites pueden tener contenido diferenciado por localidad (costos, horarios, oficinas).

**Interfaces:**

```typescript
interface Localidad {
  id: number;                  // autoincremental
  nombre: string;              // "Posadas", "Obera", "Iguazu"
  departamento: string;        // "Capital", "Obera", "Iguazu"
  codigoPostal: string | null;
  activo: boolean;
  tramitesCount?: number;      // campo calculado
}

interface LocalidadCreate {
  nombre: string;
  departamento: string;
  codigoPostal?: string;
}

interface LocalidadUpdate extends Partial<LocalidadCreate> {
  activo?: boolean;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/localidades` | Listar con filtro opcional por `search` y `departamento` | `PaginatedResponse<Localidad>` |

**Notas para backend:**
- Las localidades son datos maestros. Se precargan con un seed. Actualmente el frontend solo las consume (GET), no las crea/edita desde UI.
- Futuro: podria agregarse CRUD completo si se necesita gestion desde el backoffice.

---

### 4.8 Eventos de Vida

Agrupan tramites por situaciones del ciudadano: "Voy a tener un hijo", "Quiero emprender", "Me estoy jubilando". Relacion N:N con tramites.

**Interfaces:**

```typescript
interface EventoDeVida {
  id: number;                  // autoincremental
  nombre: string;
  descripcion: string | null;
  icono: string;
  color: string;               // hex
  activo: boolean;
  tramitesCount?: number;      // campo calculado
  tramites?: Pick<Tramite, 'id' | 'titulo'>[];  // populate opcional
}

interface EventoDeVidaCreate {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  tramiteIds?: string[];       // UUIDs de tramites a asociar
}

interface EventoDeVidaUpdate extends Partial<EventoDeVidaCreate> {
  activo?: boolean;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/eventos-de-vida` | Listar todos | `PaginatedResponse<EventoDeVida>` |
| GET | `/eventos-de-vida/:id` | Obtener por ID (incluye tramites asociados) | `EventoDeVida` |
| POST | `/eventos-de-vida` | Crear evento de vida | `EventoDeVida` |
| PUT | `/eventos-de-vida/:id` | Editar evento de vida | `EventoDeVida` |
| DELETE | `/eventos-de-vida/:id` | Eliminar evento de vida | `void` |
| PATCH | `/eventos-de-vida/:id/toggle-active` | Activar/desactivar | `EventoDeVida` |

**Acceso:** Solo SUPERADMIN.

---

### 4.9 Auditoria y Trazabilidad

Registro automatico de cada accion que se realiza sobre un tramite. Solo lectura desde el frontend.

**Interfaces:**

```typescript
type AuditoriaAccion = 'crear' | 'editar' | 'publicar' | 'despublicar' | 'enviar_revision' | 'eliminar';

interface AuditoriaTramite {
  id: number;                  // autoincremental
  tramiteId: string;           // FK UUID
  usuarioId: string;           // FK UUID
  accion: AuditoriaAccion;
  datosAnteriores: Record<string, unknown> | null;   // snapshot JSONB pre-cambio
  datosNuevos: Record<string, unknown> | null;       // snapshot JSONB post-cambio
  fechaAccion: string;         // ISO 8601
  usuarioNombre?: string;      // campo join
  tramiteTitulo?: string;      // campo join
}

interface AuditoriaFilter {
  search?: string;             // texto libre sobre tramiteTitulo o usuarioNombre
  accion?: AuditoriaAccion;
  usuarioId?: string;
  tramiteId?: string;
  fechaDesde?: string;         // ISO 8601
  fechaHasta?: string;         // ISO 8601
  page?: number;
  pageSize?: number;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/auditoria` | Listar con filtros y paginacion | `PaginatedResponse<AuditoriaTramite>` |
| GET | `/auditoria/:id` | Detalle de una entrada de auditoria | `AuditoriaTramite` |

**Acceso:** Solo SUPERADMIN.

**Notas para backend:**
- Los registros de auditoria se crean automaticamente en el backend cada vez que se ejecuta una accion sobre un tramite (crear, editar, publicar, etc). No hay endpoint POST desde el frontend.
- `datosAnteriores` y `datosNuevos` son JSONB con el snapshot del tramite antes y despues del cambio, para diff.

---

### 4.10 Feedback Ciudadano

Los ciudadanos valoran las fichas de tramites desde el portal publico ("¿Te resulto util esta informacion?"). El backoffice muestra el listado y estadisticas agregadas.

**Interfaces:**

```typescript
interface FeedbackTramite {
  id: number;                  // autoincremental
  tramiteId: string;           // FK UUID
  tramiteTitulo?: string;      // campo join
  organismoNombre?: string;    // campo join
  esUtil: boolean;
  comentario: string | null;
  fechaFeedback: string;       // ISO 8601
}

interface FeedbackFilter {
  search?: string;             // texto libre sobre tramiteTitulo o comentario
  esUtil?: boolean;
  tramiteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  pageSize?: number;
}

interface FeedbackStats {
  total: number;
  totalUtil: number;
  totalNoUtil: number;
  totalConComentario: number;
  porcentajeUtil: number;      // 0-100
}
```

**Endpoints — Backoffice (lectura):**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/feedback` | Listar con filtros y paginacion | `PaginatedResponse<FeedbackTramite>` |
| GET | `/feedback/stats` | Estadisticas agregadas | `FeedbackStats` |

**Endpoints — Portal publico (escritura):**

| Metodo | Ruta | Descripcion | Body |
|--------|------|-------------|------|
| POST | `/feedback` | Ciudadano envia valoracion | `{ tramiteId: string, esUtil: boolean, comentario?: string }` |

**Acceso backoffice:** SUPERADMIN (todos), ADMIN_ORGANISMO (feedback de tramites de su organismo).

---

### 4.11 Dashboard y Metricas

Panel resumen con indicadores clave para la toma de decisiones.

**Interfaces:**

```typescript
interface DashboardMetrics {
  totalTramites: number;
  tramitesPublicados: number;
  tramitesBorrador: number;
  tramitesRevision: number;
  tramitesDespublicados: number;
  totalOrganismos: number;
  busquedasHoy: number;
  busquedasSinResultado: number;
  satisfaccionPromedio: number;   // 0-100, derivado de feedback
}

interface TopTramite {
  tramiteId: string;
  titulo: string;
  consultas: number;
}

interface TopBusqueda {
  termino: string;
  cantidad: number;
  sinResultados: boolean;
}

interface TramitesPorOrganismo {
  organismo: string;
  sigla: string;
  total: number;
}
```

**Endpoints:**

| Metodo | Ruta | Descripcion | Response |
|--------|------|-------------|----------|
| GET | `/dashboard/metrics` | Metricas generales | `DashboardMetrics` |
| GET | `/dashboard/top-tramites?limit=N` | Tramites mas consultados | `TopTramite[]` |
| GET | `/dashboard/top-busquedas?limit=N` | Terminos mas buscados | `TopBusqueda[]` |
| GET | `/dashboard/auditoria?page=N&pageSize=N` | Ultimas acciones | `AuditoriaTramite[]` |
| GET | `/dashboard/tramites-por-organismo` | Distribucion por organismo | `TramitesPorOrganismo[]` |

**Notas para backend:**
- `busquedasHoy` y `busquedasSinResultado` requieren una tabla `metricas_busquedas` que registre cada busqueda del portal publico.
- `satisfaccionPromedio` se calcula del porcentaje de feedback positivo.
- ADMIN_ORGANISMO debe ver metricas filtradas a su organismo.

---

### 4.12 Metricas de Busqueda

Cada busqueda realizada en el portal publico se registra para analisis.

**Interfaces (futuras):**

```typescript
interface MetricaBusqueda {
  id: number;                  // BIGSERIAL
  terminoBusqueda: string;
  resultadosEncontrados: number;
  fechaBusqueda: string;       // ISO 8601
}
```

**Endpoints — Portal publico:**

| Metodo | Ruta | Descripcion | Body |
|--------|------|-------------|------|
| POST | `/metricas/busquedas` | Registrar busqueda (fire & forget) | `{ termino: string, resultados: number }` |

---

## 5. Respuesta Paginada Generica

Todos los endpoints de listado retornan el mismo formato paginado:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;               // total de registros
  page: number;                // pagina actual (1-based)
  pageSize: number;            // registros por pagina
  totalPages: number;          // ceil(total / pageSize)
}
```

---

## 6. Modelo de Datos — Esquema SQL

### 6.1 Tablas Core

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organismos (jerarquicos)
CREATE TABLE organismos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(255) NOT NULL,
  sigla       VARCHAR(20),
  logo_url    TEXT,
  sitio_web   TEXT,
  parent_id   UUID REFERENCES organismos(id),
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modalidades
CREATE TABLE modalidades (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(50) DEFAULT 'help_outline',
  color       VARCHAR(7) DEFAULT '#666666',
  activo      BOOLEAN DEFAULT true
);

-- Etiquetas
CREATE TABLE etiquetas (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  categoria   VARCHAR(100) NOT NULL,
  icono       VARCHAR(50) DEFAULT 'label',
  color       VARCHAR(7) DEFAULT '#666666',
  activo      BOOLEAN DEFAULT true
);

-- Localidades
CREATE TABLE localidades (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  departamento    VARCHAR(100) NOT NULL,
  codigo_postal   VARCHAR(10),
  activo          BOOLEAN DEFAULT true
);

-- Eventos de Vida
CREATE TABLE eventos_de_vida (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(255) NOT NULL,
  descripcion TEXT,
  icono       VARCHAR(50) DEFAULT 'event_note',
  color       VARCHAR(7) DEFAULT '#666666',
  activo      BOOLEAN DEFAULT true
);

-- Usuarios
CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100) NOT NULL,
  rol             VARCHAR(20) NOT NULL CHECK (rol IN ('SUPERADMIN', 'ADMIN_ORGANISMO', 'EDITOR')),
  organismo_id    UUID REFERENCES organismos(id),
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tramites
CREATE TABLE tramites (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo            VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) UNIQUE NOT NULL,
  resumen           TEXT,
  descripcion_larga TEXT,
  url_oficial       TEXT NOT NULL,
  organismo_id      UUID NOT NULL REFERENCES organismos(id),
  modalidad_id      INTEGER NOT NULL REFERENCES modalidades(id),
  icono             VARCHAR(50) DEFAULT 'description',
  estado            VARCHAR(20) DEFAULT 'borrador'
                    CHECK (estado IN ('borrador', 'revision', 'publicado', 'despublicado')),
  destacado         BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 Tablas de Relacion N:N

```sql
-- Tramites <-> Etiquetas
CREATE TABLE tramite_etiquetas (
  tramite_id  UUID REFERENCES tramites(id) ON DELETE CASCADE,
  etiqueta_id INTEGER REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (tramite_id, etiqueta_id)
);

-- Tramites <-> Localidades
CREATE TABLE tramite_localidades (
  tramite_id    UUID REFERENCES tramites(id) ON DELETE CASCADE,
  localidad_id  INTEGER REFERENCES localidades(id) ON DELETE CASCADE,
  PRIMARY KEY (tramite_id, localidad_id)
);

-- Tramites <-> Eventos de Vida
CREATE TABLE tramite_eventos_de_vida (
  tramite_id          UUID REFERENCES tramites(id) ON DELETE CASCADE,
  evento_de_vida_id   INTEGER REFERENCES eventos_de_vida(id) ON DELETE CASCADE,
  PRIMARY KEY (tramite_id, evento_de_vida_id)
);
```

### 6.3 Tablas de Auditoria y Metricas

```sql
-- Auditoria de acciones sobre tramites
CREATE TABLE auditoria_tramites (
  id                SERIAL PRIMARY KEY,
  tramite_id        UUID NOT NULL REFERENCES tramites(id),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id),
  accion            VARCHAR(20) NOT NULL
                    CHECK (accion IN ('crear', 'editar', 'publicar', 'despublicar', 'enviar_revision', 'eliminar')),
  datos_anteriores  JSONB,
  datos_nuevos      JSONB,
  fecha_accion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Metricas de busquedas del portal publico
CREATE TABLE metricas_busquedas (
  id                      BIGSERIAL PRIMARY KEY,
  termino_busqueda        TEXT NOT NULL,
  resultados_encontrados  INTEGER NOT NULL DEFAULT 0,
  fecha_busqueda          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback ciudadano
CREATE TABLE feedback_tramites (
  id              SERIAL PRIMARY KEY,
  tramite_id      UUID NOT NULL REFERENCES tramites(id),
  es_util         BOOLEAN NOT NULL,
  comentario      TEXT,
  fecha_feedback  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.4 Diagrama de Relaciones

```
organismos (1) ──────────< (N) tramites
organismos (1) ──────────< (N) usuarios
organismos (1) ──────────< (N) organismos (self-ref, jerarquia)

modalidades (1) ─────────< (N) tramites

tramites (N) >──────────< (N) etiquetas         [tramite_etiquetas]
tramites (N) >──────────< (N) localidades        [tramite_localidades]
tramites (N) >──────────< (N) eventos_de_vida    [tramite_eventos_de_vida]

tramites (1) ────────────< (N) auditoria_tramites
usuarios (1) ────────────< (N) auditoria_tramites

tramites (1) ────────────< (N) feedback_tramites
```

---

## 7. Features del Portal Publico

El portal ciudadano consume la API en modo solo lectura (mas POST de feedback y metricas de busqueda).

### 7.1 Home

- Barra de busqueda hero central
- Seccion "Lo mas buscado" (top tramites)
- Categorias con iconos (derivadas de etiquetas)
- Tramites destacados

### 7.2 Busqueda y Filtros

- Busqueda por texto libre con tolerancia a errores (Meilisearch)
- Filtros multi-capa: organismo, modalidad, tematica (etiqueta), destinatario, localidad
- Resultados paginados

### 7.3 Ficha de Tramite

- Titulo, resumen, descripcion larga
- Organismo responsable
- Modalidad (Digital / Presencial / Mixto)
- Acordeon: Requisitos, Costos, Formularios, Ubicacion, Sitio Web
- Contenido diferenciado por localidad (Posadas vs Obera)
- Boton "Iniciar Tramite" (redirige a URL oficial)
- Feedback: "¿Te resulto util?"

### 7.4 Navegacion por Eventos de Vida

- Wizard: "¿Que necesitas hacer?" > selecciona evento > ve checklist de tramites relacionados
- Cada evento agrupa tramites con orden sugerido

### 7.5 Features Futuras del Portal

| Feature | Descripcion |
|---------|-------------|
| PWA + Offline | Service Worker, cache de tramites, install prompt. Critico para interior de Misiones |
| Busqueda semantica | Embeddings vectoriales sobre titulos/descripciones. "necesito el carnet para manejar camion" > Licencia clase C-D-E |
| Mi Portal | Area ciudadana: tramites guardados, historial, notificaciones, localidad preferida. Auth con MiArgentina / CIDI / email OTP |
| Asistente IA | Chatbot contextual con RAG sobre la base de tramites |
| Mapa interactivo | Mapa provincial (Leaflet + PostGIS) con tramites y oficinas por localidad |
| Comparador por localidad | Comparar costos, turnos y rating de un mismo tramite entre localidades |
| Accesibilidad avanzada | Alto contraste, lectura en voz alta (Web Speech API), pictogramas ARASAAC, texto ajustable |
| Notificaciones multicanal | Push (PWA), email, WhatsApp Business API cuando un tramite cambia |
| API publica | OpenAPI 3.0, JSON-LD para SEO semantico, datos abiertos |

---

## 8. Features del Backoffice

### 8.1 Modulos Actuales

| Modulo | Funcionalidad | Acceso |
|--------|---------------|--------|
| Dashboard | Metricas, graficos, top tramites, top busquedas, distribucion por organismo, ultimas acciones | Todos |
| Tramites | ABM completo + workflow de estados + preview de ficha ciudadana | Todos (filtrado por organismo segun rol) |
| Organismos | ABM + jerarquia | SUPERADMIN |
| Etiquetas | ABM + activar/desactivar | SUPERADMIN |
| Modalidades | ABM + activar/desactivar | SUPERADMIN |
| Usuarios | ABM + activar/desactivar | SUPERADMIN, ADMIN_ORGANISMO |
| Eventos de Vida | ABM + asociar tramites + activar/desactivar | SUPERADMIN |
| Feedback Ciudadano | Listado con filtros + estadisticas agregadas | SUPERADMIN, ADMIN_ORGANISMO |
| Auditoria | Historial de acciones con filtros + detalle con diff | SUPERADMIN |

### 8.2 Features Futuras del Backoffice

| Feature | Descripcion |
|---------|-------------|
| Notificaciones y alertas | Alertas cuando feedback negativo sube, tramites desactualizados, cambios masivos |
| KPIs predictivos | Demanda estacional, sugerencias de nuevos tramites basado en busquedas sin resultado, alertas tempranas de CSAT |
| Bulk actions | Seleccionar multiples tramites y aplicar accion masiva (publicar, despublicar, reasignar organismo) |
| Export de datos | Descargar listados en CSV, Excel o PDF |
| Gestion de localidades | CRUD completo de localidades + contenido diferenciado por localidad en cada tramite |
| Editor rich text | Editor WYSIWYG para descripcion larga de tramites |
| Dark mode | Toggle claro/oscuro (CSS variables ya preparadas) |
| Drag & drop | Reordenar tramites destacados por arrastre |
| Reportes | Modulo de reportes avanzados con graficos personalizables |

---

## 9. Convenios y Reglas

- **Idioma UI:** Español (es-AR)
- **Formato fecha:** DD/MM/YYYY
- **Tipografia:** Poppins
- **Titulos de tramites:** Deben comenzar con verbos en infinitivo (Obtener, Inscribirse, Renovar)
- **Lenguaje:** Ciudadano, sin tecnicismos legales, voz activa
- **Fichas:** Estructura homogenea: ¿A quien se dirige?, Requisitos, Paso a paso
- **Paleta:** Institucional de Misiones (verde #1B5E20 backoffice, azul #2F6EB1 portal)
- **Naming JSON:** camelCase en API responses (el frontend ya consume en camelCase)
- **IDs:** UUID v4 para entidades principales (tramites, organismos, usuarios), autoincremental para catalogos (etiquetas, modalidades, localidades, eventos de vida)

---

## 10. Resumen de Endpoints para Backend

### Auth
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| POST | `/auth/login` | `LoginRequest` |
| POST | `/auth/refresh` | `{ token: string }` |

### Tramites
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/tramites` | query: `TramiteFilter` |
| GET | `/tramites/:id` | — |
| GET | `/tramites/slug/:slug` | — |
| POST | `/tramites` | `TramiteCreate` |
| PUT | `/tramites/:id` | `TramiteUpdate` |
| DELETE | `/tramites/:id` | — |
| PATCH | `/tramites/:id/publicar` | — |
| PATCH | `/tramites/:id/despublicar` | — |
| PATCH | `/tramites/:id/revision` | — |

### Organismos
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/organismos` | — |
| GET | `/organismos/:id` | — |
| POST | `/organismos` | `OrganismoCreate` |
| PUT | `/organismos/:id` | `Partial<OrganismoCreate>` |
| DELETE | `/organismos/:id` | — |

### Etiquetas
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/etiquetas` | — |
| GET | `/etiquetas/:id` | — |
| POST | `/etiquetas` | `EtiquetaCreate` |
| PUT | `/etiquetas/:id` | `EtiquetaUpdate` |
| DELETE | `/etiquetas/:id` | — |

### Modalidades
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/modalidades` | — |
| GET | `/modalidades/:id` | — |
| POST | `/modalidades` | `ModalidadCreate` |
| PUT | `/modalidades/:id` | `ModalidadUpdate` |
| DELETE | `/modalidades/:id` | — |

### Usuarios
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/usuarios` | — |
| GET | `/usuarios/:id` | — |
| POST | `/usuarios` | `UsuarioCreate` |
| PUT | `/usuarios/:id` | `UsuarioUpdate` |
| PATCH | `/usuarios/:id/toggle-active` | — |

### Localidades
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/localidades` | query: `search`, `departamento` |

### Eventos de Vida
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/eventos-de-vida` | — |
| GET | `/eventos-de-vida/:id` | — |
| POST | `/eventos-de-vida` | `EventoDeVidaCreate` |
| PUT | `/eventos-de-vida/:id` | `EventoDeVidaUpdate` |
| DELETE | `/eventos-de-vida/:id` | — |
| PATCH | `/eventos-de-vida/:id/toggle-active` | — |

### Auditoria
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/auditoria` | query: `AuditoriaFilter` |
| GET | `/auditoria/:id` | — |

### Feedback
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/feedback` | query: `FeedbackFilter` |
| GET | `/feedback/stats` | — |
| POST | `/feedback` | `{ tramiteId, esUtil, comentario? }` |

### Dashboard
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| GET | `/dashboard/metrics` | — |
| GET | `/dashboard/top-tramites` | query: `limit` |
| GET | `/dashboard/top-busquedas` | query: `limit` |
| GET | `/dashboard/auditoria` | query: `page`, `pageSize` |
| GET | `/dashboard/tramites-por-organismo` | — |

### Metricas (Portal publico)
| Metodo | Ruta | Body / Params |
|--------|------|---------------|
| POST | `/metricas/busquedas` | `{ termino, resultados }` |

**Total: 46 endpoints**
