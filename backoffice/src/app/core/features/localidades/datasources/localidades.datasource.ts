import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

/**
 * Fuente de datos de Geografía (departamentos + localidades). Solo lectura.
 * Backend real: `GET /api/department`, `GET /api/location` (públicos, §5.1).
 */
export abstract class LocalidadesDataSource {
  abstract getDepartamentos(): Observable<DepartamentoVM[]>;
  abstract getLocalidades(): Observable<LocalidadVM[]>;
}

export const LOCALIDADES_DS = new InjectionToken<LocalidadesDataSource>('LOCALIDADES_DS');
