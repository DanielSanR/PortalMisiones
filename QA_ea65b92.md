# QA — Backend delta `31b7ca8 → ea65b92`

Delta grande: 7 controllers nuevos (Location/Department, Organism/OrganismType, Category/Modality/LifeEvent),
Municipality → Location, DTOs Role/Permission a inglés, `/api/storage/**` dejó de ser público.
Cubre **Tramo 1 (regresiones) + Tramo 2 (ABMs)** del frontend.

> **Precondiciones (todos los casos):** backend en `:8080` · front en `:4200` · **logueado como SUPERADMIN**
> (las escrituras exigen token válido) · pestaña **Network** abierta para verificar llamadas reales `/api/...`
> y que NO haya 404 a rutas viejas.
>
> ⚠️ **Auth en escrituras:** crear/editar/eliminar necesita token SUPERADMIN/ADMIN_BACKOFFICE. Sin login real
> da **500** (bug del backend: debería ser 401).

---

## 1) RBAC — Roles y Permisos (DTOs a inglés)

### Roles — nav **Roles** (`/api/role`)
- [X] **Listar**: carga con código, descripción y permisos (sin campos vacíos raros).
- [X] **Crear**: código, descripción, scope (global/organismo), assignable por org admin, activo, selector de permisos → 201.
- [X] **Editar**: cambiar descripción y permisos → 200.
- [X] **Eliminar**: baja lógica → desaparece → 200.
- [X] **Error**: código duplicado → **4061 / 409**.
- [X] **Network**: pega a `/api/role`; el JSON trae `code/scopeType/assignableByOrgAdmin`.

### Permisos — nav **Permisos** (`/api/permission`)
- [X] **Listar / Crear (code + description) / Editar / Eliminar**.
- [X] **Error**: código duplicado → **4062 / 409**.

### Selector de rol en Usuarios (`/api/role/allowed`)
- [X] Usuarios → Nuevo → el select de **Rol** se pobla (SUPERADMIN ve todos; otros, filtrado).

---

## 2) Municipios → Localidades (Department → Location, UUID)
- [X] **Sin regresión**: ningún flujo llama a `/api/municipality`.
- [X] **Consumo real** (vía Organismos): al crear/editar un Organismo, el select **"Localidad base"**
      se llena desde `/api/location` (formato "Localidad (Departamento)").
- [X] *Nota:* Localidades es dato maestro read-only, sin pantalla propia.

---

## 3) Taxonomía

### Categorías — nav **Categorías** (`/api/category`, jerárquico)
- [X] **Listar**: árbol (raíces expandibles con sub-categorías).
- [X] **Crear raíz**: Nombre + Slug (sin padre) → raíz.
- [X] **Crear sub-categoría**: desde una raíz → "Agregar sub-categoría" → padre pre-seteado → anidada.
- [X] **Editar / Eliminar**.
- [X] **Error slug duplicado** → **4072 / 400**.
- [X] **Error borrar con hijos** → **4065**.
- [X] *Se quitaron ícono/color/descripción/orden (el backend no los persiste).*

### Modalidades — nav **Modalidades** (`/api/modality`)
- [X] **Listar** (solo activas) / **Crear** (solo Nombre) / **Editar** / **Eliminar** (soft-delete).
- [X] **Error nombre duplicado** (case-insensitive) → **4072 / 400**.

### Eventos de Vida — nav **Eventos de Vida** (`/api/life-event`)
- [X] **Crear**: solo el **Nombre** → el **slug se genera solo** (visible en la lista).
- [X] **Editar** (solo nombre) / **Eliminar** (soft-delete).
- [X] *El campo Slug ya no está en el form (lo deriva el backend — cambio del último pull).*

---

## 4) Organismos y Tipos de Organismo (SUPERADMIN)

### Tipos de Organismo — nav **Tipos de Organismo** (`/api/organism-type`)
- [X] **Listar** (nombre, descripción, activo) / **Crear** / **Editar** / **Eliminar**.
- [X] **Error**: desactivar un tipo con organismos activos → **4066 / 409**.

### Organismos — nav **Organismos** (`/api/organism`)
- [X] **Listar**: nombre, acrónimo, tipo (nombre resuelto), activo.
- [X] **Crear**: Nombre, Acrónimo, **Tipo** (requerido), Organismo padre (opcional), Localidad base (opcional), Activo → 201.
- [X] **Editar / Eliminar**.
- [X] **Errores de jerarquía**:
  - Acrónimo duplicado → **4069**.
  - Self-parent → **4070** (el select excluye el propio en edición; probar por API).
  - Padre descendiente (ciclo) → **4068**.
  - Eliminar con hijos activos → **4067**.
  - Tipo/padre inactivo → **4071**.
- [ ] *Se quitaron `sitioWeb` y `logoUrl` del form.*

---

## 5) Storage dejó de ser público (`/api/storage/**`)
- [ ] Sin consumidor de UI hoy → nada que probar en pantalla. Registrado para cuando se agregue descarga de archivos.

---

## Notas para el reporte
- **Códigos de error**: el backend manda el texto en `message`/`details`; el front lo muestra en el diálogo.
  Verificar el texto correcto por código (4061/4062/4065/4066/4067/4068/4069/4070/4071/4072).
- **Verificado por curl** (backend real, token SUPERADMIN): `POST` de modality, category, recipient y life-event → **201**.

---
*(Ronda posterior `ea65b92 → 0ecd14e`: catálogo Recipients/Destinatarios + LifeEvent request pasó a solo `name`. Ver reporte aparte.)*
