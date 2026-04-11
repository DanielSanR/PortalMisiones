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

      // Usuarios (superadmin + admin_organismo)
      {
        path: 'usuarios/lista',
        component: UsuariosListComponent,
        canActivate: [roleGuard],
        data: {
          allowedRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_ORGANISMO],
          redirectTo: '/dashboard/home',
        },
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PagesModule {}
