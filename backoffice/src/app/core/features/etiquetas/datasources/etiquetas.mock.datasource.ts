import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { EtiquetaService } from '@core/services/etiqueta.service';
import { EtiquetasDataSource } from './etiquetas.datasource';
import { toEtiquetaVM } from '../mappers/etiquetas.mapper';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/** Implementación mock: envuelve el `EtiquetaService` (mockApiInterceptor) y mapea a VM. */
@Injectable()
export class EtiquetasMockDataSource extends EtiquetasDataSource {
  constructor(private etiquetas: EtiquetaService) {
    super();
  }

  list(): Observable<EtiquetaVM[]> {
    return this.etiquetas.getAll().pipe(map((res) => res.data.map(toEtiquetaVM)));
  }

  getById(id: number): Observable<EtiquetaVM> {
    return this.etiquetas.getById(id).pipe(map(toEtiquetaVM));
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.create(form).pipe(map(toEtiquetaVM));
  }

  update(id: number, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.etiquetas.update(id, form).pipe(map(toEtiquetaVM));
  }

  delete(id: number): Observable<void> {
    return this.etiquetas.delete(id);
  }
}
