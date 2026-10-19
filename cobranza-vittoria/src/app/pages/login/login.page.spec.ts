import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login.page';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Session } from '../../core/auth/session.models';

const SESION: Session = {
  accessToken: 'token',
  refreshToken: 'refresh',
  expiration: '2099-01-01T00:00:00Z',
  roles: ['Residente'],
  permisos: ['requerimientos.ver'],
};

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let pagina: LoginPage;
  let router: Router;
  let respuesta: Subject<Session>;
  let autenticacion: Pick<AuthService, 'login'>;
  let notificaciones: Pick<NotificationService, 'show'>;

  async function crearPagina(returnUrl?: string): Promise<void> {
    respuesta = new Subject<Session>();
    autenticacion = { login: vi.fn<AuthService['login']>().mockReturnValue(respuesta) };
    notificaciones = { show: vi.fn<NotificationService['show']>() };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: autenticacion },
        { provide: NotificationService, useValue: notificaciones },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    pagina = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function raiz(): HTMLElement {
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('No se creó la vista de login.');
    return elemento;
  }

  function completarFormulario(): void {
    pagina.form = { usernameOrEmail: '  residente  ', password: ' clave con espacios ' };
  }

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => respuesta?.complete());

  it.each([
    ['', 'clave'],
    ['   ', 'clave'],
    ['usuario', ''],
    ['usuario', '   '],
  ])('rechaza campos vacíos sin llamar a la API (%s)', async (usuario: string, clave: string) => {
    await crearPagina();
    pagina.form = { usernameOrEmail: usuario, password: clave };
    pagina.submit();

    expect(autenticacion.login).not.toHaveBeenCalled();
    expect(notificaciones.show).toHaveBeenCalledWith('Ingresa tu usuario y contraseña.', 'info');
    expect(pagina.loading).toBe(false);
  });

  it('recorta el usuario y conserva la contraseña exacta, evitando envíos duplicados', async () => {
    await crearPagina();
    completarFormulario();
    pagina.submit();
    pagina.submit();

    expect(autenticacion.login).toHaveBeenCalledExactlyOnceWith({
      usernameOrEmail: 'residente',
      password: ' clave con espacios ',
    });
    expect(pagina.loading).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(raiz().querySelector<HTMLButtonElement>('.login-submit')?.disabled).toBe(true);
    expect(raiz().querySelector('.login-submit')?.textContent).toContain('Ingresando...');
  });

  it.each([undefined, '/requerimientos?obra=7'])(
    'restaura el estado y navega al destino esperado tras login: %s',
    async (returnUrl: string | undefined) => {
      await crearPagina(returnUrl);
      completarFormulario();
      pagina.submit();
      respuesta.next(SESION);
      respuesta.complete();

      expect(pagina.loading).toBe(false);
      expect(router.navigateByUrl).toHaveBeenCalledWith(returnUrl ?? '/dashboard');
    },
  );

  it.each([
    ['Credenciales rechazadas por el servidor.', 'Credenciales rechazadas por el servidor.'],
    [undefined, 'Usuario o contraseña incorrectos.'],
  ])(
    'muestra el error y permite volver a enviar (%s)',
    async (mensaje: string | undefined, esperado: string) => {
      await crearPagina();
      completarFormulario();
      pagina.submit();
      respuesta.error(
        new HttpErrorResponse({ status: 401, error: mensaje ? { message: mensaje } : null }),
      );

      expect(pagina.loading).toBe(false);
      expect(notificaciones.show).toHaveBeenCalledWith(esperado, 'error');
      expect(router.navigateByUrl).not.toHaveBeenCalled();

      respuesta = new Subject<Session>();
      vi.mocked(autenticacion.login).mockReturnValue(respuesta);
      pagina.submit();
      expect(autenticacion.login).toHaveBeenCalledTimes(2);
    },
  );

  it('permite alternar la visibilidad de la contraseña desde el botón', async () => {
    await crearPagina();
    const boton: HTMLButtonElement | null = raiz().querySelector('.password-box__toggle');
    const entrada: HTMLInputElement | null = raiz().querySelector(
      '[autocomplete="current-password"]',
    );
    expect(entrada?.type).toBe('password');

    boton?.click();
    await fixture.whenStable();
    expect(entrada?.type).toBe('text');
    boton?.click();
    await fixture.whenStable();
    expect(entrada?.type).toBe('password');
  });

  it('envía al pulsar Enter desde un campo de credenciales', async () => {
    await crearPagina();
    completarFormulario();
    const entrada: HTMLInputElement | null = raiz().querySelector('[autocomplete="username"]');
    entrada?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    expect(autenticacion.login).toHaveBeenCalledOnce();
  });
});
