import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, defer, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormErrorBannerComponent } from '../../../../shared/components/form-error-banner/form-error-banner.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import {
  PlantillaCatalogos, PlantillaFormValue, PlantillaOpcion, PlantillaRef, PlantillaVM, PlantillasFacade,
} from '@features/plantillas';
import {
  CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA, TEXTOS_PLANTILLA_INEXISTENTE, esPlantillaInexistente,
} from '../plantilla-save-error';
import { RUTA_DETALLE_PLANTILLA, RUTA_LISTA_PLANTILLAS } from '../plantillas.rutas';

/** Largo máximo de `title_base` / `slug_base` (VARCHAR(255) en el backend). */
const MAX_TEXTO_CORTO = 255;

/** Etiqueta de un id elegido que ya no está en su catálogo (borrado o catálogo sin leer). */
const NO_DISPONIBLE = 'No disponible';

/** Motivo por el que la pantalla no pudo dibujarse, ya traducido a lo que ve el usuario. */
interface ErrorCarga {
  titulo: string;
  texto: string;
  /** La plantilla no existe: reintentar no sirve, el camino es volver al listado. */
  noExiste: boolean;
}

/** El slug tiene que dejar algo después de canonicalizarlo ("¡¡¡" no sirve). */
function slugUtilizable(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  if (!valor.trim()) return null; // lo cubre `required`
  return canonicalizarSlug(valor) ? null : { slugVacio: true };
}

/**
 * La categoría principal tiene que ser una de las categorías elegidas. El backend no lo valida
 * (`ProcedureTemplateService` acepta cualquiera), así que la regla vive acá.
 */
function principalEnCategorias(control: AbstractControl): ValidationErrors | null {
  const principal = control.value as string | null;
  if (!principal) return null;
  const elegidas = (control.parent?.get('categoriaIds')?.value as string[] | undefined) ?? [];
  return elegidas.includes(principal) ? null : { principalFuera: true };
}

type CampoConResumen = 'titulo' | 'slug' | 'categoriaPrincipalId';
type CampoDelForm = keyof PlantillaFormComponent['form']['controls'];

/**
 * Alta y edición de una plantilla provincial. Formulario reactivo propio (no `app-dynamic-form`):
 * el slug se deriva del título y la categoría principal depende de las categorías elegidas.
 *
 * Nada se dibuja hasta que `getFormData()` resolvió, para no pisar una plantilla con un form vacío.
 */
