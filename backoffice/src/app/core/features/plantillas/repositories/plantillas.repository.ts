import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PLANTILLAS_DS, PlantillasDataSource } from '../datasources/plantillas.datasource';
import { PlantillaFormValue, PlantillaVM } from '../models/plantilla.vm';

/** Repositorio de plantillas provinciales. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class PlantillasRepository {
  constructor(@Inject(PLANTILLAS_DS) private ds: PlantillasDataSource) {}

  list(): Observable<PlantillaVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<PlantillaVM> {
    return this.ds.getById(id);
  }

  create(form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.ds.create(form);
  }

  update(id: string, form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.ds.update(id, form);
  }

  desactivar(id: string): Observable<void> {
    return this.ds.desactivar(id);
  }
}
