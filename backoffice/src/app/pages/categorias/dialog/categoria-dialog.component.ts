import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map, startWith } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TreeFieldConfig, TreeOption } from '@core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { CategoriaFormValue, CategoriaVM, CategoriasFacade } from '@features/categorias';
import { cierreConConfirmacion } from '@shared/utils/cierre-con-confirmacion';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { TreeSelectComponent } from '../../../shared/components/tree-select/tree-select.component';
import { UnavailableDirective } from '../../../shared/directives/unavailable.directive';
import { CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA } from '../categoria-save-error';

/** Qué abre el diálogo: alta (sin `categoria`, con `parentId` opcional preseleccionado) o edición. */
export interface CategoriaDialogData {
  /** Listado plano completo: arma el árbol de "Categoría padre" y la ruta de la franja. */
  categorias: CategoriaVM[];
  categoria: CategoriaVM | null;
  parentId: string | null;
}

/** Lo que muestra la franja "dónde queda", derivado del formulario. */
interface Ubicacion {
  /** Nombres de los ancestros, de la raíz hacia abajo. */
  ruta: string[];
  nombre: string;
  slug: string;
}

const MIN = 3;
const MAX = 100;

/**
 * Alta y edición de una categoría (diseño "Categoría: alta y edición" de «Pantallas · Backoffice
 * Misiones»). Son los tres campos de `CategoryRequestDTO`: nombre, slug y categoría padre.
 *
 * Va en diálogo y no en página porque la categoría no tiene ficha propia y conviene no perder de
 * vista el árbol: la franja de arriba muestra dónde queda mientras se escribe. En un alta el slug
 * sigue al nombre hasta que el usuario lo edita. Queda abierto mientras guarda y, si el backend
 * rechaza, cuenta el motivo acá mismo. `afterClosed()` emite la categoría guardada, o `undefined`
 * si se canceló.
 */
@Component({
  selector: 'app-categoria-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    FormErrorBannerComponent, TreeSelectComponent, UnavailableDirective,
  ],
  templateUrl: './categoria-dialog.component.html',
  styleUrl: './categoria-dialog.component.scss',
})
export class CategoriaDialogComponent {
  private readonly facade = inject(CategoriasFacade);
  private readonly dialogRef = inject<MatDialogRef<CategoriaDialogComponent, CategoriaVM>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dialog = inject(MatDialog);
  private readonly cierre: () => Promise<void>;
  readonly data = inject<CategoriaDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = !!this.data.categoria;
  readonly min = MIN;
  readonly max = MAX;

  /** Padre con el que abre: el de la categoría en edición, o el de la fila desde la que se agregó. */
  private readonly padreInicial = this.padreValido(this.data.categoria?.parentId ?? this.data.parentId);
  private readonly porId = new Map(this.data.categorias.map((c) => [c.id, c]));

  /** Subcategoría agregada desde una fila: el subtítulo dice dentro de cuál cae. */
  readonly nombreDelPadreInicial = !this.esEdicion && this.padreInicial
    ? this.porId.get(this.padreInicial)?.nombre ?? ''
    : '';

