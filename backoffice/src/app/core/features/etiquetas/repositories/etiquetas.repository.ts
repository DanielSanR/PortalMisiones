import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ETIQUETAS_DS, EtiquetasDataSource } from '../datasources/etiquetas.datasource';
import { EtiquetaFormValue, EtiquetaVM } from '../models/etiqueta.vm';

/** Repositorio de etiquetas. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class EtiquetasRepository {
  constructor(@Inject(ETIQUETAS_DS) private ds: EtiquetasDataSource) {}

  list(): Observable<EtiquetaVM[]> {
    return this.ds.list();
  }

  getById(id: number): Observable<EtiquetaVM> {
    return this.ds.getById(id);
  }

  create(form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.ds.create(form);
  }

  update(id: number, form: EtiquetaFormValue): Observable<EtiquetaVM> {
    return this.ds.update(id, form);
  }

  delete(id: number): Observable<void> {
    return this.ds.delete(id);
  }
}
