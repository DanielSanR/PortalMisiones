import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, JwtPayload, LoginRequest } from '../models/auth.model';
import { AuthTokenService } from './auth-token.service';
import { normalizeBackendRole } from '../utils/role.utils';
import { InvalidRoleError } from '../errors/invalid-role.error';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService
  ) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password } as LoginRequest)
      .pipe(tap((response) => this.saveUserData(response.data.token)));
  }

  refreshToken(token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, { token });
  }

  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  setToken(token: string): void {
    localStorage.setItem('jwt_token', token);
  }

  removeToken(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
  }

  saveUserData(token: string): void {
    try {
      const payload = this.decodeToken(token);
      const role = normalizeBackendRole(payload.roles);

      const userData = {
        id: payload.userId,
        email: payload.sub,
        nombre: payload.nombre,
        apellido: payload.apellido,
        role,
        organismoId: payload.organismoId,
      };

      this.setToken(token);
      localStorage.setItem('user_data', JSON.stringify(userData));
      this.authTokenService.updateUserFromToken();
    } catch (error) {
      if (error instanceof InvalidRoleError) {
        this.logout();
      }
      throw error;
    }
  }

  logout(): void {
    this.removeToken();
    this.authTokenService.clearUser();
  }

  private decodeToken(token: string): JwtPayload {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded) as JwtPayload;
  }
}
