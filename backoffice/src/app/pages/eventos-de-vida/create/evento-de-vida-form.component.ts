import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { EventoDeVidaService } from '../../../core/services/evento-de-vida.service';
import { TramiteService } from '../../../core/services/tramite.service';
import { FormConfig } from '../../../core/models/field.interface';

@Component({
  selector: 'app-evento-de-vida-form',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    PageHeaderComponent,
    DynamicFormComponent,
  ],
  templateUrl: './evento-de-vida-form.component.html',
})
export class EventoDeVidaFormComponent implements OnInit {
  config: FormConfig = getFormConfig('EVENTO_DE_VIDA');
  isEdit = false;
  saving = false;
  initialData: any = null;

  private editId: number | null = null;

  constructor(
    private eventoService: EventoDeVidaService,
    private tramiteService: TramiteService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.isEdit = !!id;
    this.editId = id ? Number(id) : null;

    this.tramiteService.getAll({ pageSize: 100 }).subscribe({
      next: (response) => {
        const tramiteOptions = response.data.map(t => ({ id: t.id, name: t.titulo }));
        this.config = updateFormConfigOptions(this.config, 'tramiteIds', tramiteOptions);
      },
    });

    if (this.isEdit && this.editId) {
      this.eventoService.getById(this.editId).subscribe({
        next: (ev) => {
          this.initialData = {
            nombre: ev.nombre,
            descripcion: ev.descripcion,
            icono: ev.icono,
            color: ev.color,
            tramiteIds: (ev.tramites ?? []).map(t => t.id),
          };
        },
      });
    }
  }

  onSubmit(data: any): void {
    this.saving = true;

    const request$ = this.isEdit
      ? this.eventoService.update(this.editId!, data)
      : this.eventoService.create(data);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Evento actualizado' : 'Evento creado',
          'OK',
          { duration: 3000 },
        );
        this.router.navigate(['/dashboard/eventos-de-vida/lista']);
      },
      error: () => { this.saving = false; },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/eventos-de-vida/lista']);
  }
}
