import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { MunicipiosDataSource } from './municipios.datasource';
import { MunicipioVM } from '../models/municipio.vm';

/** Implementación mock en memoria (dev offline). Algunas localidades de Misiones. */
@Injectable()
export class MunicipiosMockDataSource extends MunicipiosDataSource {
  private readonly data: MunicipioVM[] = [
    { id: 1, nombre: 'Posadas', codigoPostal: 'N3300' },
    { id: 2, nombre: 'Oberá', codigoPostal: 'N3360' },
    { id: 3, nombre: 'Eldorado', codigoPostal: 'N3380' },
    { id: 4, nombre: 'Puerto Iguazú', codigoPostal: 'N3370' },
    { id: 5, nombre: 'Apóstoles', codigoPostal: 'N3350' },
    { id: 6, nombre: 'Leandro N. Alem', codigoPostal: 'N3315' },
  ];

  getAll(): Observable<MunicipioVM[]> {
    return of(this.data.map((m) => ({ ...m }))).pipe(delay(200));
  }
}
