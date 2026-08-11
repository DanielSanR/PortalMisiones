import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { OrganismoDetalleVM, OrganismosFacade } from '@features/organismos';

/** Pestañas del detalle (diseño "Pantallas · Backoffice Misiones", pantalla DETALLE). */
type TabDetalle = 'datos' | 'tramites' | 'responsables' | 'historial';

interface Tab {
  clave: TabDetalle;
  label: string;
  /** Contador del pill. `null` cuando el dato todavía no existe en el backend. */
  contador: number | null;
}

/** Un campo de la ficha. `pendiente` marca los que el backend aún no expone. */
interface CampoFicha {
  label: string;
  valor: string | null;
  pendiente?: boolean;
  /** Se muestra como enlace (correo, sitio web). */
  enlace?: 'mailto' | 'web';
}

@Component({
  selector: 'app-organismo-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    RowActionsComponent,
    HasPermissionDirective,
  ],
  templateUrl: './organismo-detail.component.html',
  styleUrls: ['./organismo-detail.component.scss'],
})
export class OrganismoDetailComponent implements OnInit {
  private readonly facade = inject(OrganismosFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  detalle: OrganismoDetalleVM | null = null;
  loading = true;
  error = false;

  readonly tab$ = new BehaviorSubject<TabDetalle>('datos');

  /**
   * Los contadores van en `null` porque el backend no expone ni los trámites por
   * organismo ni sus responsables. Mostrar un 0 sería afirmar que no tiene.
   */
  readonly tabs: Tab[] = [
    { clave: 'datos', label: 'Datos', contador: null },
    { clave: 'tramites', label: 'Trámites', contador: null },
    { clave: 'responsables', label: 'Responsables', contador: null },
    { clave: 'historial', label: 'Historial', contador: null },
  ];

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.params['id'] ?? '';
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = false;
    this.facade.getDetalle(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => { this.detalle = detalle; this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  /**
   * Campos de "Datos institucionales" en el orden del diseño. Los que el backend
   * todavía no devuelve se marcan `pendiente` en vez de omitirse: el diseño los
   * define y conviene que se vea que faltan, no que no existen.
   */
  get campos(): CampoFicha[] {
    const o = this.detalle?.organismo;
    return [
      { label: 'Sigla', valor: o?.acronym || null },
      { label: 'Tipo de organismo', valor: this.detalle?.tipoNombre ?? null },
      { label: 'Organismo superior', valor: this.detalle?.parentNombre ?? 'Sin organismo superior' },
      { label: 'Localidad base', valor: this.detalle?.localidadNombre ?? null },
      { label: 'Jurisdicción', valor: null, pendiente: true },
      { label: 'CUIT', valor: null, pendiente: true },
      { label: 'Domicilio', valor: null, pendiente: true },
      { label: 'Teléfono', valor: null, pendiente: true },
      { label: 'Correo institucional', valor: null, pendiente: true, enlace: 'mailto' },
      { label: 'Sitio web', valor: null, pendiente: true, enlace: 'web' },
      { label: 'Código SIGAF', valor: null, pendiente: true },
    ];
  }

  seleccionarTab(clave: TabDetalle): void {
    this.tab$.next(clave);
  }

  /** Iniciales del membrete: la sigla si existe, si no las del nombre. */
  get iniciales(): string {
    const sigla = (this.detalle?.organismo.acronym ?? '').replace(/[^\p{L}]/gu, '');
    if (sigla.length >= 2) return sigla.slice(0, 3).toLocaleUpperCase('es-AR');

    const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);
    const palabras = (this.detalle?.organismo.nombre ?? '')
      .split(/\s+/)
      .filter((p) => /\p{L}/u.test(p) && !conectores.has(p.toLocaleLowerCase('es-AR')));
    if (palabras.length === 0) return '—';
    const letras = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras.slice(0, 2).map((p) => p[0]).join('');
    return letras.toLocaleUpperCase('es-AR');
  }

  volver(): void {
    this.router.navigate(['/dashboard/organismos/lista']);
  }

  onEdit(): void {
    this.router.navigate(['/dashboard/organismos/editar', this.id]);
  }

  get accionesDelMembrete(): RowAction[] {
    return [
      {
        label: 'Eliminar',
        icon: 'trash',
        permission: 'DELETE_ORGANISM',
        danger: true,
        ariaLabel: `Eliminar organismo ${this.detalle?.organismo.nombre ?? ''}`,
        run: () => this.onDelete(),
      },
    ];
  }

  onDelete(): void {
    const organismo = this.detalle?.organismo;
    if (!organismo) return;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el organismo?',
        message: `Se eliminará ${organismo.nombre} y dejará de estar disponible para asociar trámites y usuarios. Esta acción no se puede deshacer.`,
        highlight: organismo.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        confirmAction: () => this.facade.delete(organismo.id),
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.volver();
      });
  }
}
