import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { MunicipioVM } from '../models/municipio.vm';

/** Fuente de datos de municipios. Backend real: GET /api/municipality (público). Solo lectura. */
export abstract class MunicipiosDataSource {
  abstract getAll(): Observable<MunicipioVM[]>;
}

export const MUNICIPIOS_DS = new InjectionToken<MunicipiosDataSource>('MUNICIPIOS_DS');
