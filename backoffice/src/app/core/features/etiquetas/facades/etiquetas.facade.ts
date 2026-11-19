import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, defer, distinctUntilChanged, forkJoin, map, of, tap } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { etiquetaDeOrganismo, hintDeOrganismoPropio, organismoDeSesion } from '@core/utils/session.utils';
import { OrganismoOption, OrganismosRepository } from '@features/organismos';
import { EtiquetasRepository } from '../repositories/etiquetas.repository';
import { EtiquetaFormData, EtiquetaFormValue, EtiquetaOrganismoFijo, EtiquetaVM } from '../models/etiqueta.vm';

/** Permiso que exige `GET /api/organism` (catálogo de nombres y select del form). */
const LEER_ORGANISMOS = 'READ_ORGANISM';

/**
 * Facade de Etiquetas (`/api/tag` real o mock según `featureOverrides`). Expone Observables
 * (async pipe; NO signals). Depende solo de repositorios; el cruce con organismos es vía su
 * Repository (patrón sancionado, igual que `UsuariosFacade`).
 *
 * Excepción documentada de sesión (`.claude/rules/arquitectura-capas.md`, igual que `AdopcionesFacade`):
 * `AuthTokenService` se consulta SOLO para no pedir `/api/organism` sin `READ_ORGANISM` (hoy, solo SA lo
 * tiene): el 403 abriría el diálogo global de error aunque acá se degrade a `[]`. Con una sesión de
 * organismo (`/api/auth/me`, backend `586b670`, G-2) el catálogo ni hace falta: el único organismo posible
 * es el del usuario y su nombre viene en la sesión. De ahí sale también `soloEtiquetasLocales$`: es un hecho
 * del listado que entrega la fuente para esa sesión (no un permiso ni una regla de negocio), expuesto acá
 * para que la pantalla no inyecte `AuthTokenService`.
 */
@Injectable({ providedIn: 'root' })
export class EtiquetasFacade {
  private readonly _etiquetas$ = new BehaviorSubject<EtiquetaVM[]>([]);
  readonly etiquetas$ = this._etiquetas$.asObservable();

  /**
   * ¿La sesión solo ve etiquetas locales? Con alcance de organismo, `GET /api/tag` devuelve únicamente las
   * de ese organismo (`TagService.getTags`: `findAllByOrganismId`), así que no hay globales que separar y
   * el filtro Global/Local de la lista no tiene nada que filtrar. Reactivo: sigue a la sesión (otro
   * usuario, un refresh que cambia el organismo). `defer`: lee la sesión al suscribirse.
   */
  readonly soloEtiquetasLocales$: Observable<boolean> = defer(() => this.auth.getCurrentUser$()).pipe(
    map((user) => organismoDeSesion(user) !== null),
    distinctUntilChanged(),
  );

  /** Último catálogo de organismos resuelto, para nombrar el organismo tras crear/editar. */
  private nombresOrganismo = new Map<string, string>();

  constructor(
    private etiquetas: EtiquetasRepository,
    private organismos: OrganismosRepository,
    private auth: AuthTokenService,
  ) {}

  /** Carga la lista con el nombre de organismo ya resuelto y la publica en el stream. */
  loadEtiquetas(): Observable<EtiquetaVM[]> {
    return forkJoin({ lista: this.etiquetas.list(), organismos: this.opcionesOrganismo() }).pipe(
      map(({ lista }) => lista.map((e) => this.conNombreOrganismo(e))),
      tap((list) => this._etiquetas$.next(list)),
    );
  }

  /** Etiqueta en edición (o null en alta) + opciones de organismo, en una sola llamada. */
  getFormData(id: string | null): Observable<EtiquetaFormData> {
    return forkJoin({
      etiqueta: id ? this.etiquetas.getById(id) : of(null),
      organismos: this.opcionesOrganismo(),
    }).pipe(
      map(({ etiqueta, organismos }) => ({
        etiqueta: etiqueta ? this.conNombreOrganismo(etiqueta) : null,
        organismos,
        organismoFijo: this.organismoFijo(),
      })),
    );
  }

  /**
   * Organismo de la sesión como único alcance posible, o `null` si la sesión no está atada a uno. Quien
   * tiene alcance de organismo solo crea etiquetas locales del suyo (`TagService.validateScope` → `4073`).
   */
  private organismoFijo(): EtiquetaOrganismoFijo | null {
    const organismo = this.auth.getUserOrganismo();
    if (!organismo) return null;
    return {
      id: organismo.id,
      nombre: etiquetaDeOrganismo(organismo),
      motivo: `${hintDeOrganismoPropio(organismo)}: las etiquetas que crees son locales de ese organismo.`,
    };
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.create(form).pipe(
      map((e) => this.conNombreOrganismo(e)),
      tap((e) => this._etiquetas$.next([...this._etiquetas$.value, e])),
    );
  }

  update(id: string, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.update(id, form).pipe(
      map((e) => this.conNombreOrganismo(e)),
      tap((updated) => this._etiquetas$.next(this._etiquetas$.value.map((e) => (e.id === id ? updated : e)))),
    );
  }

  delete(id: string): Observable<void> {
    return this.etiquetas.delete(id).pipe(
      tap(() => this._etiquetas$.next(this._etiquetas$.value.filter((e) => e.id !== id))),
    );
  }

  /**
   * Opciones de organismo. Con una sesión de organismo es solo el suyo, armado con los datos de la sesión
   * (sin pedir el catálogo: ese rol puede no tener `READ_ORGANISM`, y el backend igual no le deja usar
   * otro). Si no, sin `READ_ORGANISM` ni se piden (se consulta la sesión en cada llamada, no al construir:
   * el facade es singleton y los permisos pueden cambiar); si fallan, degradan a `[]`: la lista muestra
   * "—" y el form solo ofrece etiquetas globales (quien no puede crearlas no llega al alta:
   * `CREAR_ETIQUETA_ACCESS`). Cachea los nombres para resolver `organismoNombre`.
   */
  private opcionesOrganismo(): Observable<OrganismoOption[]> {
    const propio = this.auth.getUserOrganismo();
    const opciones$ = propio
      ? of<OrganismoOption[]>([{ id: propio.id, nombre: etiquetaDeOrganismo(propio) }])
      : this.auth.can(LEER_ORGANISMOS)
        ? this.organismos.getOptions()
        : of([] as OrganismoOption[]);
    return opciones$.pipe(
      catchError(() => of([] as OrganismoOption[])),
      tap((opciones) => { this.nombresOrganismo = new Map(opciones.map((o) => [o.id, o.nombre])); }),
    );
  }

  private conNombreOrganismo(e: EtiquetaVM): EtiquetaVM {
    return {
      ...e,
      organismoNombre: e.organismoId ? this.nombresOrganismo.get(e.organismoId) ?? null : null,
    };
  }
}
