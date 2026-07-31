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

// Roles canónicos, solo para las secciones que el backend sigue autorizando por ROL (escape).
const SUPER = [UserRole.SUPERADMIN];
const SUPER_AB = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE];
const SUPER_AB_AO = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard/home' }, // todo autenticado
  // Trámites/Variantes (backend aún bloqueado; gating provisional por los permisos que aplicarán).
  { label: 'Trámites', icon: 'description', route: '/dashboard/tramites/lista', rule: { permissions: ['READ_PROCEDURE', 'READ_VARIANT'] } },
  // Organismos y Tipos: de facto solo SUPERADMIN (solo él tiene READ_ORGANISM/READ_ORGANISM_TYPE en el seed).
  { label: 'Organismos', icon: 'business', route: '/dashboard/organismos/lista', rule: { permissions: ['READ_ORGANISM'] } },
  { label: 'Tipos de Organismo', icon: 'category', route: '/dashboard/tipos-organismo/lista', rule: { permissions: ['READ_ORGANISM_TYPE'] } },
  // Taxonomía: sin permiso READ (GET públicos) → visible si tiene alguna escritura del catálogo.
  { label: 'Categorías', icon: 'account_tree', route: '/dashboard/categorias/lista', rule: { permissions: ['CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY'] } },
  // Etiquetas: sin controller en backend (mock); se aproxima con el permiso genérico de taxonomía.
  { label: 'Etiquetas', icon: 'label', route: '/dashboard/etiquetas/lista', rule: { permissions: ['CREATE_TAXONOMY', 'UPDATE_TAXONOMY', 'DELETE_TAXONOMY'] } },
  { label: 'Modalidades', icon: 'tune', route: '/dashboard/modalidades/lista', rule: { permissions: ['CREATE_MODALITY', 'UPDATE_MODALITY', 'DELETE_MODALITY'] } },
  // Usuarios: lista en lectura para quien tenga READ_USER (SA/AB/AO); gestión = SUPERADMIN (policy override).
  { label: 'Usuarios', icon: 'people', route: '/dashboard/usuarios/lista', rule: { permissions: ['READ_USER'] } },
  { label: 'Eventos de Vida', icon: 'event_note', route: '/dashboard/eventos-de-vida/lista', rule: { permissions: ['CREATE_LIFE_EVENT', 'UPDATE_LIFE_EVENT', 'DELETE_LIFE_EVENT'] } },
  { label: 'Destinatarios', icon: 'diversity_3', route: '/dashboard/destinatarios/lista', rule: { permissions: ['CREATE_RECIPIENT', 'UPDATE_RECIPIENT', 'DELETE_RECIPIENT'] } },
  // Feedback: sin backend real → escape por rol.
  { label: 'Feedback Ciudadano', icon: 'forum', route: '/dashboard/feedback', rule: { requireRoles: SUPER_AB_AO } },
  // Roles y Permisos: el backend los autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE) → escape.
  { label: 'Roles', icon: 'admin_panel_settings', route: '/dashboard/roles/lista', rule: { requireRoles: SUPER_AB } },
  { label: 'Permisos', icon: 'key', route: '/dashboard/permisos/lista', rule: { requireRoles: SUPER_AB } },
  // Auditoría: sin backend real → escape por rol.
  { label: 'Auditoría', icon: 'history', route: '/dashboard/auditoria', rule: { requireRoles: SUPER } },
  // NOTA: "Reportes" se quitó del nav porque todavía no existe la pantalla/ruta (era un link muerto).
  // Vuelve cuando se implemente `/dashboard/reportes` (gatear por `{ permissions: ['VIEW_ANALYTICS'] }`).
];
