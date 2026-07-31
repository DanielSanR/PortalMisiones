import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DESTINATARIOS_DS, DestinatariosDataSource } from '../datasources/destinatarios.datasource';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';

/** Repositorio de Destinatarios. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class DestinatariosRepository {
  constructor(@Inject(DESTINATARIOS_DS) private ds: DestinatariosDataSource) {}

  list(): Observable<DestinatarioVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<DestinatarioVM> {
    return this.ds.getById(id);
  }

  create(form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.ds.create(form);
  }

  update(id: string, form: DestinatarioFormValue): Observable<DestinatarioVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
