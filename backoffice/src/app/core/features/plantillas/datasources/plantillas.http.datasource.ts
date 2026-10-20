import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { PlantillasDataSource } from './plantillas.datasource';
import { ProcedureTemplateResponseDTO } from '../models/plantilla.dto';
import { toPlantillaVM, toProcedureTemplateRequest } from '../mappers/plantillas.mapper';
import { PlantillaFormValue, PlantillaVM } from '../models/plantilla.vm';

/**
 * Implementación HTTP real (`/api/procedure-template`, permisos `*_PROCEDURE`). Alcance global:
 * no depende del organismo del usuario. Las escrituras no abren el diálogo global de error: el
 * form traduce `4072`/`4073` a su campo o a su banner. Las lecturas tampoco: lista, detalle y form
 * muestran su propio estado de error (con "Reintentar"), y el diálogo lo duplicaría.
 */
@Injectable()
export class PlantillasHttpDataSource extends PlantillasDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/procedure-template`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<PlantillaVM[]> {
    return this.http
      .get<ResponseDTO<ProcedureTemplateResponseDTO[]>>(this.apiUrl, sinDialogoGlobal())
      .pipe(map((res) => (res.data ?? []).map(toPlantillaVM)));
  }

  getById(id: string): Observable<PlantillaVM> {
    return this.http
      .get<ResponseDTO<ProcedureTemplateResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map((res) => toPlantillaVM(res.data)));
  }

  create(form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.http
      .post<ResponseDTO<ProcedureTemplateResponseDTO>>(this.apiUrl, toProcedureTemplateRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toPlantillaVM(res.data)));
  }

  update(id: string, form: PlantillaFormValue): Observable<PlantillaVM> {
    return this.http
      .put<ResponseDTO<ProcedureTemplateResponseDTO>>(`${this.apiUrl}/${encodeURIComponent(id)}`, toProcedureTemplateRequest(form), sinDialogoGlobal())
      .pipe(map((res) => toPlantillaVM(res.data)));
  }

  desactivar(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }
}
