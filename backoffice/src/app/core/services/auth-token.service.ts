import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AuthUser } from '../models/auth.model';
import { UserRole, ROLE_TO_DISPLAY, ROLE_TO_SPANISH, UserRoleDisplay } from '../enums/user-role.enum';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private currentUser = new BehaviorSubject<AuthUser | null>(null);

  constructor() {
    this.updateUserFromToken();
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser.getValue();
  }

  getCurrentUser$(): Observable<AuthUser | null> {
    return this.currentUser.asObservable();
  }

  isAuthenticated(): boolean {
    return this.currentUser.getValue() !== null;
  }

  isAuthenticated$(): Observable<boolean> {
    return this.currentUser.asObservable().pipe(map((user) => user !== null));
  }

  getUserRole(): UserRole | null {
    return this.currentUser.getValue()?.role ?? null;
  }

  getUserRoleDisplay(): UserRoleDisplay | null {
    const role = this.getUserRole();
    return role ? ROLE_TO_DISPLAY[role] : null;
  }

  getUserRoleSpanish(): string | null {
    const role = this.getUserRole();
    return role ? ROLE_TO_SPANISH[role] : null;
  }

  getUserOrganismoId(): string | null {
    return this.currentUser.getValue()?.organismoId ?? null;
  }

  updateUserFromToken(): void {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData) as AuthUser;
        this.currentUser.next(user);
      } catch {
        this.clearUser();
      }
    }
  }

  clearUser(): void {
    this.currentUser.next(null);
  }

  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    this.clearUser();
  }
}