@Component({
  selector: 'app-plantilla-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormErrorBannerComponent,
    LoadingComponent,
  ],
  templateUrl: './plantilla-form.component.html',
  styleUrl: './plantilla-form.component.scss',
})
export class PlantillaFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(PlantillasFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly maxTextoCorto = MAX_TEXTO_CORTO;

  readonly form = new FormGroup({
    titulo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(MAX_TEXTO_CORTO)] }),
    slug: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(MAX_TEXTO_CORTO), slugUtilizable] }),
    resumen: new FormControl('', { nonNullable: true }),
    descripcionLarga: new FormControl('', { nonNullable: true }),
    modalidadId: new FormControl<string>('', { nonNullable: true }),
    categoriaIds: new FormControl<string[]>([], { nonNullable: true }),
    categoriaPrincipalId: new FormControl<string>('', { nonNullable: true, validators: principalEnCategorias }),
    etiquetaIds: new FormControl<string[]>([], { nonNullable: true }),
    destinatarioIds: new FormControl<string[]>([], { nonNullable: true }),
    eventoDeVidaIds: new FormControl<string[]>([], { nonNullable: true }),
    activa: new FormControl(true, { nonNullable: true }),
  });

  isEdit = false;
  cargando = true;
  errorCarga: ErrorCarga | null = null;
  saving = false;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  plantilla: PlantillaVM | null = null;
  /** Catálogos para los selects, con los ids elegidos que no están en el catálogo agregados como "No disponible". */
  catalogos: PlantillaCatalogos | null = null;

  /**
   * Mientras sea false, el slug sigue al título. Pasa a true cuando el usuario lo escribe a mano
   * (y en edición, de entrada: cambiar el slug de una plantilla existente tiene que ser deliberado).
   */
  private slugManual = false;
  private editId: string | null = null;
  private readonly opcionesCategoria$ = new BehaviorSubject<PlantillaOpcion[]>([]);

  /**
   * Solo las categorías elegidas pueden ser la principal. La principal actual se sigue listando
   * aunque le hayan quitado su categoría: así el select la muestra junto a su error, en vez de
   * verse vacío con un valor escondido.
   */
  readonly opcionesPrincipal$: Observable<PlantillaOpcion[]> = combineLatest([
    this.opcionesCategoria$,
    defer(() => this.form.controls.categoriaIds.valueChanges.pipe(startWith(this.form.controls.categoriaIds.value))),
    defer(() => this.form.controls.categoriaPrincipalId.valueChanges.pipe(startWith(this.form.controls.categoriaPrincipalId.value))),
  ]).pipe(map(([opciones, elegidas, principal]) => opciones.filter((o) => elegidas.includes(o.id) || o.id === principal)));

  /** Cómo se va a guardar el slug, si difiere de lo tipeado. */
  readonly slugPrevisto$: Observable<string | null> = defer(() =>
    this.form.controls.slug.valueChanges.pipe(startWith(this.form.controls.slug.value)),
  ).pipe(
    map((valor) => {
      const canonico = canonicalizarSlug(valor);
      return canonico && canonico !== valor ? canonico : null;
    }),
  );

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.slugManual = this.isEdit;

    this.form.controls.titulo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((titulo) => {
        if (!this.slugManual) this.form.controls.slug.setValue(canonicalizarSlug(titulo));
      });

    this.form.controls.categoriaIds.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const principal = this.form.controls.categoriaPrincipalId;
        principal.updateValueAndValidity({ emitEvent: false });
        // Recién se ve el error si el usuario ya había elegido principal: quitarle la categoría
        // que era principal tiene que avisarse, no limpiarse en silencio.
        if (principal.value) principal.markAsTouched();
      });

    this.cargar();
  }

  /** Catálogos + plantilla en una sola suscripción: un estado de carga y uno de error. */
  cargar(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.cdr.markForCheck();

    this.facade.getFormData(this.editId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ plantilla, catalogos }) => {
          this.plantilla = plantilla;
          this.catalogos = plantilla ? conSeleccionados(catalogos, plantilla) : catalogos;
          this.opcionesCategoria$.next(this.catalogos.categorias);
          if (plantilla) {
            this.form.reset(aValorDeForm(plantilla));
          }
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.cargando = false;
          this.errorCarga = this.aErrorDeCarga(err);
          this.cdr.markForCheck();
        },
      });
  }

  /** El usuario tocó el slug: deja de seguir al título (salvo que lo vacíe del todo). */
  onSlugEditado(): void {
    this.slugManual = this.isEdit || this.form.controls.slug.value.trim() !== '';
  }

  /** Vuelve a derivar el slug del título actual. */
  regenerarSlug(): void {
    const slug = this.form.controls.slug;
    slug.setValue(canonicalizarSlug(this.form.controls.titulo.value));
    slug.markAsDirty();
    slug.markAsTouched();
    this.slugManual = this.isEdit;
  }

  /** En edición, "Guardar" queda deshabilitado hasta que haya algo que guardar. */
  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  onSubmit(): void {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    const valor = this.form.getRawValue();
    const form: PlantillaFormValue = {
      titulo: valor.titulo,
      slug: valor.slug,
      resumen: valor.resumen,
      descripcionLarga: valor.descripcionLarga,
      modalidadId: valor.modalidadId || null,
      categoriaPrincipalId: valor.categoriaPrincipalId || null,
      categoriaIds: valor.categoriaIds,
      etiquetaIds: valor.etiquetaIds,
      destinatarioIds: valor.destinatarioIds,
      eventoDeVidaIds: valor.eventoDeVidaIds,
      activa: valor.activa,
    };

    const request$ = this.isEdit ? this.facade.update(this.editId!, form) : this.facade.create(form);
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardada) => {
          const accion = this.isEdit ? 'actualizada' : 'creada';
          this.snackBar.open(
            guardada.activa ? `Plantilla ${accion}` : `Plantilla ${accion}. Está desactivada: no aparece en el listado`,
            'OK',
            { duration: 4000, panelClass: 'snackbar-success' },
          );
          this.router.navigate([RUTA_DETALLE_PLANTILLA, guardada.id]);
        },
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_PLANTILLA, FALLBACK_PLANTILLA);
          this.cdr.markForCheck();
        },
      });
  }

  cancelar(): void {
    if (this.isEdit && this.editId) {
      this.router.navigate([RUTA_DETALLE_PLANTILLA, this.editId]);
      return;
    }
    this.volverAlListado();
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA_PLANTILLAS]);
  }

  campoInvalido(nombre: CampoDelForm): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    const campos: { nombre: CampoConResumen; label: string }[] = [
      { nombre: 'titulo', label: 'Título' },
      { nombre: 'slug', label: 'Slug' },
      { nombre: 'categoriaPrincipalId', label: 'Categoría principal' },
    ];
    return campos
      .filter(({ nombre }) => this.form.controls[nombre].invalid)
      .map(({ nombre, label }) => `${label} (${this.motivo(this.form.controls[nombre])})`);
  }

  private motivo(control: AbstractControl): string {
    if (control.hasError('required')) return 'obligatorio';
    if (control.hasError('maxlength')) return `máximo ${control.errors?.['maxlength']?.requiredLength} caracteres`;
    if (control.hasError('slugVacio')) return 'tiene que tener letras o números';
    if (control.hasError('principalFuera')) return 'tiene que ser una de las categorías elegidas';
    if (control.hasError('server')) return String(control.errors?.['server']);
    return 'inválido';
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla. Durante un guardado
   * `saving` sigue en true hasta que navega, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && this.form.dirty;
  }

  private aErrorDeCarga(err: unknown): ErrorCarga {
    if (this.isEdit && esPlantillaInexistente(err)) {
      return { noExiste: true, ...TEXTOS_PLANTILLA_INEXISTENTE };
    }
    return {
      noExiste: false,
      titulo: this.isEdit ? 'No pudimos cargar la plantilla' : 'No pudimos cargar el formulario',
      texto: 'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
    };
  }
}

