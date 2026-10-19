import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { AuthTokensResponse } from '../auth/session.models';
import { environment } from '../config/environment';

const BASE_AUTH = `${environment.apiUrl}/api/seguridad/auth`;
const RECURSO = `${environment.apiUrl}/api/requerimientos`;
const RENOVADA: AuthTokensResponse = {
  token: 'token-renovado',
  refreshToken: 'refresh-rotado',
  expiration: '2099-01-01T00:00:00Z',
};

describe('authInterceptor', () => {
  let cliente: HttpClient;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('vittoria.auth.accessToken', 'token-vigente');
    localStorage.setItem('vittoria.auth.refreshToken', 'refresh-vigente');
    localStorage.setItem('vittoria.auth.expiration', '2099-01-01T00:00:00Z');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    cliente = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function completarRefresh(): void {
    const peticion: TestRequest = http.expectOne(`${BASE_AUTH}/refresh`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ refreshToken: 'refresh-vigente' });
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush(RENOVADA);
  }

  it('añade el Bearer vigente a las peticiones de la API', () => {
    cliente.get<unknown>(RECURSO).subscribe();
    const peticion = http.expectOne(RECURSO);
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-vigente');
    peticion.flush([]);
    http.expectNone(`${BASE_AUTH}/refresh`);
  });

  it('deja pasar una petición sin sesión y no intenta renovarla por un 401', () => {
    localStorage.clear();
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    cliente.get<unknown>(RECURSO).subscribe({ error: fallo });
    const peticion = http.expectOne(RECURSO);
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    http.expectNone(`${BASE_AUTH}/refresh`);
  });

  it.each(['https://servicio-externo.test/datos', `${environment.apiUrl}0/api/datos`])(
    'no filtra el Bearer ni renueva ante un 401 externo: %s',
    (url: string) => {
      const fallo = vi.fn<(error: HttpErrorResponse) => void>();
      cliente.get<unknown>(url).subscribe({ error: fallo });
      const peticion = http.expectOne(url);
      expect(peticion.request.headers.has('Authorization')).toBe(false);
      peticion.flush(null, { status: 401, statusText: 'Unauthorized' });
      expect(fallo).toHaveBeenCalledOnce();
      http.expectNone(`${BASE_AUTH}/refresh`);
    },
  );

  it.each(['login', 'refresh', 'logout'])(
    'no añade Bearer ni reintenta el endpoint público %s',
    (endpoint: string) => {
      const fallo = vi.fn<(error: HttpErrorResponse) => void>();
      cliente.post<unknown>(`${BASE_AUTH}/${endpoint}`, {}).subscribe({ error: fallo });
      const peticion = http.expectOne(`${BASE_AUTH}/${endpoint}`);
      expect(peticion.request.headers.has('Authorization')).toBe(false);
      peticion.flush(null, { status: 401, statusText: 'Unauthorized' });
      expect(fallo).toHaveBeenCalledOnce();
      http.expectNone(`${BASE_AUTH}/refresh`);
    },
  );

  it.each([403, 500])('propaga un %s sin renovar ni cerrar sesión', (estado: number) => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    cliente.get<unknown>(RECURSO).subscribe({ error: fallo });
    http.expectOne(RECURSO).flush(null, { status: estado, statusText: 'Error' });

    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: estado }));
    http.expectNone(`${BASE_AUTH}/refresh`);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('comparte una sola rotación entre dos peticiones que reciben 401', () => {
    const recibidas = vi.fn<(respuesta: unknown) => void>();
    cliente.get<unknown>(RECURSO).subscribe(recibidas);
    cliente.get<unknown>(`${RECURSO}/2`).subscribe(recibidas);

    http.expectOne(RECURSO).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${RECURSO}/2`).flush(null, { status: 401, statusText: 'Unauthorized' });
    completarRefresh();

    for (const url of [RECURSO, `${RECURSO}/2`]) {
      const reintento: TestRequest = http.expectOne(url);
      expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${RENOVADA.token}`);
      reintento.flush({ ok: true });
    }

    expect(recibidas).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem('vittoria.auth.refreshToken')).toBe(RENOVADA.refreshToken);
    http.expectNone(`${BASE_AUTH}/refresh`);
  });

  it('renueva preventivamente una sola vez antes de enviar peticiones próximas a vencer', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T12:00:00Z'));
    localStorage.setItem('vittoria.auth.expiration', '2026-10-19T12:00:05Z');
    cliente.get<unknown>(RECURSO).subscribe();
    cliente.get<unknown>(`${RECURSO}/2`).subscribe();
    http.expectNone(RECURSO);
    http.expectNone(`${RECURSO}/2`);

    completarRefresh();

    for (const url of [RECURSO, `${RECURSO}/2`]) {
      const peticion: TestRequest = http.expectOne(url);
      expect(peticion.request.headers.get('Authorization')).toBe(`Bearer ${RENOVADA.token}`);
      peticion.flush([]);
    }
  });

  it('conserva método, cuerpo, parámetros y cabeceras propias al reintentar', () => {
    const cuerpo = { descripcion: 'Materiales de obra' };
    cliente
      .post<unknown>(RECURSO, cuerpo, {
        params: { obra: 7 },
        headers: { 'X-Solicitud': 'prueba' },
      })
      .subscribe();
    http.expectOne(`${RECURSO}?obra=7`).flush(null, { status: 401, statusText: 'Unauthorized' });
    completarRefresh();

    const reintento: TestRequest = http.expectOne(`${RECURSO}?obra=7`);
    expect(reintento.request.method).toBe('POST');
    expect(reintento.request.body).toEqual(cuerpo);
    expect(reintento.request.headers.get('X-Solicitud')).toBe('prueba');
    expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${RENOVADA.token}`);
    reintento.flush({ id: 1 });
  });

  it.each([false, true])(
    'no inicia otra renovación cuando el reintento también recibe 401 (preventiva: %s)',
    (preventiva: boolean) => {
      if (preventiva) localStorage.setItem('vittoria.auth.expiration', '2000-01-01T00:00:00Z');
      const fallo = vi.fn<(error: HttpErrorResponse) => void>();
      cliente.get<unknown>(RECURSO).subscribe({ error: fallo });
      if (!preventiva) {
        http.expectOne(RECURSO).flush(null, { status: 401, statusText: 'Unauthorized' });
      }
      completarRefresh();
      http.expectOne(RECURSO).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
      http.expectNone(`${BASE_AUTH}/refresh`);
    },
  );

  it.each([false, true])(
    'limpia sesión y propaga el fallo de refresh (preventiva: %s)',
    (preventiva: boolean) => {
      if (preventiva) localStorage.setItem('vittoria.auth.expiration', '2000-01-01T00:00:00Z');
      const fallo = vi.fn<(error: HttpErrorResponse) => void>();
      cliente.get<unknown>(RECURSO).subscribe({ error: fallo });
      if (!preventiva) {
        http.expectOne(RECURSO).flush(null, { status: 401, statusText: 'Unauthorized' });
      }
      http
        .expectOne(`${BASE_AUTH}/refresh`)
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
      expect(TestBed.inject(AuthService).session).toBeNull();
      expect(localStorage.getItem('vittoria.auth.refreshToken')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], undefined);
      http.expectNone(RECURSO);
    },
  );

  it('libera la renovación compartida para permitir una rotación posterior', () => {
    for (const refreshToken of ['refresh-vigente', RENOVADA.refreshToken]) {
      cliente.get<unknown>(RECURSO).subscribe();
      http.expectOne(RECURSO).flush(null, { status: 401, statusText: 'Unauthorized' });
      const renovacion: TestRequest = http.expectOne(`${BASE_AUTH}/refresh`);
      expect(renovacion.request.body).toEqual({ refreshToken });
      renovacion.flush(RENOVADA);
      http.expectOne(RECURSO).flush([]);
    }
  });
});
