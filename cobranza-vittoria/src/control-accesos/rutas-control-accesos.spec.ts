import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app/app.routes';
import { NotificationService } from '../app/core/services/notification.service';
import { environment } from '../core/config/environment';

@Component({ selector: 'destino-prueba', template: '' })
class DestinoPrueba {}

const RUTAS = [
  { ruta: 'usuarios', endpoint: 'usuarios', selector: 'lista-usuarios' },
  { ruta: 'perfiles', endpoint: 'roles', selector: 'lista-roles' },
  { ruta: 'acciones', endpoint: 'permisos?activo=true', selector: 'lista-permisos' },
];

describe('Rutas migradas de Control de accesos', () => {
  beforeEach(() => {
    localStorage.clear();
    const acceso = routes.find((ruta) => ruta.path === 'control-accesos');
    if (!acceso) throw new Error('Falta Control de accesos');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: { show: vi.fn() } },
        provideRouter([
          acceso,
          { path: 'login', component: DestinoPrueba },
          { path: 'dashboard', component: DestinoPrueba },
        ]),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
  });

  function iniciarSesion(rol: string): void {
    localStorage.setItem(
      'vittoria.auth.accessToken',
      `cabecera.${btoa(JSON.stringify({ role: rol }))}.firma`,
    );
    localStorage.setItem('vittoria.auth.refreshToken', 'refresh');
    localStorage.setItem('vittoria.auth.expiration', '2099-01-01T00:00:00Z');
  }

  it.each(RUTAS)(
    'carga $ruta mediante su ruta pública para Administrador',
    async ({ ruta, endpoint, selector }) => {
      iniciarSesion('Administrador');
      const harness = await RouterTestingHarness.create(`/control-accesos/${ruta}`);
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne(`${environment.apiUrl}/api/seguridad/${endpoint}`)
        .flush({ usuarios: [], roles: [], permisos: [] });
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(`/control-accesos/${ruta}`);
      expect(harness.routeNativeElement?.matches(selector)).toBe(true);
    },
  );

  it.each(RUTAS)(
    'deniega el acceso directo de Residente a $ruta antes de consultar datos',
    async ({ ruta }) => {
      iniciarSesion('Residente');
      await RouterTestingHarness.create(`/control-accesos/${ruta}`);
      expect(TestBed.inject(Router).url).toBe('/dashboard?accesoDenegado=true');
      TestBed.inject(HttpTestingController).expectNone(() => true);
    },
  );

  it('redirige al login sin sesión y conserva el destino', async () => {
    await RouterTestingHarness.create('/control-accesos/usuarios');
    const router = TestBed.inject(Router);
    const url = router.parseUrl(router.url);
    expect(url.root.children['primary']?.segments[0]?.path).toBe('login');
    expect(url.queryParams['returnUrl']).toBe('/control-accesos/usuarios');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