function aValorDeForm(p: PlantillaVM) {
  const ids = (refs: PlantillaRef[]) => refs.map((r) => r.id);
  return {
    titulo: p.titulo,
    slug: p.slug,
    resumen: p.resumen ?? '',
    descripcionLarga: p.descripcionLarga ?? '',
    modalidadId: p.modalidad?.id ?? '',
    categoriaIds: ids(p.categorias),
    categoriaPrincipalId: p.categoriaPrincipal?.id ?? '',
    etiquetaIds: ids(p.etiquetas),
    destinatarioIds: ids(p.destinatarios),
    eventoDeVidaIds: ids(p.eventosDeVida),
    activa: p.activa,
  };
}

/**
 * Agrega a cada catálogo los ids que la plantilla tiene y el catálogo no (borrados o catálogo
 * sin leer). Sin esto el select los mostraría vacíos y no se podrían quitar; igual se conservan
 * al guardar, porque el valor del form los incluye.
 */
function conSeleccionados(catalogos: PlantillaCatalogos, p: PlantillaVM): PlantillaCatalogos {
  const sumar = (opciones: PlantillaOpcion[], refs: PlantillaRef[]): PlantillaOpcion[] => {
    const conocidos = new Set(opciones.map((o) => o.id));
    const faltantes: PlantillaOpcion[] = [];
    for (const r of refs) {
      if (conocidos.has(r.id)) continue;
      conocidos.add(r.id);
      faltantes.push({ id: r.id, nombre: `${NO_DISPONIBLE} (${r.id.slice(0, 8)})` });
    }
    return [...opciones, ...faltantes];
  };
  return {
    ...catalogos,
    modalidades: sumar(catalogos.modalidades, p.modalidad ? [p.modalidad] : []),
    categorias: sumar(catalogos.categorias, [...p.categorias, ...(p.categoriaPrincipal ? [p.categoriaPrincipal] : [])]),
    etiquetas: sumar(catalogos.etiquetas, p.etiquetas),
    destinatarios: sumar(catalogos.destinatarios, p.destinatarios),
    eventosDeVida: sumar(catalogos.eventosDeVida, p.eventosDeVida),
  };
}
