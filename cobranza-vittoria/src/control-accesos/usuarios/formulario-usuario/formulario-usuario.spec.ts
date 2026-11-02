import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NotificationService } from '../../../app/core/services/notification.service';
import { environment } from '../../../core/config/environment';
import { FormularioUsuario } from './formulario-usuario';
import { AsignacionRolesUsuario } from '../asignacion-roles-usuario/asignacion-roles-usuario';

const BASE = `${environment.apiUrl}/api/seguridad`;
const USUARIO = {
  idUsuario: 12,
  nombres: 'Juan',
  apellidos: 'Pérez',
  correo: 'juan@correo.com',
  usuarioLogin: 'jperez',
  activo: true,
  fechaCreacion: null,
  usuarioCreacion: null,
};
const BORRADOR = {
  nombres: ' Juan ',
  apellidos: ' Pérez ',
  correo: ' juan@correo.com ',
  usuarioLogin: ' jperez ',
  password: ' clave con espacios ',
  activo: false,
};

describe('FormularioUsuario sin Zone.js', () => {
  let fixture: ComponentFixture<FormularioUsuario>;
  let formulario: FormularioUsuario;
  let http: HttpTestingController;
  const notificaciones = { show: vi.fn() };

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    await TestBed.configureTestingModule({
      imports: [FormularioUsuario],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificaciones },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormularioUsuario);
    formulario = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    notificaciones.show.mockReset();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  async function abrir(id: number | null = null): Promise<void> {
    fixture.componentRef.setInput('idUsuario', id);
    fixture.detectChanges();
    http
      .expectOne(`${BASE}/roles`)
      .flush({ roles: [{ idRol: 3, nombre: 'Residente', activo: true }] });
    if (id !== null)
      http
        .expectOne(`${BASE}/usuarios/${id}`)
        .flush({ usuario: USUARIO, roles: [{ nombreRol: 'Residente' }] });
    await fixture.whenStable();
  }

  it.each([
    { id: null, metodo: 'POST' },
    { id: 12, metodo: 'PUT' },
  ])(
    'intercepta el submit del formulario y registra por $metodo sin navegar',
    async ({ id, metodo }) => {
      await abrir(id);
      const raiz: unknown = fixture.nativeElement;
      if (!(raiz instanceof HTMLElement)) throw new Error('Falta el formulario de usuario');

      const campos = {
        nombres: ' Juan ',
        apellidos: ' Pérez ',
        correo: 'juan@correo.com',
        login: ' jperez ',
        password: id === null ? ' clave literal ' : '',
      };
      for (const [nombre, valor] of Object.entries(campos)) {
        const campo = raiz.querySelector(`#usuario-${nombre}`);
        if (!(campo instanceof HTMLInputElement)) throw new Error(`Falta el campo ${nombre}`);
        campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await fixture.whenStable();

      const elemento = raiz.querySelector('form');
      if (!(elemento instanceof HTMLFormElement)) throw new Error('Falta el elemento form');
      const evento = new Event('submit', { bubbles: true, cancelable: true });
      elemento.dispatchEvent(evento);
      expect(evento.defaultPrevented).toBe(true);

      const ruta = `${BASE}/usuarios${id === null ? '' : `/${id}`}`;
      const peticion = http.expectOne(ruta);
      expect(peticion.request.method).toBe(metodo);
      expect(peticion.request.body).toEqual({
        nombres: 'Juan',
        apellidos: 'Pérez',
        correo: 'juan@correo.com',
        usuarioLogin: 'jperez',
        ...(id === null ? { password: campos.password } : { activo: true }),
      });
      const guardado = vi.fn();
      formulario.guardado.subscribe(guardado);
      peticion.flush(id === null ? USUARIO : null);
      await fixture.whenStable();
      expect(guardado).toHaveBeenCalledOnce();
    },
  );

  it('normaliza el alta y conserva la contraseña literal, sin enviar estado ni hash', async () => {
    await abrir();
    formulario['form'].setValue(BORRADOR);
    formulario['guardar']();
    const req = http.expectOne(`${BASE}/usuarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nombres: 'Juan',
      apellidos: 'Pérez',
      correo: 'juan@correo.com',
      usuarioLogin: 'jperez',
      password: BORRADOR.password,
    });
    formulario['guardar']();
    http.expectNone(`${BASE}/usuarios`);
    req.flush(USUARIO, { status: 201, statusText: 'Created' });
    expect(formulario['guardando']()).toBe(false);
  });

  it.each(['', ' nueva clave '])(
    'conserva el comportamiento de edición de password: %s',
    async (password) => {
      await abrir(12);
      expect(formulario['form'].controls.password.value).toBe('');
      formulario['form'].controls.password.setValue(password);
      formulario['guardar']();
      const req = http.expectOne(`${BASE}/usuarios/12`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        nombres: 'Juan',
        apellidos: 'Pérez',
        correo: 'juan@correo.com',
        usuarioLogin: 'jperez',
        activo: true,
        ...(password ? { password } : {}),
      });
      req.flush(null, { status: 204, statusText: 'No Content' });
    },
  );

  it('conserva borrador y error de servidor; permite reintentar', async () => {
    await abrir();
    formulario['form'].setValue(BORRADOR);
    formulario['guardar']();
    http
      .expectOne(`${BASE}/usuarios`)
      .flush(
        { errors: { Correo: ['Correo duplicado.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(formulario['form'].getRawValue()).toEqual(BORRADOR);
    expect(formulario['guardando']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Correo duplicado.');
    formulario['guardar']();
    http.expectOne(`${BASE}/usuarios`).flush(USUARIO);
  });

  it('rechaza campos vacíos y correo inválido sin llamar a la API', async () => {
    await abrir();
    for (const cambios of [
      { nombres: '  ' },
      { correo: 'correo inválido' },
      { correo: ' ' },
      { password: '' },
      { apellidos: ' ' },
    ]) {
      formulario['form'].setValue({ ...BORRADOR, ...cambios });
      formulario['guardar']();
      http.expectNone((req) => req.method === 'POST');
    }
    expect(formulario['msg']()).not.toBe('');
  });

  it('mantiene los chips históricos y refresca el detalle después de asignar un rol', async () => {
    await abrir(12);
    expect(fixture.nativeElement.textContent).toContain('Residente');
    const instancia: unknown = fixture.debugElement.query(
      By.directive(AsignacionRolesUsuario),
    ).componentInstance;
    if (!(instancia instanceof AsignacionRolesUsuario)) throw new Error('Falta asignación');
    instancia['roleId'].set(3);
    formulario['form'].controls.password.setValue('borrador');
    instancia['asignarRol']();
    instancia['asignarRol']();
    const req = http.expectOne(`${BASE}/usuarios/12/roles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idRoles: [3] });
    formulario['guardar']();
    http.expectNone((req) => req.method === 'PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne(`${BASE}/usuarios/12`)
      .flush({ ...USUARIO, roles: [{ nombreRol: 'Residente' }] });
    await fixture.whenStable();
    expect(formulario['form'].controls.password.value).toBe('');
    expect(formulario['rolesAsignados']()).toEqual([{ nombreRol: 'Residente' }]);
    expect(formulario['asignando']()).toBe(false);
  });

  it('impide guardar un detalle fallido y permite recuperarlo', async () => {
    fixture.componentRef.setInput('idUsuario', 12);
    fixture.detectChanges();
    http.expectOne(`${BASE}/roles`).flush({ roles: [] });
    http.expectOne(`${BASE}/usuarios/12`).flush(null, { status: 500, statusText: 'Error' });
    formulario['guardar']();
    http.expectNone((req) => req.method === 'PUT');
    formulario['cargarDetalle']();
    http.expectOne(`${BASE}/usuarios/12`).flush(USUARIO);
    await fixture.whenStable();
    expect(formulario['listo']()).toBe(true);
    expect(formulario['errorDetalle']()).toBe('');
  });

  it('cancela el detalle anterior al cambiar de usuario y al destruir el editor', () => {
    fixture.componentRef.setInput('idUsuario', 12);
    fixture.detectChanges();
    http.expectOne(`${BASE}/roles`).flush({ roles: [] });
    const anterior = http.expectOne(`${BASE}/usuarios/12`);
    fixture.componentRef.setInput('idUsuario', 13);
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    const actual = http.expectOne(`${BASE}/usuarios/13`);
    fixture.destroy();
    expect(actual.cancelled).toBe(true);
  });

  it('limpia el formulario de alta sin depender de un cambio de identificador', async () => {
    await abrir();
    formulario['form'].setValue(BORRADOR);
    formulario['limpiar']();
    expect(formulario['form'].controls.password.value).toBe('');
    expect(formulario['form'].controls.nombres.value).toBe('');
    expect(formulario['listo']()).toBe(true);
  });
});
