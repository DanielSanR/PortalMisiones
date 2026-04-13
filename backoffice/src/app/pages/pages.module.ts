import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from '../shared/layouts/admin-layout/admin-layout.component';
import { roleGuard } from '../core/guards';
import { UserRole } from '../core/enums/user-role.enum';

import { DashboardComponent } from './dashboard/dashboard.component';
import { TramitesListComponent } from './tramites/list/tramites-list.component';
import { TramiteFormComponent } from './tramites/create/tramite-form.component';
import { TramiteDetailComponent } from './tramites/detail/tramite-detail.component';
import { OrganismosListComponent } from './organismos/list/organismos-list.component';
import { OrganismoFormComponent } from './organismos/create/organismo-form.component';
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

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'home', component: DashboardComponent },

      // Trámites
      { path: 'tramites/lista', component: TramitesListComponent },
      { path: 'tramites/nuevo', component: TramiteFormComponent },
      { path: 'tramites/editar/:id', component: TramiteFormComponent },
      { path: 'tramites/detalle/:id', component: TramiteDetailComponent },

      // Organismos (solo superadmin)
      {
        path: 'organismos/lista',
        component: OrganismosListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'organismos/nuevo',
        component: OrganismoFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'organismos/editar/:id',
        component: OrganismoFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },

      // Auditoría (solo superadmin)
      {
        path: 'auditoria',
        component: AuditoriaListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },

      // Modalidades (solo superadmin)
      {
        path: 'modalidades/lista',
        component: ModalidadesListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'modalidades/nuevo',
        component: ModalidadFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'modalidades/editar/:id',
        component: ModalidadFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },

      // Etiquetas (solo superadmin)
      {
        path: 'etiquetas/lista',
        component: EtiquetasListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'etiquetas/nuevo',
        component: EtiquetaFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'etiquetas/editar/:id',
        component: EtiquetaFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },

      // Feedback Ciudadano (superadmin + admin_organismo)
      {
        path: 'feedback',
        component: FeedbackComponent,
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO],
          redirectTo: '/dashboard/home',
        },
      },

      // Eventos de Vida (solo superadmin)
      {
        path: 'eventos-de-vida/lista',
        component: EventosDeVidaListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'eventos-de-vida/nuevo',
        component: EventoDeVidaFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },
      {
        path: 'eventos-de-vida/editar/:id',
        component: EventoDeVidaFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN], redirectTo: '/dashboard/home' },
      },

      // Usuarios (superadmin + admin_organismo)
      {
        path: 'usuarios/lista',
        component: UsuariosListComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO], redirectTo: '/dashboard/home' },
      },
      {
        path: 'usuarios/nuevo',
        component: UsuarioFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO], redirectTo: '/dashboard/home' },
      },
      {
        path: 'usuarios/editar/:id',
        component: UsuarioFormComponent,
        canActivate: [roleGuard],
        data: { allowedRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO], redirectTo: '/dashboard/home' },
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PagesModule {}
