import { UserRole } from '../enums/user-role.enum';
import { AccessRule } from '../models/access-rule.model';

/**
 * Ítem de nav. La visibilidad se decide por `rule` (`AccessRule`), evaluada con `evaluateAccess` — la
 * MISMA función que usan los guards, para que nav y ruta nunca se desalineen.
 *
 * El backend autoriza casi todo por **PERMISO** (`@PreAuthorize hasAuthority('<código>')`, §4.1/§5), por
 * eso el gating primario es por `permissions` (espeja el permiso que exige cada endpoint del módulo).
 * Excepciones que siguen por ROL en el backend → `requireRoles`: `/api/role` y `/api/permission`
 * (`hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)`, §4.4/§4.5) y las secciones sin backend real
 * (Auditoría, Feedback). Sin `rule` = visible para cualquier autenticado.
 */
export interface NavItem {
  label: string;
  icon: string;
  route: string;
  rule?: AccessRule;
  children?: NavItem[];
}

/** Grupo colapsable de la sidebar (ver `screens-spec.md` §3.1: Contenidos / Administración / Análisis). */
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Roles canónicos, solo para las secciones que el backend sigue autorizando por ROL (escape).
const SUPER = [UserRole.SUPERADMIN];
const SUPER_AB = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE];
const SUPER_AB_AO = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION];

/**
 * Nav agrupado en secciones colapsables (diseño Claude Design, `screens-spec.md` §2/§3.1). La
 * visibilidad de cada ítem sigue decidiéndose por `rule` (`evaluateAccess`, sin cambios); un grupo
 * sin ítems visibles para el usuario actual simplemente no se muestra (`AdminLayoutComponent`).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Contenidos',
    items: [
      { label: 'Inicio', icon: 'layout', route: '/dashboard/home' }, // todo autenticado
      // Trámites/Variantes (backend aún bloqueado; gating provisional por los permisos que aplicarán).
      { label: 'Trámites', icon: 'file-text', route: '/dashboard/tramites/lista', rule: { permissions: ['READ_PROCEDURE', 'READ_VARIANT'] } },
      // Organismos y Tipos: de facto solo SUPERADMIN (solo él tiene READ_ORGANISM/READ_ORGANISM_TYPE en el seed).
      { label: 'Organismos', icon: 'buildings', route: '/dashboard/organismos/lista', rule: { permissions: ['READ_ORGANISM'] } },
      { label: 'Tipos de Organismo', icon: 'path', route: '/dashboard/tipos-organismo/lista', rule: { permissions: ['READ_ORGANISM_TYPE'] } },
      // Taxonomía: sin permiso READ (GET públicos) → visible si tiene alguna escritura del catálogo.
      { label: 'Categorías', icon: 'folders', route: '/dashboard/categorias/lista', rule: { permissions: ['CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY'] } },
      // Etiquetas: sin controller en backend (mock); se aproxima con el permiso genérico de taxonomía.
      { label: 'Etiquetas', icon: 'tag', route: '/dashboard/etiquetas/lista', rule: { permissions: ['READ_TAG'] } },
      { label: 'Modalidades', icon: 'sliders-horizontal', route: '/dashboard/modalidades/lista', rule: { permissions: ['CREATE_MODALITY', 'UPDATE_MODALITY', 'DELETE_MODALITY'] } },
      { label: 'Eventos de Vida', icon: 'bookmarks-simple', route: '/dashboard/eventos-de-vida/lista', rule: { permissions: ['CREATE_LIFE_EVENT', 'UPDATE_LIFE_EVENT', 'DELETE_LIFE_EVENT'] } },
      { label: 'Destinatarios', icon: 'user-focus', route: '/dashboard/destinatarios/lista', rule: { permissions: ['CREATE_RECIPIENT', 'UPDATE_RECIPIENT', 'DELETE_RECIPIENT'] } },
    ],
  },
  {
    // Trámites contra la API real (PLAN_TRAMITES_API.md §4.1, decisión P-1). Se suman "Trámites del
    // organismo" (READ_ADOPTION) y "Fichas por localidad" (READ_VARIANT) en sus fases. El ítem viejo
    // "Trámites" (mock) sigue en Contenidos hasta la fase 5.
    label: 'Trámites',
    items: [
      { label: 'Plantillas provinciales', icon: 'files', route: '/dashboard/tramites/plantillas', rule: { permissions: ['READ_PROCEDURE'] } },
    ],
  },
  {
    label: 'Administración',
    items: [
      // Usuarios: lista en lectura para quien tenga READ_USER (SA/AB/AO); gestión = SUPERADMIN (policy override).
      { label: 'Usuarios', icon: 'users', route: '/dashboard/usuarios/lista', rule: { permissions: ['READ_USER'] } },
      // Roles y Permisos: el backend los autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE) → escape.
      { label: 'Roles', icon: 'shield-star', route: '/dashboard/roles/lista', rule: { requireRoles: SUPER_AB } },
      { label: 'Permisos', icon: 'key', route: '/dashboard/permisos/lista', rule: { requireRoles: SUPER_AB } },
      // Auditoría: sin backend real → escape por rol.
      { label: 'Auditoría', icon: 'clock-counter-clockwise', route: '/dashboard/auditoria', rule: { requireRoles: SUPER } },
    ],
  },
  {
    label: 'Análisis',
    items: [
      // Feedback: sin backend real → escape por rol.
      { label: 'Feedback Ciudadano', icon: 'chats-circle', route: '/dashboard/feedback', rule: { requireRoles: SUPER_AB_AO } },
      // NOTA: "Reportes" se quitó del nav porque todavía no existe la pantalla/ruta (era un link muerto).
      // Vuelve cuando se implemente `/dashboard/reportes` (gatear por `{ permissions: ['VIEW_ANALYTICS'] }`).
    ],
  },
];

/** Vista plana de `NAV_GROUPS`, para lo que necesite el set completo de ítems (ej. matching de breadcrumb). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
