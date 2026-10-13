import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from '../shared/layouts/admin-layout/admin-layout.component';
import { accessGuard, unsavedChangesGuard } from '../core/guards';
import {
  EDITAR_USUARIO_ACCESS, ESCRIBIR_ROLES_PERMISOS_ACCESS, LEER_ROLES_PERMISOS_ACCESS,
} from '../core/constants/policy-overrides.constants';
import { UserRole } from '../core/enums/user-role.enum';

import { DashboardComponent } from './dashboard/dashboard.component';
import { TramitesListComponent } from './tramites/list/tramites-list.component';
import { TramiteFormComponent } from './tramites/create/tramite-form.component';
import { TramiteDetailComponent } from './tramites/detail/tramite-detail.component';
import { OrganismosListComponent } from './organismos/list/organismos-list.component';
import { OrganismoFormComponent } from './organismos/create/organismo-form.component';
import { OrganismoDetailComponent } from './organismos/detail/organismo-detail.component';
import { TiposOrganismoListComponent } from './tipos-organismo/list/tipos-organismo-list.component';
import { TipoOrganismoFormComponent } from './tipos-organismo/create/tipo-organismo-form.component';
import { UsuariosListComponent } from './usuarios/list/usuarios-list.component';
import { EtiquetasListComponent } from './etiquetas/list/etiquetas-list.component';
import { EtiquetaFormComponent } from './etiquetas/create/etiqueta-form.component';
import { ModalidadesListComponent } from './modalidades/list/modalidades-list.component';
import { ModalidadFormComponent } from './modalidades/create/modalidad-form.component';
import { AuditoriaListComponent } from './auditoria/auditoria-list.component';
import { EventosDeVidaListComponent } from './eventos-de-vida/list/eventos-de-vida-list.component';
import { EventoDeVidaFormComponent } from './eventos-de-vida/create/evento-de-vida-form.component';
import { FeedbackComponent } from './feedback/feedback.component';
import { UsuarioFormComponent } from './usuarios/create/usuario-form.component';
import { CategoriasListComponent } from './categorias/list/categorias-list.component';
import { CategoriaFormComponent } from './categorias/create/categoria-form.component';
import { DestinatariosListComponent } from './destinatarios/list/destinatarios-list.component';
import { DestinatarioFormComponent } from './destinatarios/create/destinatario-form.component';
import { RolesListComponent } from './roles/list/roles-list.component';
import { RoleFormComponent } from './roles/create/role-form.component';
import { PermisosListComponent } from './permisos/list/permisos-list.component';
import { PermisoFormComponent } from './permisos/create/permiso-form.component';

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
const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'home', component: DashboardComponent }, // Home sin trail: el breadcrumb queda solo "Inicio".

      // Trámites (backend aún bloqueado; gating provisional por los permisos que aplicarán)
      { path: 'tramites/lista', component: TramitesListComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_PROCEDURE', 'READ_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Trámites'] } },
      { path: 'tramites/nuevo', component: TramiteFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_PROCEDURE', 'CREATE_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Trámites', 'Nuevo trámite'] } },
      { path: 'tramites/editar/:id', component: TramiteFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_PROCEDURE', 'UPDATE_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Trámites', 'Editar trámite'] } },
      { path: 'tramites/detalle/:id', component: TramiteDetailComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_PROCEDURE', 'READ_VARIANT'] }, redirectTo: HOME, breadcrumb: ['Trámites', 'Detalle'] } },

      // Organismos + Tipos de Organismo → permiso (de facto solo SUPERADMIN: es el único con esos permisos en el seed)
      { path: 'organismos/lista', component: OrganismosListComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos'] } },
      { path: 'organismos/detalle/:id', component: OrganismoDetailComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Detalle'] } },
      { path: 'organismos/nuevo', component: OrganismoFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Nuevo organismo'] } },
      // Detalle y edición son la misma pantalla en dos modos (comparten membrete y pestañas).
      { path: 'organismos/editar/:id', component: OrganismoDetailComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { modo: 'editar', access: { permissions: ['UPDATE_ORGANISM'] }, redirectTo: HOME, breadcrumb: ['Organismos', 'Editar'] } },
      { path: 'tipos-organismo/lista', component: TiposOrganismoListComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo'] } },
      { path: 'tipos-organismo/nuevo', component: TipoOrganismoFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo', 'Nuevo tipo'] } },
      { path: 'tipos-organismo/editar/:id', component: TipoOrganismoFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_ORGANISM_TYPE'] }, redirectTo: HOME, breadcrumb: ['Tipos de Organismo', 'Editar tipo'] } },

      // Auditoría → sin backend real → escape por rol
      { path: 'auditoria', component: AuditoriaListComponent, canActivate: [accessGuard], data: { access: { requireRoles: SUPER }, redirectTo: HOME, breadcrumb: ['Auditoría'] } },

      // Taxonomía → escrituras por permiso del catálogo (reads públicos; lista visible si tiene alguna escritura)
      { path: 'modalidades/lista', component: ModalidadesListComponent, canActivate: [accessGuard], data: { access: { permissions: ['CREATE_MODALITY', 'UPDATE_MODALITY', 'DELETE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades'] } },
      { path: 'modalidades/nuevo', component: ModalidadFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades', 'Nueva modalidad'] } },
      { path: 'modalidades/editar/:id', component: ModalidadFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_MODALITY'] }, redirectTo: HOME, breadcrumb: ['Modalidades', 'Editar modalidad'] } },
      // Etiquetas: sin controller en backend (mock) → permiso genérico de taxonomía como aproximación.
      { path: 'etiquetas/lista', component: EtiquetasListComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_TAG'] }, redirectTo: HOME, breadcrumb: ['Etiquetas'] } },
      { path: 'etiquetas/nuevo', component: EtiquetaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_TAG'] }, redirectTo: HOME, breadcrumb: ['Etiquetas', 'Nueva etiqueta'] } },
      { path: 'etiquetas/editar/:id', component: EtiquetaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_TAG'] }, redirectTo: HOME, breadcrumb: ['Etiquetas', 'Editar etiqueta'] } },
      { path: 'categorias/lista', component: CategoriasListComponent, canActivate: [accessGuard], data: { access: { permissions: ['CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías'] } },
      { path: 'categorias/nuevo', component: CategoriaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías', 'Nueva categoría'] } },
      { path: 'categorias/editar/:id', component: CategoriaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_CATEGORY'] }, redirectTo: HOME, breadcrumb: ['Categorías', 'Editar categoría'] } },
      { path: 'destinatarios/lista', component: DestinatariosListComponent, canActivate: [accessGuard], data: { access: { permissions: ['CREATE_RECIPIENT', 'UPDATE_RECIPIENT', 'DELETE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios'] } },
      { path: 'destinatarios/nuevo', component: DestinatarioFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios', 'Nuevo destinatario'] } },
      { path: 'destinatarios/editar/:id', component: DestinatarioFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_RECIPIENT'] }, redirectTo: HOME, breadcrumb: ['Destinatarios', 'Editar destinatario'] } },
      { path: 'eventos-de-vida/lista', component: EventosDeVidaListComponent, canActivate: [accessGuard], data: { access: { permissions: ['CREATE_LIFE_EVENT', 'UPDATE_LIFE_EVENT', 'DELETE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida'] } },
      { path: 'eventos-de-vida/nuevo', component: EventoDeVidaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida', 'Nuevo evento'] } },
      { path: 'eventos-de-vida/editar/:id', component: EventoDeVidaFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['UPDATE_LIFE_EVENT'] }, redirectTo: HOME, breadcrumb: ['Eventos de Vida', 'Editar evento'] } },

      // Feedback Ciudadano → sin backend real → escape por rol
      { path: 'feedback', component: FeedbackComponent, canActivate: [accessGuard], data: { access: { requireRoles: SUPER_AB_AO }, redirectTo: HOME, breadcrumb: ['Feedback Ciudadano'] } },

      // Usuarios: listar = READ_USER (SA/AB/AO). Crear = CREATE_USER + prerrequisitos del form; editar =
      // EDITAR_USUARIO_ACCESS (UPDATE_USER + READ_ORGANISM + rol admin). Ver policy-overrides.constants.ts.
      { path: 'usuarios/lista', component: UsuariosListComponent, canActivate: [accessGuard], data: { access: { permissions: ['READ_USER'] }, redirectTo: HOME, breadcrumb: ['Usuarios'] } },
      { path: 'usuarios/nuevo', component: UsuarioFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: { permissions: ['CREATE_USER'] }, redirectTo: HOME, breadcrumb: ['Usuarios', 'Nuevo usuario'] } },
      { path: 'usuarios/editar/:id', component: UsuarioFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: EDITAR_USUARIO_ACCESS, redirectTo: HOME, breadcrumb: ['Usuarios', 'Editar usuario'] } },

      // Roles y Permisos → backend autoriza por ROL (hasAnyRole SUPERADMIN/ADMIN_BACKOFFICE, §4.4/§4.5)
      { path: 'roles/lista', component: RolesListComponent, canActivate: [accessGuard], data: { access: LEER_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles'] } },
      { path: 'roles/nuevo', component: RoleFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles', 'Nuevo rol'] } },
      { path: 'roles/editar/:id', component: RoleFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Roles', 'Editar rol'] } },
      { path: 'permisos/lista', component: PermisosListComponent, canActivate: [accessGuard], data: { access: LEER_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos'] } },
      { path: 'permisos/nuevo', component: PermisoFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos', 'Nuevo permiso'] } },
      { path: 'permisos/editar/:id', component: PermisoFormComponent, canActivate: [accessGuard], canDeactivate: [unsavedChangesGuard], data: { access: ESCRIBIR_ROLES_PERMISOS_ACCESS, redirectTo: HOME, breadcrumb: ['Permisos', 'Editar permiso'] } },

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