  readonly form = new FormGroup({
    nombre: new FormControl(this.data.categoria?.nombre ?? '', {
      nonNullable: true, validators: [nombreConContenido, Validators.maxLength(MAX)],
    }),
    slug: new FormControl(this.data.categoria?.slug ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN), Validators.maxLength(MAX), slugBienFormado(this.data.categoria?.slug ?? '')],
    }),
    parentId: new FormControl(this.padreInicial, { nonNullable: true }),
  });

  readonly arbol: TreeFieldConfig = {
    nodes: this.nodosDelArbol(),
    loaded: true,
    emptyLabel: 'Sin categoría padre',
    emptyMeta: 'Queda como categoría de primer nivel',
    searchLabel: 'Buscar por nombre o slug',
    self: {
      id: this.data.categoria?.id ?? null,
      label: this.data.categoria?.nombre ?? 'Nueva categoría',
      tag: 'Esta categoría',
      icon: 'folder-simple',
    },
  };

  readonly ubicacion$: Observable<Ubicacion> = this.form.valueChanges.pipe(
    startWith(null),
    map(() => {
      const { nombre, slug, parentId } = this.form.getRawValue();
      return { ruta: this.rutaHasta(parentId), nombre: nombre.trim(), slug };
    }),
  );

  guardando = false;
  /** Motivo del último rechazo del backend (o `''`). */
  errorMensaje = '';

  constructor() {
    // Alta: el slug se arma con el nombre mientras el usuario no lo haya tocado. `setValue` no marca
    // dirty, así que el slug sigue "sin tocar" y continúa acompañando.
    if (!this.esEdicion) {
      this.form.controls.nombre.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((nombre) => {
          const slug = this.form.controls.slug;
          if (slug.pristine) slug.setValue(canonicalizarSlug(nombre));
        });
    }

    // X, Cancelar, Escape y clic afuera: con cambios sin guardar piden confirmación (criterio único de los diálogos de formulario).
    this.cierre = cierreConConfirmacion({
      dialog: this.dialog,
      dialogRef: this.dialogRef,
      destroyRef: this.destroyRef,
      hayCambios: () => this.form.dirty,
      ocupado: () => this.guardando,
      mensaje: this.esEdicion
        ? 'Hay cambios sin guardar en esta categoría. Si cerrás ahora se pierden.'
        : 'Hay datos sin guardar. Si cerrás ahora no se crea la categoría.',
    });
  }

  /**
   * El slug ya no coincide con el que saldría del nombre: se ofrece volver a ese. Solo después de
   * que el usuario tocó algo (el slug en un alta, el nombre en una edición): abrir una categoría
   * existente no debe invitar a cambiarle el slug, que es su dirección.
   */
  get puedeUsarElDelNombre(): boolean {
    const { nombre, slug } = this.form.getRawValue();
    const sugerido = canonicalizarSlug(nombre);
    const tocado = this.esEdicion ? this.form.controls.nombre.dirty : this.form.controls.slug.dirty;
    return tocado && !!sugerido && sugerido !== slug;
  }

  usarElDelNombre(): void {
    const slug = this.form.controls.slug;
    slug.setValue(canonicalizarSlug(this.form.controls.nombre.value));
    if (this.esEdicion) {
      slug.markAsDirty(); // en edición es un cambio a guardar
    } else {
      slug.markAsPristine(); // en alta vuelve a seguir al nombre
    }
  }

  /** "Guardar" bloqueado: es edición y no cambió nada (un guardado sin cambios es un request al pedo). */
  get sinCambios(): boolean {
    return this.esEdicion && this.form.pristine;
  }

  /** Submit del `<form>` (botón o Enter). */
  guardar(): void {
    if (this.guardando || this.sinCambios) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerInvalido();
      return;
    }

    const valor = this.form.getRawValue();
    const categoria: CategoriaFormValue = {
      nombre: valor.nombre.trim(),
      slug: valor.slug,
      parentId: valor.parentId || null,
    };

    this.guardando = true;
    this.errorMensaje = '';
    const request$ = this.data.categoria
      ? this.facade.update(this.data.categoria.id, categoria)
      : this.facade.create(categoria);
    // `guardando` solo se apaga si falla: tras el éxito el diálogo se está cerrando y un segundo Enter o
    // clic durante la animación no tiene que volver a guardar (en alta, duplicaría la categoría).
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardada) => this.dialogRef.close(guardada),
        error: (err: unknown) => {
          this.guardando = false;
          this.cdr.markForCheck();
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA);
          // El rechazo más común es el slug repetido: el foco va a ese campo, que ya muestra el motivo.
          if (this.form.controls.slug.hasError('server')) this.enfocarPrimerInvalido();
        },
      });
  }

  /** Lleva el foco al primer campo con error, que ya muestra el motivo (WCAG 3.3.1). */
  private enfocarPrimerInvalido(): void {
    this.cdr.detectChanges();
    this.host.querySelector<HTMLElement>('input.ng-invalid')?.focus();
  }

  /** Camino de cierre de la X y de Cancelar. */
  cancelar(): Promise<void> {
    return this.cierre();
  }

  invalido(nombre: keyof CategoriaDialogComponent['form']['controls']): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  // Árbol -----------------------------------------------------------------------
  /**
   * La propia categoría como padre (dato roto) se trata como "sin padre". Un padre que no está en
   * el listado se conserva tal cual: el desplegable lo muestra como "Opción no disponible" y no se
   * manda a la raíz una categoría por editarle solo el nombre.
   */
  private padreValido(parentId: string | null | undefined): string {
    return !parentId || parentId === this.data.categoria?.id ? '' : parentId;
  }

  /**
   * Categorías del desplegable. La que se edita queda afuera (el árbol la dibuja aparte, como
   * "Esta categoría") y su descendencia se muestra pero no se puede elegir: el backend rechaza
   * un padre descendiente con `4075`.
   */
  private nodosDelArbol(): TreeOption[] {
    const propia = this.data.categoria?.id ?? null;
    const dependientes = this.descendientesDe(propia);
    return this.data.categorias
      .filter((c) => c.id !== propia)
      .map((c) => ({
        id: c.id,
        label: c.nombre,
        meta: `/${c.slug}`,
        parentId: c.parentId,
        keywords: c.slug,
        disabledReason: dependientes.has(c.id) ? 'Depende de esta' : undefined,
      }));
  }

  /** Recorre en oleadas y marca cada id una sola vez: un ciclo en los datos no cuelga el bucle. */
  private descendientesDe(id: string | null): Set<string> {
    const descendientes = new Set<string>();
    if (!id) return descendientes;
    const alcanzados = new Set<string>([id]);
    let huboCambios = true;
    while (huboCambios) {
      huboCambios = false;
      for (const c of this.data.categorias) {
        if (c.parentId && alcanzados.has(c.parentId) && !alcanzados.has(c.id)) {
          alcanzados.add(c.id);
          descendientes.add(c.id);
          huboCambios = true;
        }
      }
    }
    return descendientes;
  }

  /** Nombres desde la raíz hasta `parentId` inclusive. Corta si encuentra un ciclo. */
  private rutaHasta(parentId: string): string[] {
    const ruta: string[] = [];
    const vistos = new Set<string>();
    let actual = parentId ? this.porId.get(parentId) : undefined;
    while (actual && !vistos.has(actual.id)) {
      vistos.add(actual.id);
      ruta.unshift(actual.nombre);
      actual = actual.parentId ? this.porId.get(actual.parentId) : undefined;
    }
    return ruta;
  }
}

