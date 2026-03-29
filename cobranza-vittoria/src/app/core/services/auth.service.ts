import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface LoginPayload {
  usuarioLogin: string;
  password: string;
}

export interface AuthSession {
  idUsuario: number;
  nombres: string;
  apellidos?: string | null;
  correo?: string | null;
  usuarioLogin: string;
  nombreRol?: string | null;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'vittoria.auth.session';

  constructor(private api: ApiService, private router: Router) {}

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/auth/login`, payload).pipe(
      map(res => this.normalizeSession(res)),
      tap(session => this.persist(session))
    );
  }

  get session(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.session;
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
      window.localStorage.removeItem('vittoria.profile.name');
      window.localStorage.removeItem('vittoria.profile.role');
      window.localStorage.removeItem('usuarioLogin');
    }
    this.router.navigateByUrl('/login');
  }

  private persist(session: AuthSession): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(session));
    window.localStorage.setItem('vittoria.profile.name', session.displayName);
    window.localStorage.setItem('vittoria.profile.role', session.nombreRol ?? 'Sin rol');
    window.localStorage.setItem('usuarioLogin', session.usuarioLogin);
  }

  private normalizeSession(res: any): AuthSession {
    const nombres = String(res?.nombres ?? res?.Nombres ?? '').trim();
    const apellidos = String(res?.apellidos ?? res?.Apellidos ?? '').trim();
    const displayName = [nombres, apellidos].filter(Boolean).join(' ') || String(res?.usuarioLogin ?? res?.UsuarioLogin ?? 'Usuario');
    return {
      idUsuario: Number(res?.idUsuario ?? res?.IdUsuario ?? 0),
      nombres,
      apellidos,
      correo: res?.correo ?? res?.Correo ?? null,
      usuarioLogin: String(res?.usuarioLogin ?? res?.UsuarioLogin ?? ''),
      nombreRol: res?.nombreRol ?? res?.NombreRol ?? null,
      displayName
    };
  }
}
