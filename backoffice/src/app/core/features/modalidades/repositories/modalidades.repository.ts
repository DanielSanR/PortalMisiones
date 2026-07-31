import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MODALIDADES_DS, ModalidadesDataSource } from '../datasources/modalidades.datasource';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';

/** Repositorio de Modalidades. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class ModalidadesRepository {
  constructor(@Inject(MODALIDADES_DS) private ds: ModalidadesDataSource) {}

  list(): Observable<ModalidadVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<ModalidadVM> {
    return this.ds.getById(id);
  }

  create(form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.ds.create(form);
  }

  update(id: string, form: ModalidadFormValue): Observable<ModalidadVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
