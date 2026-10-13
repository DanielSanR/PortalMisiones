import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse, Usuario, UsuarioCreate, UsuarioUpdate } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<PaginatedResponse<Usuario>> {
    return this.http.get<PaginatedResponse<Usuario>>(this.apiUrl);
  }

  getById(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  create(data: UsuarioCreate): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, data);
  }

  update(id: string, data: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}`, data);
  }

  changeEmail(id: string, email: string): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}`, { email });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  toggleActive(id: string): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${encodeURIComponent(id)}/toggle-active`, {});
  }
}
