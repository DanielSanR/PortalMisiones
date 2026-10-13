import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { PlantillasDataSource } from './plantillas.datasource';
import { ProcedureTemplateResponseDTO } from '../models/plantilla.dto';
import { toPlantillaVM, toProcedureTemplateRequest } from '../mappers/plantillas.mapper';
import { PlantillaFormValue, PlantillaVM } from '../models/plantilla.vm';

const DELAY = 200;

/**
 * Semilla con la forma real del response. Los ids de los catálogos son los de sus mocks
 * (`mod-*`, `cat-*`, `tag-*`, `rec-*`, `lev-*`), así los nombres se resuelven también offline.
 */
const SEMILLA: ProcedureTemplateResponseDTO[] = [
  {
    id: 'pt-1',
    slugBase: 'obtener-licencia-de-conducir',
    titleBase: 'Obtener la licencia de conducir',
    shortDescription: 'Primera licencia de conducir para vehículos particulares.',
    longDescription: 'Trámite para obtener por primera vez la licencia nacional de conducir en la provincia.',
    modalityId: 'mod-1',
    mainCategoryId: 'cat-2',
    categoryIds: ['cat-1', 'cat-2'],
    tagIds: ['tag-1'],
    lifeEventIds: ['lev-3'],
    recipientIds: ['rec-1'],
    active: true,
  },
  {
    id: 'pt-2',
    slugBase: 'obtener-carnet-sanitario',
    titleBase: 'Obtener el carnet sanitario',
    shortDescription: 'Habilitación para manipular alimentos.',
    longDescription: null,
    modalityId: 'mod-3',
    mainCategoryId: 'cat-5',
    categoryIds: ['cat-4', 'cat-5'],
    tagIds: ['tag-4', 'tag-6'],
    lifeEventIds: ['lev-2'],
    recipientIds: ['rec-1', 'rec-2'],
    active: true,
  },
  {
    id: 'pt-3',
    slugBase: 'inscribirse-en-el-registro-de-emprendedores',
    titleBase: 'Inscribirse en el registro de emprendedores',
    shortDescription: null,
    longDescription: null,
    modalityId: 'mod-2',
    mainCategoryId: null,
    categoryIds: [],
    tagIds: [],
    lifeEventIds: ['lev-2'],
    recipientIds: ['rec-1'],
    active: true,
  },
];

/**
 * Implementación mock en memoria, fiel a las reglas de `ProcedureTemplateService`: listado solo de
 * activas, slug único (`4072`), plantilla inexistente (`4073`), PUT total y DELETE lógico. No puede
 * validar que los ids de catálogo existan (no conoce otros datasources).
 */
@Injectable()
export class PlantillasMockDataSource extends PlantillasDataSource {
  private data: ProcedureTemplateResponseDTO[] = SEMILLA.map((dto) => ({ ...dto }));

  list(): Observable<PlantillaVM[]> {
    return of(this.data.filter((dto) => dto.active).map(toPlantillaVM)).pipe(delay(DELAY));
  }

  getById(id: string): Observable<PlantillaVM> {
    const dto = this.data.find((x) => x.id === id);
    return dto ? of(toPlantillaVM(dto)).pipe(delay(DELAY)) : this.noExiste();
  }

  create(form: PlantillaFormValue): Observable<PlantillaVM> {
    const request = toProcedureTemplateRequest(form);
    if (this.slugEnUso(request.slugBase, null)) return this.conflictoDeSlug();

    const nueva: ProcedureTemplateResponseDTO = { id: crypto.randomUUID(), ...request };
    this.data = [...this.data, nueva];
    return of(toPlantillaVM(nueva)).pipe(delay(DELAY));
  }

  update(id: string, form: PlantillaFormValue): Observable<PlantillaVM> {
    if (!this.data.some((x) => x.id === id)) return this.noExiste();

    const request = toProcedureTemplateRequest(form);
    if (this.slugEnUso(request.slugBase, id)) return this.conflictoDeSlug();

    const actualizada: ProcedureTemplateResponseDTO = { id, ...request };
    this.data = this.data.map((x) => (x.id === id ? actualizada : x));
    return of(toPlantillaVM(actualizada)).pipe(delay(DELAY));
  }

  desactivar(id: string): Observable<void> {
    if (!this.data.some((x) => x.id === id)) return this.noExiste();
    this.data = this.data.map((x) => (x.id === id ? { ...x, active: false } : x));
    return of(void 0).pipe(delay(DELAY));
  }

  /** `uk_procedure_templates_slug_base`: el slug es único entre TODAS (activas o no). */
  private slugEnUso(slug: string, exceptoId: string | null): boolean {
    return this.data.some((x) => x.id !== exceptoId && x.slugBase === slug);
  }

  private conflictoDeSlug(): Observable<never> {
    return errorDeNegocio(API_CODES.ENTITY_CONFLICT, 'Ya existe una plantilla con ese slug');
  }

  private noExiste(): Observable<never> {
    return errorDeNegocio(API_CODES.ENTITY_NOT_FOUND, 'La plantilla no existe');
  }
}
