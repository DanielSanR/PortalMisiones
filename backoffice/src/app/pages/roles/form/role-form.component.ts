import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs';
import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { RolesFacade, RolFormData } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { CampoPropioDirective } from '@shared/directives/campo-propio.directive';
import { PuedeTenerCambiosSinGuardar } from '@shared/guards/unsaved-changes.guard';
import { formularioDePagina } from '@shared/utils/formulario-de-pagina';
import { CONFLICTOS_ROL, FALLBACK_ROL, errorDeCargaDeRol } from '../role-save-error';
import { RUTA_LISTA_ROLES } from '../roles.rutas';
import { PermisosGrillaComponent } from './components/permisos-grilla/permisos-grilla.component';
import {
  RolFormulario, VistaRol, camposDeRol, panelesDeRol, rolFormValueDe, valorDeRol, valorInicialDeRol, vistaDeRol,
} from './rol-campos';

/**
 * Alta y edición de rol: una tarjeta de dos paneles (datos | permisos) que dibuja `<app-dynamic-form [paneles]>`
 * con lo que declara `rol-campos.ts`, sobre el marco `formularioDePagina` (cargar, guardar, salir). Los permisos
 * son el control `permissionsIds` del mismo formulario (campo `custom`): otorgar o quitar uno lo ensucia
 * (botón "Guardar" y aviso de cambios sin guardar).
 */
@Component({
  selector: 'app-role-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DynamicFormComponent, CampoPropioDirective, MembreteComponent, EstadoCargaComponent, PermisosGrillaComponent],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(RolesFacade);
  private readonly router = inject(Router);
  private readonly editId: string | null = inject(ActivatedRoute).snapshot.params['id'] ?? null;

  readonly esEdicion = !!this.editId;
  readonly marco = formularioDePagina<RolFormData>();

  @ViewChild(DynamicFormComponent) motor?: DynamicFormComponent;

  /** Catálogo de permisos (lo que dibuja la grilla). */
  permisos: PermisoVM[] = [];
  /** Valor con el que arranca el formulario. Referencia estable: el motor lo aplica cada vez que cambia. */
  inicial: RolFormulario = valorInicialDeRol(null);
  /** Valor en vivo del formulario (lo emite el motor con cada cambio). */
  private valor: RolFormulario = this.inicial;
  campos: FieldConfig[] = camposDeRol(this.esEdicion, this.valor.scopeTipo);
  /** Membrete, total del panel de permisos e indicador del pie, derivados de `valor`. */
  vista: VistaRol = vistaDeRol(this.valor, this.permisos);
  paneles: PanelDeFormulario[] = panelesDeRol(this.esEdicion, this.vista.resumen);

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Permisos disponibles + rol en edición, en una sola llamada (también es el "Reintentar"). El valor inicial
   * se arma antes de que el marco deje dibujar el formulario: llega precargado y sin cambios.
   */
  cargar(): void {
    const datos$ = this.facade.getFormData(this.editId).pipe(tap((datos) => {
      this.permisos = datos.permisos;
      this.inicial = valorInicialDeRol(datos.rol);
      this.mostrar(this.inicial);
    }));
    void this.marco.cargar(datos$, (err) => errorDeCargaDeRol(err, this.esEdicion));
  }

  /** Cada cambio del formulario: se rearman el membrete, el total y el pie. */
  alCambiar(crudo: Record<string, unknown>): void {
    const valor = valorDeRol(crudo);
    // El banner "No se pudo guardar" habla del intento anterior: al corregir el código (el campo que el
    // backend rechaza) deja de ser cierto, igual que el error del propio campo.
    if (valor.codigo !== this.valor.codigo) this.marco.limpiarErrorDeGuardado();
    this.mostrar(valor);
  }

  guardar(crudo: Record<string, unknown>): void {
    const valor = rolFormValueDe(crudo);
    void this.marco.guardar({
      peticion$: this.editId ? this.facade.update(this.editId, valor) : this.facade.create(valor),
      form: this.motor?.form,
      motor: this.motor,
      conflictos: CONFLICTOS_ROL,
      fallback: FALLBACK_ROL,
      aviso: () => (this.esEdicion ? 'Rol actualizado' : 'Rol creado correctamente'),
      destino: () => [RUTA_LISTA_ROLES],
      esAlta: !this.esEdicion,
      siNoNavega: 'El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.',
    });
  }

  volver(): void {
    void this.router.navigate([RUTA_LISTA_ROLES]);
  }

  /** Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla. */
  tieneCambiosSinGuardar(): boolean {
    return this.marco.tieneCambiosSinGuardar(this.motor?.form);
  }

  /**
   * Solo se vuelven a entregar al motor los campos o los paneles cuando cambia lo que dicen (la ayuda del
   * alcance, el total de permisos): cada `fields` nuevo revalida todos los controles.
   */
  private mostrar(valor: RolFormulario): void {
    const vista = vistaDeRol(valor, this.permisos);
    if (valor.scopeTipo !== this.valor.scopeTipo) this.campos = camposDeRol(this.esEdicion, valor.scopeTipo);
    if (vista.resumen !== this.vista.resumen) this.paneles = panelesDeRol(this.esEdicion, vista.resumen);
    this.valor = valor;
    this.vista = vista;
  }
}
