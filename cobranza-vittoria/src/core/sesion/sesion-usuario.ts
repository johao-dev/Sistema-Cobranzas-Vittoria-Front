import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { environment } from '../config/environment';
import { canAccess } from './control-acceso';
import { sessionFromTokens } from './claims-jwt';
import { AccessRule, AuthTokensResponse, LoginPayload, Session } from './contratos-sesion';

@Injectable({ providedIn: 'root' })
export class SesionUsuario {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly router: Router = inject(Router);
  private refreshInFlight$: Observable<Session> | null = null;

  // Se conservan las claves y el almacenamiento actuales; adoptar cookies HttpOnly
  // requiere un cambio coordinado del contrato con el backend.
  private readonly accessTokenKey = 'vittoria.auth.accessToken';
  private readonly refreshTokenKey = 'vittoria.auth.refreshToken';
  private readonly expirationKey = 'vittoria.auth.expiration';
  private readonly sessionState: WritableSignal<Session | null> = signal<Session | null>(
    this.restoreSession(),
  );

  readonly currentSession: Signal<Session | null> = this.sessionState.asReadonly();

  get session(): Session | null {
    return this.sessionState();
  }

  login(payload: LoginPayload): Observable<Session> {
    return this.http
      .post<AuthTokensResponse>(`${environment.apiUrl}/api/seguridad/auth/login`, payload)
      .pipe(
        map((response) => this.normalizeResponse(response)),
        tap((session) => this.persist(session)),
      );
  }

  refresh(): Observable<Session> {
    if (this.refreshInFlight$) return this.refreshInFlight$;

    const refreshToken = this.session?.refreshToken;
    if (!refreshToken) throw new Error('No existe un refresh token para renovar la sesión.');

    this.refreshInFlight$ = this.http
      .post<AuthTokensResponse>(`${environment.apiUrl}/api/seguridad/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        map((response) => this.normalizeResponse(response)),
        // La respuesta se valida completa antes de reemplazar los tres valores rotados.
        tap((session: Session) => this.persist(session)),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        // Todas las peticiones del mismo inyector comparten una única rotación.
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refreshInFlight$;
  }

  logout(): void {
    const refreshToken = this.session?.refreshToken;
    if (!refreshToken) {
      this.clearLocalSession();
      return;
    }

    this.http
      .post<void>(`${environment.apiUrl}/api/seguridad/auth/logout`, { refreshToken })
      .pipe(
        // La intención local de cerrar sesión prevalece incluso si el servidor no responde.
        finalize(() => this.clearLocalSession()),
      )
      .subscribe({ error: () => undefined });
  }

  clearLocalSession(returnUrl?: string): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.accessTokenKey);
      window.localStorage.removeItem(this.refreshTokenKey);
      window.localStorage.removeItem(this.expirationKey);

      // Limpieza de las claves antiguas para no dejar un perfil obsoleto tras migrar.
      window.localStorage.removeItem('vittoria.auth.session');
      window.localStorage.removeItem('vittoria.profile.name');
      window.localStorage.removeItem('vittoria.profile.role');
      window.localStorage.removeItem('usuarioLogin');
    }
    this.sessionState.set(null);
    void this.router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : undefined);
  }

  isAuthenticated(): boolean {
    const session = this.session;
    return !!session?.accessToken && !!session.refreshToken;
  }

  isAccessTokenExpired(leewaySeconds: number = 0): boolean {
    const expiration = this.session?.expiration;
    if (!expiration) return true;
    const expirationMs = Date.parse(expiration);
    return !Number.isFinite(expirationMs) || expirationMs <= Date.now() + leewaySeconds * 1000;
  }

  hasRole(role: string): boolean {
    return this.session?.roles.includes(role) ?? false;
  }

  hasPermission(permission: string): boolean {
    return this.session?.permisos.includes(permission) ?? false;
  }

  canAccess(rule?: AccessRule): boolean {
    return canAccess(this.session, rule);
  }

  private normalizeResponse(response: AuthTokensResponse): Session {
    if (
      typeof response?.token !== 'string' ||
      !response.token ||
      typeof response.refreshToken !== 'string' ||
      !response.refreshToken ||
      typeof response.expiration !== 'string' ||
      !response.expiration
    ) {
      throw new Error('La respuesta de autenticación no contiene los tokens requeridos.');
    }
    return sessionFromTokens(response.token, response.refreshToken, response.expiration);
  }

  private persist(session: Session): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.accessTokenKey, session.accessToken);
      window.localStorage.setItem(this.refreshTokenKey, session.refreshToken);
      window.localStorage.setItem(this.expirationKey, session.expiration);
    }
    this.sessionState.set(session);
  }

  private restoreSession(): Session | null {
    if (typeof window === 'undefined') return null;

    const accessToken = window.localStorage.getItem(this.accessTokenKey);
    const refreshToken = window.localStorage.getItem(this.refreshTokenKey);
    const expiration = window.localStorage.getItem(this.expirationKey);
    if (!accessToken || !refreshToken || !expiration) return null;

    return sessionFromTokens(accessToken, refreshToken, expiration);
  }
}
