import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InicioSesion } from './inicio-sesion';
import { SesionUsuario } from '../core/sesion/sesion-usuario';
import { NotificationService } from '../app/core/services/notification.service';
import { Session } from '../core/sesion/contratos-sesion';

const SESION: Session = {
  accessToken: 'token',
  refreshToken: 'refresh',
  expiration: '2099-01-01T00:00:00Z',
  roles: ['Residente'],
  permisos: ['requerimientos.ver'],
};

describe('InicioSesion sin Zone.js', () => {
  let fixture: ComponentFixture<InicioSesion>;
  let router: Router;
  let respuesta: Subject<Session>;
  let autenticacion: Pick<SesionUsuario, 'login'>;
  let notificaciones: Pick<NotificationService, 'show'>;

  async function crearPagina(returnUrl?: string): Promise<void> {
    respuesta = new Subject<Session>();
    autenticacion = { login: vi.fn<SesionUsuario['login']>().mockReturnValue(respuesta) };
    notificaciones = { show: vi.fn<NotificationService['show']>() };
    await TestBed.configureTestingModule({
      imports: [InicioSesion],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SesionUsuario, useValue: autenticacion },
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
    fixture = TestBed.createComponent(InicioSesion);
    await fixture.whenStable();
  }

  function elemento<T extends Element>(selector: string): T {
    const raiz: unknown = fixture.nativeElement;
    if (!(raiz instanceof HTMLElement)) throw new Error('No se creó la vista de login.');
    const encontrado: T | null = raiz.querySelector<T>(selector);
    if (!encontrado) throw new Error(`No se encontró ${selector} en el login.`);
    return encontrado;
  }

  async function completarFormulario(
    usuario: string = '  residente  ',
    clave: string = ' clave con espacios ',
  ): Promise<void> {
    for (const [selector, valor] of [
      ['#usuario-login', usuario],
      ['#clave-login', clave],
    ]) {
      const entrada: HTMLInputElement = elemento(selector);
      entrada.value = valor;
      entrada.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
  }

  function enviar(): void {
    elemento<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  }

  afterEach(() => {
    respuesta?.complete();
    vi.restoreAllMocks();
  });

  it.each([
    ['', 'clave'],
    ['   ', 'clave'],
    ['usuario', ''],
    ['usuario', '   '],
  ])('rechaza campos vacíos sin llamar a la API (%s)', async (usuario: string, clave: string) => {
    await crearPagina();
    await completarFormulario(usuario, clave);
    enviar();
    await fixture.whenStable();

    expect(autenticacion.login).not.toHaveBeenCalled();
    expect(notificaciones.show).toHaveBeenCalledWith('Ingresa tu usuario y contraseña.', 'info');
    expect(elemento<HTMLButtonElement>('.login-submit').disabled).toBe(false);
  });

  it('conserva la contraseña exacta y refleja la carga sin detección manual', async () => {
    await crearPagina();
    await completarFormulario();
    enviar();
    enviar();
    await fixture.whenStable();

    expect(autenticacion.login).toHaveBeenCalledExactlyOnceWith({
      usernameOrEmail: 'residente',
      password: ' clave con espacios ',
    });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(elemento<HTMLButtonElement>('.login-submit').disabled).toBe(true);
    expect(elemento('.login-submit').textContent).toContain('Ingresando...');
    expect(elemento('form').getAttribute('aria-busy')).toBe('true');
  });

  it.each([undefined, '/requerimientos?obra=7'])(
    'restaura la vista y navega tras la respuesta asíncrona: %s',
    async (returnUrl: string | undefined) => {
      await crearPagina(returnUrl);
      await completarFormulario();
      enviar();
      await fixture.whenStable();
      respuesta.next(SESION);
      respuesta.complete();
      await fixture.whenStable();

      expect(elemento<HTMLButtonElement>('.login-submit').disabled).toBe(false);
      expect(elemento('.login-submit').textContent).toContain('Ingresar');
      expect(elemento('form').getAttribute('aria-busy')).toBe('false');
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
      await completarFormulario();
      enviar();
      await fixture.whenStable();
      respuesta.error(
        new HttpErrorResponse({ status: 401, error: mensaje ? { message: mensaje } : null }),
      );
      await fixture.whenStable();

      expect(elemento<HTMLButtonElement>('.login-submit').disabled).toBe(false);
      expect(elemento('.login-submit').textContent).toContain('Ingresar');
      expect(notificaciones.show).toHaveBeenCalledWith(esperado, 'error');
      expect(router.navigateByUrl).not.toHaveBeenCalled();

      respuesta = new Subject<Session>();
      vi.mocked(autenticacion.login).mockReturnValue(respuesta);
      enviar();
      expect(autenticacion.login).toHaveBeenCalledTimes(2);
    },
  );

  it('presenta errores de modelo mediante la utilidad compartida', async () => {
    await crearPagina();
    await completarFormulario();
    enviar();
    respuesta.error(
      new HttpErrorResponse({
        status: 400,
        error: { errors: { UsernameOrEmail: ['El usuario es obligatorio.'] } },
      }),
    );
    await fixture.whenStable();
    expect(notificaciones.show).toHaveBeenCalledWith('El usuario es obligatorio.', 'error');
    expect(elemento<HTMLButtonElement>('.login-submit').disabled).toBe(false);
  });

  it('asocia las etiquetas y alterna contraseña con un control accesible', async () => {
    await crearPagina();
    expect(elemento<HTMLLabelElement>('label[for="usuario-login"]').control).toBe(
      elemento('#usuario-login'),
    );
    expect(elemento<HTMLLabelElement>('label[for="clave-login"]').control).toBe(
      elemento('#clave-login'),
    );
    const boton: HTMLButtonElement = elemento('.password-box__toggle');
    const entrada: HTMLInputElement = elemento('#clave-login');
    expect(entrada.type).toBe('password');
    boton.click();
    await fixture.whenStable();
    expect(entrada.type).toBe('text');
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    boton.click();
    await fixture.whenStable();
    expect(entrada.type).toBe('password');
    expect(boton.getAttribute('aria-pressed')).toBe('false');
  });

  it('envía desde el botón submit del formulario', async () => {
    await crearPagina();
    await completarFormulario();
    elemento<HTMLButtonElement>('.login-submit').click();
    expect(autenticacion.login).toHaveBeenCalledOnce();
  });

  it('libera la suscripción al salir de la página e ignora respuestas posteriores', async () => {
    await crearPagina();
    await completarFormulario();
    enviar();
    expect(respuesta.observed).toBe(true);
    fixture.destroy();
    expect(respuesta.observed).toBe(false);
    respuesta.next(SESION);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(notificaciones.show).not.toHaveBeenCalled();
  });
});
