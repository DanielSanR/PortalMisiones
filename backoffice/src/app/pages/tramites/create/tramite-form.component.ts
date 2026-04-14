import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, tap, map } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { TramiteService } from '../../../core/services/tramite.service';
import { OrganismoService } from '../../../core/services/organismo.service';
import { LocalidadService } from '../../../core/services/localidad.service';
import { EventoDeVidaService } from '../../../core/services/evento-de-vida.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { DestinatarioService } from '../../../core/services/destinatario.service';
import { Tramite, TramiteContenidoLocalidad, Localidad } from '../../../core/models/tramite.model';
import { AuthTokenService } from '../../../core/services/auth-token.service';
import { UserRole } from '../../../core/enums/user-role.enum';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-tramite-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSnackBarModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './tramite-form.component.html',
  styleUrls: ['./tramite-form.component.scss'],
})
export class TramiteFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  config: FormConfig = getFormConfig('TRAMITE');
  isEdit = false;
  saving = false;
  isSuperAdmin = false;
  tramite: Tramite | null = null;
  initialData: any = null;

  // ── Contenido por localidad ──────────────────────────
  contenidoLocalidades: TramiteContenidoLocalidad[] = [];
  localidadesDisponibles: Localidad[] = [];
  editingLocalidad: TramiteContenidoLocalidad | null = null;
  addingLocalidad = false;
  newLocalidad = { localidadId: null as number | null, costos: '', contacto: '', sitioWeb: '', urlTramite: '', horarios: '', notas: '' };

  constructor(
    private tramiteService: TramiteService,
    private organismoService: OrganismoService,
    private localidadService: LocalidadService,
    private eventoDeVidaService: EventoDeVidaService,
    private categoriaService: CategoriaService,
    private destinatarioService: DestinatarioService,
    private authTokenService: AuthTokenService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
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
          this.loadContenidoLocalidades();
          this.initialData = {
            titulo: tramite.titulo,
            resumen: tramite.resumen,
            descripcionLarga: tramite.descripcionLarga,
            requisitos: tramite.requisitos,
            costos: tramite.costos,
            formularios: tramite.formularios,
            contacto: tramite.contacto,
            sitioWebTramite: tramite.sitioWebTramite,
            urlOficial: tramite.urlOficial,
            organismoId: tramite.organismoId,
            modalidadId: tramite.modalidadId,
            categoriaIds: (tramite.categorias ?? []).map(c => c.id),
            etiquetaIds: tramite.etiquetas.map(e => e.id),
            destinatarioIds: (tramite.destinatarios ?? []).map(d => d.id),
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
      this.categoriaService.getAll().pipe(
        tap(response => {
          // Aplanar el árbol: mostrar sub-categorías con prefijo del padre
          const options: { id: any; name: string }[] = [];
          response.data.forEach(parent => {
            if (parent.children?.length) {
              parent.children.forEach(child => {
                options.push({ id: child.id, name: `${parent.nombre} > ${child.nombre}` });
              });
            }
          });
          this.config = updateFormConfigOptions(this.config, 'categoriaIds', options);
        })
      ),
      this.destinatarioService.getAll().pipe(
        tap(data => {
          this.config = updateFormConfigOptions(this.config, 'destinatarioIds',
            data.map(d => ({ id: d.id, name: d.nombre })));
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

  // ── Contenido por localidad — metodos ────────────────

  loadContenidoLocalidades(): void {
    if (!this.tramite) return;
    this.tramiteService.getContenidoLocalidades(this.tramite.id).subscribe({
      next: (data) => { this.contenidoLocalidades = data; },
    });
    this.localidadService.getAll().subscribe({
      next: (response) => { this.localidadesDisponibles = response.data; },
    });
  }

  get localidadesSinContenido(): Localidad[] {
    const usadas = new Set(this.contenidoLocalidades.map(c => c.localidadId));
    return this.localidadesDisponibles.filter(l => !usadas.has(l.id));
  }

  startAddLocalidad(): void {
    this.addingLocalidad = true;
    this.newLocalidad = { localidadId: null, costos: '', contacto: '', sitioWeb: '', urlTramite: '', horarios: '', notas: '' };
  }

  cancelAddLocalidad(): void {
    this.addingLocalidad = false;
  }

  saveNewLocalidad(): void {
    if (!this.tramite || !this.newLocalidad.localidadId) return;
    this.tramiteService.addContenidoLocalidad(this.tramite.id, {
      localidadId: this.newLocalidad.localidadId,
      costos: this.newLocalidad.costos || undefined,
      contacto: this.newLocalidad.contacto || undefined,
      sitioWeb: this.newLocalidad.sitioWeb || undefined,
      urlTramite: this.newLocalidad.urlTramite || undefined,
      horarios: this.newLocalidad.horarios || undefined,
      notas: this.newLocalidad.notas || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Localidad agregada', 'OK', { duration: 3000 });
        this.addingLocalidad = false;
        this.loadContenidoLocalidades();
      },
    });
  }

  startEditLocalidad(item: TramiteContenidoLocalidad): void {
    this.editingLocalidad = { ...item };
  }

  cancelEditLocalidad(): void {
    this.editingLocalidad = null;
  }

  saveEditLocalidad(): void {
    if (!this.tramite || !this.editingLocalidad) return;
    this.tramiteService.updateContenidoLocalidad(this.tramite.id, this.editingLocalidad.localidadId, {
      costos: this.editingLocalidad.costos || undefined,
      contacto: this.editingLocalidad.contacto || undefined,
      sitioWeb: this.editingLocalidad.sitioWeb || undefined,
      urlTramite: this.editingLocalidad.urlTramite || undefined,
      horarios: this.editingLocalidad.horarios || undefined,
      notas: this.editingLocalidad.notas || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Localidad actualizada', 'OK', { duration: 3000 });
        this.editingLocalidad = null;
        this.loadContenidoLocalidades();
      },
    });
  }

  deleteLocalidad(item: TramiteContenidoLocalidad): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar contenido de localidad',
        message: `¿Eliminar el contenido específico de "${item.localidadNombre}"? El trámite usará los valores provinciales por defecto.`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed && this.tramite) {
        this.tramiteService.removeContenidoLocalidad(this.tramite.id, item.localidadId).subscribe({
          next: () => {
            this.snackBar.open('Contenido de localidad eliminado', 'OK', { duration: 3000 });
            this.loadContenidoLocalidades();
          },
        });
      }
    });
  }
}
