import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from '../shared/layouts/admin-layout/admin-layout.component';
import { accessGuard, unsavedChangesGuard } from '../core/guards';
import {
  CREAR_ETIQUETA_ACCESS, CREAR_FICHA_ACCESS, EDITAR_USUARIO_ACCESS, ESCRIBIR_ROLES_PERMISOS_ACCESS, LEER_ROLES_PERMISOS_ACCESS,
} from '../core/constants/policy-overrides.constants';
import { UserRole } from '../core/enums/user-role.enum';

const HOME = '/dashboard/home';

// Roles canónicos, solo para las secciones que el backend sigue autorizando por ROL (escape):
// `/api/role` y `/api/permission` (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE, §4.4/§4.5) y las secciones
// sin backend real (Auditoría, Feedback). El resto va por permiso, igual que el nav.
const SUPER = [UserRole.SUPERADMIN];
const SUPER_AB = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE];
const SUPER_AB_AO = [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION];

/**
 * Autorización de ruta vía `accessGuard` + `data.access` (AccessRule). Se gatea por **permiso** para
 * espejar el `@PreAuthorize hasAuthority(...)` del backend (§4.1/§5); las excepciones que el backend
 * autoriza por rol (Roles/Permisos) y las sin backend (Auditoría/Feedback) usan `requireRoles`. La
 * MISMA regla filtra el nav → nav y ruta nunca se desalinean. Usuarios: listar es lectura (READ_USER);
 * crear/editar exigen además lo que el form necesita leer (`READ_ORGANISM` + rol admin) — ver
 * `PERMISSION_PREREQUISITES` / `EDITAR_USUARIO_ACCESS` en `policy-overrides.constants.ts`.
 */
