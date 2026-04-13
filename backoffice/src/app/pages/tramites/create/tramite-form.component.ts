import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, tap, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { TramiteService } from '../../../core/services/tramite.service';
import { OrganismoService } from '../../../core/services/organismo.service';
import { LocalidadService } from '../../../core/services/localidad.service';
import { EventoDeVidaService } from '../../../core/services/evento-de-vida.service';
import { Tramite } from '../../../core/models/tramite.model';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { UserRole } from '../../../core/enums/user-role.enum';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-tramite-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './tramite-form.component.html'
})
export class TramiteFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  config: FormConfig = getFormConfig('TRAMITE');
  isEdit = false;
  saving = false;
  isSuperAdmin = false;
  tramite: Tramite | null = null;
  initialData: any = null;

  constructor(
    private tramiteService: TramiteService,
    private organismoService: OrganismoService,
    private localidadService: LocalidadService,
    private eventoDeVidaService: EventoDeVidaService,
    private authTokenService: AuthTokenService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.isSuperAdmin = this.authTokenService.getUserRole() === UserRole.SUPERADMIN;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    const catalogues$ = this.loadCatalogues();

    if (id) {
      this.isEdit = true;
      forkJoin([catalogues$, this.tramiteService.getById(id)]).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: ([_, tramite]) => {
          this.tramite = tramite;
          this.initialData = {
            titulo: tramite.titulo,
            resumen: tramite.resumen,
            descripcionLarga: tramite.descripcionLarga,
            urlOficial: tramite.urlOficial,
            organismoId: tramite.organismoId,
            modalidadId: tramite.modalidadId,
            etiquetaIds: tramite.etiquetas.map(e => e.id),
            localidadIds: (tramite.localidades ?? []).map(l => l.id),
            eventoDeVidaIds: (tramite.eventosDeVida ?? []).map(e => e.id),
            destacado: tramite.destacado,
          };
        },
      });
    } else {
      catalogues$.pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe();

      if (!this.isSuperAdmin) {
        const organismoId = this.authTokenService.getUserOrganismoId();
        if (organismoId) {
          this.initialData = { organismoId };
        }
      }
    }
  }

  private loadCatalogues(): Observable<void> {
    const sources: Observable<any>[] = [
      this.tramiteService.getModalidades().pipe(
        tap(data => {
          this.config = updateFormConfigOptions(this.config, 'modalidadId',
            data.map(m => ({ id: m.id, name: m.nombre })));
        })
      ),
      this.tramiteService.getEtiquetas().pipe(
        tap(data => {
          this.config = updateFormConfigOptions(this.config, 'etiquetaIds',
            data.map(e => ({ id: e.id, name: e.nombre })));
        })
      ),
      this.localidadService.getAll().pipe(
        tap(response => {
          this.config = updateFormConfigOptions(this.config, 'localidadIds',
            response.data.map(l => ({ id: l.id, name: `${l.nombre} (${l.departamento})` })));
        })
      ),
      this.eventoDeVidaService.getAll().pipe(
        tap(response => {
          this.config = updateFormConfigOptions(this.config, 'eventoDeVidaIds',
            response.data.map(e => ({ id: e.id, name: e.nombre })));
        })
      ),
    ];

    if (this.isSuperAdmin) {
      sources.push(
        this.organismoService.getAll().pipe(
          tap(response => {
            this.config = updateFormConfigOptions(this.config, 'organismoId',
              response.data.map(o => ({ id: o.id, name: o.nombre })));
          })
        )
      );
    }

    return forkJoin(sources).pipe(map(() => void 0));
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.tramiteService.update(this.tramite!.id, data)
      : this.tramiteService.create(data);

    request$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Trámite actualizado' : 'Trámite creado',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/dashboard/tramites/lista']);
      },
      error: () => { this.saving = false; },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/tramites/lista']);
  }
}
