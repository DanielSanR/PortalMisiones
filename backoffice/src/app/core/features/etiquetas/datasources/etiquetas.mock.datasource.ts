import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { EtiquetasDataSource } from './etiquetas.datasource';
import { toEtiquetaVM } from '../mappers/etiquetas.mapper';
import { MOCK_TAGS } from './etiquetas.mock-data';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';

const DELAY = 200;

/**
 * Implementación mock en memoria, fiel a las reglas del `Tag` real: slug canonicalizado,
 * `local` derivado del organismo y unicidad `(slug, organismo)` (un solo global por slug).
 */
@Injectable()
export class EtiquetasMockDataSource extends EtiquetasDataSource {
  private data: EtiquetaVM[] = MOCK_TAGS.map(toEtiquetaVM);

  list(): Observable<EtiquetaVM[]> {
    return of(this.data.map((e) => ({ ...e }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<EtiquetaVM> {
    const e = this.data.find((x) => x.id === id);
    return e ? of({ ...e }).pipe(delay(DELAY)) : errorDeNegocio(API_CODES.TAXONOMY_NOT_FOUND, 'La etiqueta no existe');
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    const slug = canonicalizarSlug(form.slug);
    if (this.chocaUnicidad(slug, form.organismoId, null)) return this.slugEnUso();

    const nueva: EtiquetaVM = {
      id: crypto.randomUUID(),
      slug,
      organismoId: form.organismoId,
      organismoNombre: null,
      local: form.organismoId != null,
    };
    this.data = [...this.data, nueva];
    return of({ ...nueva }).pipe(delay(DELAY));
  }

  update(id: string, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    const actual = this.data.find((x) => x.id === id);
    if (!actual) return errorDeNegocio(API_CODES.TAXONOMY_NOT_FOUND, 'La etiqueta no existe');

    const slug = canonicalizarSlug(form.slug);
    if (this.chocaUnicidad(slug, form.organismoId, id)) return this.slugEnUso();

    const actualizada: EtiquetaVM = {
      ...actual,
      slug,
      organismoId: form.organismoId,
      local: form.organismoId != null,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizada : x));
    return of({ ...actualizada }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }

  /** `uk_tags_slug_organism` + `uk_tags_slug_global`: mismo slug en el mismo alcance. */
  private chocaUnicidad(slug: string, organismoId: string | null, exceptoId: string | null): boolean {
    return this.data.some((x) => x.id !== exceptoId && x.slug === slug && x.organismoId === organismoId);
  }

  private slugEnUso(): Observable<never> {
    return errorDeNegocio(API_CODES.TAXONOMY_CONFLICT, 'Ya existe una etiqueta con ese slug en ese alcance');
  }
}
