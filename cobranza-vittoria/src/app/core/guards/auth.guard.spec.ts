import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authGuard } from './auth.guard';
import { AccessRule } from '../auth/session.models';

@Component({ selector: 'app-vista-prueba', template: '' })
class VistaPrueba {}

describe('authGuard', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function guardarSesion(): void {
    const claims = { role: 'Residente', permission: 'requerimientos.ver' };
    localStorage.setItem(
      'vittoria.auth.accessToken',
      `cabecera.${btoa(JSON.stringify(claims))}.firma`,
    );
    localStorage.setItem('vittoria.auth.refreshToken', 'refresh-vigente');
    localStorage.setItem('vittoria.auth.expiration', '2099-01-01T00:00:00Z');
  }

  async function navegar(regla?: AccessRule, url = '/privada'): Promise<Router> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: VistaPrueba },
          { path: 'dashboard', component: VistaPrueba },
          {
            path: 'privada',
            component: VistaPrueba,
            canActivate: [authGuard],
            data: { access: regla },
          },
        ]),
      ],
    });
    await RouterTestingHarness.create(url);
    return TestBed.inject(Router);
  }

  it('redirige a login conservando la ruta completa cuando no hay sesión', async () => {
    const router: Router = await navegar(undefined, '/privada?obra=7');
    const destino = router.parseUrl(router.url);
    expect(destino.root.children['primary']?.segments[0]?.path).toBe('login');
    expect(destino.queryParams['returnUrl']).toBe('/privada?obra=7');
  });

  it('permite una ruta sin regla adicional con sesión restaurada', async () => {
    guardarSesion();
    expect((await navegar()).url).toBe('/privada');
  });

  it('permite el acceso mediante un permiso presente en el JWT', async () => {
    guardarSesion();
    const router: Router = await navegar({ anyPermission: ['requerimientos.ver'] });
    expect(router.url).toBe('/privada');
  });

  it('permite el acceso mediante un rol presente en el JWT', async () => {
    guardarSesion();
    const router: Router = await navegar({ anyRole: ['Residente'] });
    expect(router.url).toBe('/privada');
  });

  it('aplica la alternativa entre roles y permisos definida por AccessRule', async () => {
    guardarSesion();
    const router: Router = await navegar({
      anyRole: ['Administrador'],
      anyPermission: ['requerimientos.ver'],
    });
    expect(router.url).toBe('/privada');
  });

  it('redirige al dashboard con aviso cuando falta el acceso requerido', async () => {
    guardarSesion();
    const router: Router = await navegar({ anyPermission: ['requerimientos.crear'] });
    expect(router.url).toBe('/dashboard?accesoDenegado=true');
  });

  it('conserva el acceso con JWT vencido y refresh disponible para que el interceptor renueve', async () => {
    guardarSesion();
    localStorage.setItem('vittoria.auth.expiration', '2000-01-01T00:00:00Z');
    expect((await navegar()).url).toBe('/privada');
  });
});
