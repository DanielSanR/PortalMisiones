import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { MunicipiosDataSource } from './municipios.datasource';
import { MunicipalityResponseDTO } from '../models/municipio.dto';
import { toMunicipioVM } from '../mappers/municipios.mapper';
import { MunicipioVM } from '../models/municipio.vm';

/** Implementación HTTP real (`GET /api/municipality`, público). */
@Injectable()
export class MunicipiosHttpDataSource extends MunicipiosDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/municipality`;

  constructor(private http: HttpClient) {
    super();
  }

  getAll(): Observable<MunicipioVM[]> {
    return this.http
      .get<ResponseDTO<MunicipalityResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toMunicipioVM)));
  }
}
