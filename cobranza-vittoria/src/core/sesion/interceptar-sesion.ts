import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../config/environment';
import { SesionUsuario } from './sesion-usuario';

const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);
const AUTH_ENDPOINTS = [
  '/api/seguridad/auth/login',
  '/api/seguridad/auth/refresh',
  '/api/seguridad/auth/logout',
];

function isProtectedApiRequest(request: HttpRequest<unknown>): boolean {
  // Limitar el Bearer a la API configurada evita filtrarlo a servicios externos.
  const apiBase = environment.apiUrl.replace(/\/+$/, '');
  if (request.url !== apiBase && !request.url.startsWith(`${apiBase}/`)) return false;
  return !AUTH_ENDPOINTS.some((endpoint) => request.url.includes(endpoint));
}

function withBearer(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const interceptarSesion: HttpInterceptorFn = (request, next) => {
  const auth = inject(SesionUsuario);

  if (!isProtectedApiRequest(request)) return next(request);

  const session = auth.session;
  if (!session) return next(request);

  const send = (token: string, retried: boolean = false): Observable<HttpEvent<unknown>> => {
    const authenticated = withBearer(request, token).clone({
      context: request.context.set(RETRIED_AFTER_REFRESH, retried),
    });

    return next(authenticated).pipe(
      catchError((error: unknown) => {
        if (
          !(error instanceof HttpErrorResponse) ||
          error.status !== 401 ||
          authenticated.context.get(RETRIED_AFTER_REFRESH)
        ) {
          return throwError(() => error);
        }

        return auth.refresh().pipe(
          catchError((refreshError: unknown) => {
            auth.clearLocalSession();
            return throwError(() => refreshError);
          }),
          switchMap((refreshed) => send(refreshed.accessToken, true)),
        );
      }),
    );
  };

  // Se renueva también de forma preventiva para no enviar un JWT que ya sabemos vencido.
  if (auth.isAccessTokenExpired(10)) {
    return auth.refresh().pipe(
      catchError((error: unknown) => {
        auth.clearLocalSession();
        return throwError(() => error);
      }),
      switchMap((refreshed) => send(refreshed.accessToken, true)),
    );
  }

  return send(session.accessToken);
};
