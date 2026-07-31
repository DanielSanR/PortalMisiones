import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { LocalidadesDataSource } from './localidades.datasource';
import { DepartmentResponseDTO, LocationResponseDTO } from '../models/localidad.dto';
import { toDepartamentoVM, toLocalidadVM } from '../mappers/localidades.mapper';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

/** Implementación HTTP real (`/api/department`, `/api/location`; públicos, §5.1). */
@Injectable()
export class LocalidadesHttpDataSource extends LocalidadesDataSource {
  private readonly departmentUrl = `${environment.apiBaseUrl}/api/department`;
  private readonly locationUrl = `${environment.apiBaseUrl}/api/location`;

  constructor(private http: HttpClient) {
    super();
  }

  getDepartamentos(): Observable<DepartamentoVM[]> {
    return this.http
      .get<ResponseDTO<DepartmentResponseDTO[]>>(this.departmentUrl)
      .pipe(map((res) => res.data.map(toDepartamentoVM)));
  }

  getLocalidades(): Observable<LocalidadVM[]> {
    return this.http
      .get<ResponseDTO<LocationResponseDTO[]>>(this.locationUrl)
      .pipe(map((res) => res.data.map(toLocalidadVM)));
  }
}