/** Tramos de minúsculas y números separados por UN guion: sin guion al principio, al final ni doble. */
const SLUG_BIEN_FORMADO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Dos errores distintos para poder decir qué corregir: `pattern` si hay caracteres que no van
 * (mayúsculas, espacios, acentos) y `guiones` si los caracteres están bien pero un guion sobra
 * (`-abc`, `abc-`, `a--b`). El slug sugerido desde el nombre nunca cae en ninguno de los dos.
 *
 * El slug con el que ya venía la categoría (`original`) se acepta tal cual: uno viejo que no cumpla
 * la regla no debe impedir cambiarle el nombre o el padre. La regla aplica recién si se lo modifica.
 */
function slugBienFormado(original: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const slug = String(control.value ?? '');
    if (!slug || slug === original || SLUG_BIEN_FORMADO.test(slug)) return null; // vacío: lo informa `required`
    return /^[a-z0-9-]+$/.test(slug) ? { guiones: true } : { pattern: true };
  };
}

/**
 * `@NotBlank @Size(min = 3)` del backend sobre lo que realmente se envía (el nombre recortado):
 * solo espacios no cuenta como completado, ni "a  " como tres caracteres.
 */
function nombreConContenido(control: AbstractControl): ValidationErrors | null {
  const largo = String(control.value ?? '').trim().length;
  if (largo === 0) return { required: true };
  return largo < MIN ? { minlength: { requiredLength: MIN, actualLength: largo } } : null;
}
