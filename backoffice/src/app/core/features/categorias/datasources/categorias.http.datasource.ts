import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { CategoriasDataSource } from './categorias.datasource';
import { CategoryResponseDTO } from '../models/categoria.dto';
import { toCategoriaVM, toCategoryRequest } from '../mappers/categorias.mapper';
import { CategoriaFormValue, CategoriaVM } from '../models/categoria.vm';

/** Implementación HTTP real (`/api/category`, §5.3). */
@Injectable()
export class CategoriasHttpDataSource extends CategoriasDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/category`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<CategoriaVM[]> {
    return this.http
      .get<ResponseDTO<CategoryResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => res.data.map(toCategoriaVM)));
  }

  getById(id: string): Observable<CategoriaVM> {
    return this.http
      .get<ResponseDTO<CategoryResponseDTO>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => toCategoriaVM(res.data)));
  }

  create(form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.http
      .post<ResponseDTO<CategoryResponseDTO>>(this.apiUrl, toCategoryRequest(form))
      .pipe(map((res) => toCategoriaVM(res.data)));
  }

  update(id: string, form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.http
      .put<ResponseDTO<CategoryResponseDTO>>(`${this.apiUrl}/${id}`, toCategoryRequest(form))
      .pipe(map((res) => toCategoriaVM(res.data)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ResponseDTO<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }
}
