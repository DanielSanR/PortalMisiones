import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Categoria, CategoriaCreate, CategoriaUpdate, PaginatedResponse } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private readonly apiUrl = `${environment.apiUrl}/categorias`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<Categoria>> {
    return this.http.get<PaginatedResponse<Categoria>>(this.apiUrl);
  }

  getById(id: number): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.apiUrl}/${id}`);
  }

  getBySlug(slug: string): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.apiUrl}/slug/${slug}`);
  }

  create(data: CategoriaCreate): Observable<Categoria> {
    return this.http.post<Categoria>(this.apiUrl, data);
  }

  update(id: number, data: CategoriaUpdate): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