// Cada pantalla es su propio chunk (`loadComponent`): entrar a una sección no descarga las otras 44.
// Solo el layout queda en el chunk del módulo, porque envuelve a todas.
const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'home', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) }, // Home sin trail: el breadcrumb queda solo "Inicio".

      // Rutas del Trámites viejo (mock, retirado en la fase 5): quien las tenga guardadas cae en Plantillas
      // provinciales (si no tiene READ_PROCEDURE, el accessGuard de esa ruta lo manda a home).
      { path: 'tramites', redirectTo: 'tramites/plantillas', pathMatch: 'full' },
      { path: 'tramites/lista', redirectTo: 'tramites/plantillas' },
      { path: 'tramites/nuevo', redirectTo: 'tramites/plantillas' },
      { path: 'tramites/editar/:id', redirectTo: 'tramites/plantillas' },
      { path: 'tramites/detalle/:id', redirectTo: 'tramites/plantillas' },

      // Plantillas provinciales (`/api/procedure-template`, real). Alcance global; permisos `*_PROCEDURE`.
      { path: 'tramites/plantillas', loadComponent: () => import('./tramites/plantillas/list/plantillas-list.component').then(m => m.PlantillasListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_PROCEDURE'] }, redirectTo: HOME, breadcrumb: ['Plantillas provinciales'] } },
      { path: 'tramites/plantillas/nueva', loadComponent: () => import('./tramites/plantillas/form/plantilla-form.component').then(m => m.PlantillaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_PROCEDURE'] }, redirectTo: HOME, breadcrumb: ['Plantillas provinciales', 'Nueva plantilla'] } },
      { path: 'tramites/plantillas/editar/:id', loadComponent: () => import('./tramites/plantillas/form/plantilla-form.component').then(m => m.PlantillaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_PROCEDURE'] }, redirectTo: HOME, breadcrumb: ['Plantillas provinciales', 'Editar plantilla'] } },
      { path: 'tramites/plantillas/detalle/:id', loadComponent: () => import('./tramites/plantillas/detail/plantilla-detail.component').then(m => m.PlantillaDetailComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_PROCEDURE'] }, redirectTo: HOME, breadcrumb: ['Plantillas provinciales', 'Detalle'] } },

      // Trámites del organismo = adopciones (`/api/organism-procedure`). Alcance por organismo en el backend;
      // permisos `*_ADOPTION`. "Adoptar" es un diálogo del listado (ADOPTAR_ACCESS); la edición de vigencia
      // vive en el detalle (con aviso de cambios sin guardar).
      { path: 'tramites/adopciones', loadComponent: () => import('./tramites/adopciones/list/adopciones-list.component').then(m => m.AdopcionesListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_ADOPTION'] }, redirectTo: HOME, breadcrumb: ['Trámites del organismo'] } },
      { path: 'tramites/adopciones/detalle/:id', loadComponent: () => import('./tramites/adopciones/detail/adopcion-detail.component').then(m => m.AdopcionDetailComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['READ_ADOPTION'] }, redirectTo: HOME, breadcrumb: ['Trámites del organismo', 'Detalle'] } },

      // Fichas por localidad (`/api/organism-procedure-location`, en MOCK hasta G-1). Alcance por organismo en el
      // backend; permisos `*_VARIANT` y `PUBLISH_VARIANT` (workflow, en el detalle y en la tab "En revisión").
      // El alta cuelga de una adopción (`?adopcion=`): CREAR_FICHA_ACCESS = CREATE_VARIANT + READ_ADOPTION.
      { path: 'tramites/fichas', loadComponent: () => import('./tramites/fichas/list/fichas-list.component').then(m => m.FichasListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Fichas por localidad'] } },
      { path: 'tramites/fichas/nueva', loadComponent: () => import('./tramites/fichas/form/ficha-form.component').then(m => m.FichaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: CREAR_FICHA_ACCESS, redirectTo: HOME, breadcrumb: ['Fichas por localidad', 'Agregar localidad'] } },
      { path: 'tramites/fichas/editar/:id', loadComponent: () => import('./tramites/fichas/form/ficha-form.component').then(m => m.FichaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Fichas por localidad', 'Editar ficha'] } },
      { path: 'tramites/fichas/detalle/:id', loadComponent: () => import('./tramites/fichas/detail/ficha-detail.component').then(m => m.FichaDetailComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Fichas por localidad', 'Detalle'] } },

      // Organismos + Tipos de Organismo → permiso (de facto solo SUPERADMIN: es el único con esos permisos en el seed)
      { path: 'organismos/lista', loadComponent: () => import('./organismos/list/organismos-list.component').then(m => m.OrganismosListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos'] } },
      { path: 'organismos/detalle/:id', loadComponent: () => import('./organismos/detail/organismo-detail.component').then(m => m.OrganismoDetailComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Detalle'] } },
      { path: 'organismos/nuevo', loadComponent: () => import('./organismos/create/organismo-form.component').then(m => m.OrganismoFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Nuevo organismo'] } },
      // Detalle y edición son la misma pantalla en dos modos (comparten membrete y pestañas).
      { path: 'organismos/editar/:id', loadComponent: () => import('./organismos/detail/organismo-detail.component').then(m => m.OrganismoDetailComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { modo: 'editar', access: { permissions: ['UPDATE_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Editar'] } },
      { path: 'tipos-organismo/lista', loadComponent: () => import('./tipos-organismo/list/tipos-organismo-list.component').then(m => m.TiposOrganismoListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo'] } },
      { path: 'tipos-organismo/nuevo', loadComponent: () => import('./tipos-organismo/create/tipo-organismo-form.component').then(m => m.TipoOrganismoFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo', 'Nuevo tipo'] } },
      { path: 'tipos-organismo/editar/:id', loadComponent: () => import('./tipos-organismo/create/tipo-organismo-form.component').then(m => m.TipoOrganismoFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo', 'Editar tipo'] } },

      // Auditoría → sin backend real → escape por rol
      { path: 'auditoria', loadComponent: () => import('./auditoria/auditoria-list.component').then(m => m.AuditoriaListComponent), canActivate: [accessGuard], data: { access: { requireRoles: SUPER }, redirectTo: HOME, breadcrumb: ['Auditoría'] } },

      // Taxonomía → escrituras por permiso del catálogo (reads públicos; lista visible si tiene alguna escritura)
      { path: 'modalidades/lista', loadComponent: () => import('./modalidades/list/modalidades-list.component').then(m => m.ModalidadesListComponent), canActivate: [accessGuard], data: { access: { permissions: ['CREATE_MODALITY', 'UPDATE_MODALITY', 'DELETE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades'] } },
      { path: 'modalidades/nuevo', loadComponent: () => import('./modalidades/create/modalidad-form.component').then(m => m.ModalidadFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades', 'Nueva modalidad'] } },
      { path: 'modalidades/editar/:id', loadComponent: () => import('./modalidades/create/modalidad-form.component').then(m => m.ModalidadFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades', 'Editar modalidad'] } },
      // Etiquetas: sin controller en backend (mock) → permiso genérico de taxonomía como aproximación.
      { path: 'etiquetas/lista', loadComponent: () => import('./etiquetas/list/etiquetas-list.component').then(m => m.EtiquetasListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_TAG'] }, redirectTo: HOME, breadcrumb: ['Etiquetas'] } },
      { path: 'etiquetas/nuevo', loadComponent: () => import('./etiquetas/create/etiqueta-form.component').then(m => m.EtiquetaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: CREAR_ETIQUETA_ACCESS, redirectTo: HOME, breadcrumb: ['Etiquetas', 'Nueva etiqueta'] } },
      { path: 'etiquetas/editar/:id', loadComponent: () => import('./etiquetas/create/etiqueta-form.component').then(m => m.EtiquetaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_TAG'] }, redirectTo: HOME, breadcrumb: ['Etiquetas', 'Editar etiqueta'] } },
      { path: 'categorias/lista', loadComponent: () => import('./categorias/list/categorias-list.component').then(m => m.CategoriasListComponent), canActivate: [accessGuard], data: { access: { permissions: ['CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías'] } },
      { path: 'categorias/nuevo', loadComponent: () => import('./categorias/create/categoria-form.component').then(m => m.CategoriaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías', 'Nueva categoría'] } },
      { path: 'categorias/editar/:id', loadComponent: () => import('./categorias/create/categoria-form.component').then(m => m.CategoriaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías', 'Editar categoría'] } },
      { path: 'destinatarios/lista', loadComponent: () => import('./destinatarios/list/destinatarios-list.component').then(m => m.DestinatariosListComponent), canActivate: [accessGuard], data: { access: { permissions: ['CREATE_RECIPIENT', 'UPDATE_RECIPIENT', 'DELETE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios'] } },
      { path: 'destinatarios/nuevo', loadComponent: () => import('./destinatarios/create/destinatario-form.component').then(m => m.DestinatarioFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios', 'Nuevo destinatario'] } },
      { path: 'destinatarios/editar/:id', loadComponent: () => import('./destinatarios/create/destinatario-form.component').then(m => m.DestinatarioFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios', 'Editar destinatario'] } },
      { path: 'eventos-de-vida/lista', loadComponent: () => import('./eventos-de-vida/list/eventos-de-vida-list.component').then(m => m.EventosDeVidaListComponent), canActivate: [accessGuard], data: { access: { permissions: ['CREATE_LIFE_EVENT', 'UPDATE_LIFE_EVENT', 'DELETE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida'] } },
      { path: 'eventos-de-vida/nuevo', loadComponent: () => import('./eventos-de-vida/create/evento-de-vida-form.component').then(m => m.EventoDeVidaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida', 'Nuevo evento'] } },
      { path: 'eventos-de-vida/editar/:id', loadComponent: () => import('./eventos-de-vida/create/evento-de-vida-form.component').then(m => m.EventoDeVidaFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida', 'Editar evento'] } },

      // Feedback Ciudadano → sin backend real → escape por rol
      { path: 'feedback', loadComponent: () => import('./feedback/feedback.component').then(m => m.FeedbackComponent), canActivate: [accessGuard], data: { access: { requireRoles: SUPER_AB_AO }, redirectTo: HOME, breadcrumb: ['Feedback Ciudadano'] } },

      // Usuarios: listar = READ_USER (SA/AB/AO). Crear = CREATE_USER + prerrequisitos del form; editar =
      // EDITAR_USUARIO_ACCESS (UPDATE_USER + READ_ORGANISM + rol admin). Ver policy-overrides.constants.ts.
      { path: 'usuarios/lista', loadComponent: () => import('./usuarios/list/usuarios-list.component').then(m => m.UsuariosListComponent), canActivate: [accessGuard], data: { access: { permissions: ['READ_USER'] }, redirectTo: HOME, breadcrumb: ['Usuarios'] } },
      { path: 'usuarios/nuevo', loadComponent: () => import('./usuarios/create/usuario-form.component').then(m => m.UsuarioFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_USER'] }, redirectTo: HOME, breadcrumb: ['Usuarios', 'Nuevo usuario'] } },
      { path: 'usuarios/editar/:id', loadComponent: () => import('./usuarios/create/usuario-form.component').then(m => m.UsuarioFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: EDITAR_USUARIO_ACCESS, redirectTo: HOME, breadcrumb: ['Usuarios', 'Editar usuario'] } },

      // Roles y Permisos → backend autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE, §4.4/§4.5)
      { path: 'roles/lista', loadComponent: () => import('./roles/list/roles-list.component').then(m => m.RolesListComponent), canActivate: [accessGuard], data: { access: LEER_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles'] } },
      { path: 'roles/nuevo', loadComponent: () => import('./roles/create/role-form.component').then(m => m.RoleFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles', 'Nuevo rol'] } },
      { path: 'roles/editar/:id', loadComponent: () => import('./roles/create/role-form.component').then(m => m.RoleFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles', 'Editar rol'] } },
      { path: 'permisos/lista', loadComponent: () => import('./permisos/list/permisos-list.component').then(m => m.PermisosListComponent), canActivate: [accessGuard], data: { access: LEER_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos'] } },
      { path: 'permisos/nuevo', loadComponent: () => import('./permisos/create/permiso-form.component').then(m => m.PermisoFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos', 'Nuevo permiso'] } },
      { path: 'permisos/editar/:id', loadComponent: () => import('./permisos/create/permiso-form.component').then(m => m.PermisoFormComponent), canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos', 'Editar permiso'] } },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
      // Cualquier /dashboard/* sin match (rutas "bare" tipo /organismos, typos, secciones aún sin
      // pantalla) → home. Evita caer al `**` global que manda a /auth/login estando ya logueado.
      { path: '**', redirectTo: 'home' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PagesModule {}
