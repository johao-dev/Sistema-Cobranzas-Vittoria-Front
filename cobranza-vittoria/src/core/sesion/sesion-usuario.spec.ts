import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SesionUsuario } from './sesion-usuario';
import { AuthTokensResponse, LoginPayload, Session } from './contratos-sesion';
import { environment } from '../config/environment';

const CREDENCIALES: LoginPayload = { usernameOrEmail: 'residente', password: 'clave de prueba' };
const RESPUESTA: AuthTokensResponse = {
  token: `cabecera.${btoa(JSON.stringify({ sub: '42', role: 'Residente', permission: 'requerimientos.ver' }))}.firma`,
  refreshToken: 'refresh-original',
  expiration: '2099-01-01T00:00:00Z',
};
const BASE_AUTH = `${environment.apiUrl}/api/seguridad/auth`;

function guardarTokens(respuesta: AuthTokensResponse): void {
  localStorage.setItem('vittoria.auth.accessToken', respuesta.token);
  localStorage.setItem('vittoria.auth.refreshToken', respuesta.refreshToken);
  localStorage.setItem('vittoria.auth.expiration', respuesta.expiration);
}

describe('SesionUsuario', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('inicia sin sesión cuando no hay tokens almacenados', () => {
    const servicio = TestBed.inject(SesionUsuario);
    expect(servicio.currentSession()).toBeNull();
    expect(servicio.isAuthenticated()).toBe(false);
    expect(servicio.isAccessTokenExpired()).toBe(true);
  });

  it.each(['vittoria.auth.accessToken', 'vittoria.auth.refreshToken', 'vittoria.auth.expiration'])(
    'no restaura una sesión si falta %s',
    (clave: string) => {
      guardarTokens(RESPUESTA);
      localStorage.removeItem(clave);
      expect(TestBed.inject(SesionUsuario).session).toBeNull();
    },
  );

  it('restaura los tokens y reconstruye roles y permisos desde los claims', () => {
    guardarTokens(RESPUESTA);
    const servicio = TestBed.inject(SesionUsuario);

    expect(servicio.session).toMatchObject({
      accessToken: RESPUESTA.token,
      refreshToken: RESPUESTA.refreshToken,
      expiration: RESPUESTA.expiration,
      idUsuario: 42,
      roles: ['Residente'],
      permisos: ['requerimientos.ver'],
    });
    expect(servicio.isAuthenticated()).toBe(true);
    expect(servicio.hasRole('Residente')).toBe(true);
    expect(servicio.hasRole('Administrador')).toBe(false);
    expect(servicio.hasPermission('requerimientos.ver')).toBe(true);
    expect(servicio.canAccess({ anyPermission: ['requerimientos.crear'] })).toBe(false);
  });

  it('envía las credenciales y persiste la respuesta completa del login', () => {
    const servicio = TestBed.inject(SesionUsuario);
    const recibido = vi.fn<(sesion: Session) => void>();
    servicio.login(CREDENCIALES).subscribe(recibido);

    const peticion = http.expectOne(`${BASE_AUTH}/login`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(CREDENCIALES);
    peticion.flush(RESPUESTA);

    expect(recibido).toHaveBeenCalledWith(servicio.currentSession());
    expect(localStorage.getItem('vittoria.auth.accessToken')).toBe(RESPUESTA.token);
    expect(localStorage.getItem('vittoria.auth.refreshToken')).toBe(RESPUESTA.refreshToken);
    expect(localStorage.getItem('vittoria.auth.expiration')).toBe(RESPUESTA.expiration);
  });

  it('propaga credenciales inválidas sin crear una sesión', () => {
    const servicio = TestBed.inject(SesionUsuario);
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    servicio.login(CREDENCIALES).subscribe({ error: fallo });
    http
      .expectOne(`${BASE_AUTH}/login`)
      .flush({ codigo: 'CREDENCIALES_INVALIDAS' }, { status: 401, statusText: 'Unauthorized' });

    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(servicio.session).toBeNull();
    expect(localStorage.getItem('vittoria.auth.accessToken')).toBeNull();
  });

  it('rota los tres valores usando el refresh vigente', () => {
    guardarTokens(RESPUESTA);
    const servicio = TestBed.inject(SesionUsuario);
    const renovada: AuthTokensResponse = {
      ...RESPUESTA,
      token: 'otro-token',
      refreshToken: 'refresh-rotado',
      expiration: '2099-02-01T00:00:00Z',
    };
    servicio.refresh().subscribe();

    const peticion = http.expectOne(`${BASE_AUTH}/refresh`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ refreshToken: RESPUESTA.refreshToken });
    peticion.flush(renovada);

    expect(servicio.session?.accessToken).toBe(renovada.token);
    expect(localStorage.getItem('vittoria.auth.refreshToken')).toBe(renovada.refreshToken);
    expect(localStorage.getItem('vittoria.auth.expiration')).toBe(renovada.expiration);
  });

  it.each(['token', 'refreshToken', 'expiration'] as const)(
    'rechaza una renovación sin %s y conserva la sesión anterior',
    (campo: keyof AuthTokensResponse) => {
      guardarTokens(RESPUESTA);
      const servicio = TestBed.inject(SesionUsuario);
      const anterior: Session | null = servicio.session;
      const fallo = vi.fn<(error: Error) => void>();
      servicio.refresh().subscribe({ error: fallo });
      http.expectOne(`${BASE_AUTH}/refresh`).flush({ ...RESPUESTA, [campo]: '' });

      expect(fallo).toHaveBeenCalledWith(expect.any(Error));
      expect(servicio.session).toEqual(anterior);
      expect(localStorage.getItem('vittoria.auth.refreshToken')).toBe(RESPUESTA.refreshToken);
    },
  );

  it('impide renovar sin refresh token y no envía una petición', () => {
    expect(() => TestBed.inject(SesionUsuario).refresh()).toThrow('No existe un refresh token');
    http.expectNone(`${BASE_AUTH}/refresh`);
  });

  it.each([204, 500])('cierra la sesión local aunque logout responda %s', (estado: number) => {
    guardarTokens(RESPUESTA);
    const servicio = TestBed.inject(SesionUsuario);
    servicio.logout();

    const peticion = http.expectOne(`${BASE_AUTH}/logout`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ refreshToken: RESPUESTA.refreshToken });
    peticion.flush(null, { status: estado, statusText: estado === 204 ? 'No Content' : 'Error' });

    expect(servicio.currentSession()).toBeNull();
    expect(localStorage.getItem('vittoria.auth.accessToken')).toBeNull();
    expect(localStorage.getItem('vittoria.auth.refreshToken')).toBeNull();
    expect(localStorage.getItem('vittoria.auth.expiration')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], undefined);
  });

  it('cierra sin petición cuando no hay sesión', () => {
    TestBed.inject(SesionUsuario).logout();
    http.expectNone(`${BASE_AUTH}/logout`);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], undefined);
  });

  it('limpia claves antiguas y conserva la ruta de retorno sin borrar datos ajenos', () => {
    guardarTokens(RESPUESTA);
    const clavesAntiguas: string[] = [
      'vittoria.auth.session',
      'vittoria.profile.name',
      'vittoria.profile.role',
      'usuarioLogin',
    ];
    clavesAntiguas.forEach((clave: string) => localStorage.setItem(clave, 'obsoleto'));
    localStorage.setItem('preferencia-ajena', 'conservar');

    TestBed.inject(SesionUsuario).clearLocalSession('/requerimientos');

    clavesAntiguas.forEach((clave: string) => expect(localStorage.getItem(clave)).toBeNull());
    expect(localStorage.getItem('preferencia-ajena')).toBe('conservar');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/requerimientos' },
    });
  });

  it.each([
    ['2026-10-19T12:00:00Z', 0, true],
    ['2026-10-19T12:00:05Z', 0, false],
    ['2026-10-19T12:00:05Z', 10, true],
    ['2026-10-19T12:00:10Z', 10, true],
    ['2026-10-19T12:00:11Z', 10, false],
    ['fecha-invalida', 0, true],
  ] as const)(
    'evalúa expiración %s con margen %s',
    (expiration: string, margen: number, vencido: boolean) => {
      vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T12:00:00Z'));
      guardarTokens({ ...RESPUESTA, expiration });
      expect(TestBed.inject(SesionUsuario).isAccessTokenExpired(margen)).toBe(vencido);
    },
  );
  it('comparte el refresh entre consumidores del servicio y permite renovar después de un fallo', () => {
    guardarTokens(RESPUESTA);
    const servicio: SesionUsuario = TestBed.inject(SesionUsuario);
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    servicio.refresh().subscribe({ error: fallo });
    servicio.refresh().subscribe({ error: fallo });
    http.expectOne(`${BASE_AUTH}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(fallo).toHaveBeenCalledTimes(2);
    servicio.refresh().subscribe();
    http.expectOne(`${BASE_AUTH}/refresh`).flush(RESPUESTA);
    expect(servicio.session?.refreshToken).toBe(RESPUESTA.refreshToken);
  });

  it.each(['token', 'refreshToken', 'expiration'] as const)(
    'rechaza un campo %s de tipo incorrecto sin persistirlo',
    (campo: keyof AuthTokensResponse) => {
      const servicio: SesionUsuario = TestBed.inject(SesionUsuario);
      const fallo = vi.fn<(error: Error) => void>();
      servicio.login(CREDENCIALES).subscribe({ error: fallo });
      http.expectOne(`${BASE_AUTH}/login`).flush({ ...RESPUESTA, [campo]: 123 });
      expect(fallo).toHaveBeenCalledWith(expect.any(Error));
      expect(servicio.session).toBeNull();
      expect(localStorage.getItem('vittoria.auth.accessToken')).toBeNull();
    },
  );
});
