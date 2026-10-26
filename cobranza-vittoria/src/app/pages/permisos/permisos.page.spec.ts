import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../core/config/environment';
import { NotificationService } from '../../core/services/notification.service';
import { Permiso } from '../../models/permisos.models';
import { PermisosPage } from './permisos.page';

const PERMISO: Permiso = {
  idPermiso: 12,
  codigo: 'compras.ver',
  nombre: 'Ver compras',
  descripcion: 'Permite consultar compras.',
  activo: true,
  fechaCreacion: null,
  usuarioCreacion: null,
  fechaModificacion: null,
  usuarioModificacion: null,
};
const RUTA = `${environment.apiUrl}/api/seguridad/permisos`;

function errorEstado(codigo: string, mensaje: string): object {
  return {
    ok: false,
    error: 'DATOS_INVALIDOS',
    errores: [{ campo: 'Activo', codigoError: codigo, mensaje }],
  };
}

describe('PermisosPage con contrato de permisos y sin Zone.js', () => {
  let fixture: ComponentFixture<PermisosPage>;
  let pagina: PermisosPage;
  let raiz: HTMLElement;
  let http: HttpTestingController;
  const notificaciones = { show: vi.fn() };

  beforeEach(async () => {
    // jsdom no implementa el diálogo modal del navegador.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    await TestBed.configureTestingModule({
      imports: [PermisosPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificaciones },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PermisosPage);
    pagina = fixture.componentInstance;
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('Falta la página');
    raiz = elemento;
    fixture.detectChanges();
    http.expectOne(`${RUTA}?activo=true`).flush({ permisos: [{ ...PERMISO }] });
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    notificaciones.show.mockReset();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  function elemento<T extends Element>(selector: string): T {
    const encontrado = raiz.querySelector<T>(selector);
    if (!encontrado) throw new Error(`Falta ${selector}`);
    return encontrado;
  }

  function cambiarToggle(activo: boolean): HTMLInputElement {
    const toggle = elemento<HTMLInputElement>('input[type="checkbox"]');
    toggle.checked = activo;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    return toggle;
  }

  async function filtrarDeshabilitados(): Promise<void> {
    const select = elemento<HTMLSelectElement>('#estado-permisos');
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    http.expectOne(`${RUTA}?activo=false`).flush({ permisos: [{ ...PERMISO, activo: false }] });
    await fixture.whenStable();
  }

  async function editar(): Promise<void> {
    elemento<HTMLButtonElement>('.permiso-card__menu-btn').click();
    await fixture.whenStable();
    elemento<HTMLButtonElement>('.permiso-card__menu-item').click();
    await fixture.whenStable();
  }

  it('muestra habilitados por defecto y elimina las opciones de crear y eliminar', async () => {
    expect(pagina.filtroActivo).toBe(true);
    expect(elemento<HTMLInputElement>('input[type="checkbox"]').checked).toBe(true);
    elemento<HTMLButtonElement>('.permiso-card__menu-btn').click();
    await fixture.whenStable();
    const botones = Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(botones).not.toContain('Nuevo');
    expect(botones).not.toContain('Eliminar');
    expect(botones).toContain('Editar');
  });

  it('cancela la confirmación sin cambiar el switch ni enviar solicitudes', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const toggle = cambiarToggle(false);
    await fixture.whenStable();
    expect(toggle.checked).toBe(true);
    expect(pagina.permisosListado[0].activo).toBe(true);
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('deshabilita sin cambio optimista, bloquea duplicados y refresca el filtro al recibir 204', async () => {
    const toggle = cambiarToggle(false);
    const request = http.expectOne(`${RUTA}/12/disable`);
    expect(toggle.checked).toBe(true);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toBeNull();
    pagina.onToggle(pagina.permisosListado[0], false);
    http.expectNone(`${RUTA}/12/disable`);
    await fixture.whenStable();
    expect(toggle.disabled).toBe(true);
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${RUTA}?activo=true`).flush({ permisos: [] });
    await fixture.whenStable();
    expect(pagina.cambiandoEstado).toBeNull();
    expect(raiz.querySelector('app-permiso-card')).toBeNull();
  });

  it('filtra deshabilitados y los habilita con el endpoint correspondiente', async () => {
    await filtrarDeshabilitados();
    expect(elemento<HTMLInputElement>('input[type="checkbox"]').checked).toBe(false);
    cambiarToggle(true);
    const request = http.expectOne(`${RUTA}/12/enable`);
    expect(request.request.method).toBe('PATCH');
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${RUTA}?activo=false`).flush({ permisos: [] });
    await fixture.whenStable();
    expect(pagina.filtroActivo).toBe(false);
    expect(pagina.permisosListado).toEqual([]);
  });

  it('restaura la interacción y conserva el estado cuando falla el PATCH', async () => {
    cambiarToggle(false);
    http
      .expectOne(`${RUTA}/12/disable`)
      .flush({ message: 'Operación rechazada' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(elemento<HTMLInputElement>('input[type="checkbox"]').checked).toBe(true);
    expect(elemento<HTMLInputElement>('input[type="checkbox"]').disabled).toBe(false);
    expect(notificaciones.show).toHaveBeenCalledWith('Operación rechazada', 'error');
  });

  it.each([
    [true, 'disable', 'PERMISO_YA_DESHABILITADO', false],
    [false, 'enable', 'PERMISO_YA_HABILITADO', true],
  ] as const)(
    'sincroniza el error de estado repetido %s sin repetir el PATCH',
    async (activo, endpoint, codigo, nuevoEstado) => {
      if (!activo) await filtrarDeshabilitados();
      cambiarToggle(!activo);
      http
        .expectOne(`${RUTA}/12/${endpoint}`)
        .flush(errorEstado(codigo, 'El estado ya cambió.'), {
          status: 422,
          statusText: 'Unprocessable Entity',
        });
      http.expectOne(`${RUTA}/12`).flush({ ...PERMISO, activo: nuevoEstado });
      await fixture.whenStable();
      expect(pagina.permisosListado).toEqual([]);
      expect(notificaciones.show).toHaveBeenCalledWith(
        expect.stringContaining('El estado ya cambió.'),
        'error',
      );
      http.expectNone((request) => request.method === 'PATCH');
    },
  );

  it('edita un permiso deshabilitado enviando solo nombre y descripción', async () => {
    await filtrarDeshabilitados();
    await editar();
    expect(raiz.querySelector('input[name="codigo"]')).toBeNull();
    expect(raiz.querySelectorAll('dialog input')).toHaveLength(2);
    expect(elemento<HTMLInputElement>('#nombre-permiso').maxLength).toBe(100);
    expect(elemento<HTMLInputElement>('#descripcion-permiso').maxLength).toBe(255);
    pagina.form = { nombre: '  Consultar compras  ', descripcion: '' };
    pagina.save();
    const request = http.expectOne(`${RUTA}/12`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ nombre: 'Consultar compras', descripcion: '' });
    pagina.save();
    http.expectNone(`${RUTA}/12`);
    request.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne(`${RUTA}?activo=false`)
      .flush({
        permisos: [{ ...PERMISO, nombre: 'Consultar compras', descripcion: '', activo: false }],
      });
    await fixture.whenStable();
    expect(pagina.modalOpen).toBe(false);
    expect(pagina.permisosListado[0].activo).toBe(false);
  });

  it.each([
    { nombre: '   ', descripcion: '' },
    { nombre: 'a'.repeat(101), descripcion: '' },
    { nombre: 'Consultar compras', descripcion: 'a'.repeat(256) },
  ])('rechaza nombre vacío y longitudes fuera del contrato: $nombre', async (formulario) => {
    await editar();
    pagina.form = formulario;
    pagina.save();
    http.expectNone((request) => request.method === 'PUT');
    expect(pagina.modalOpen).toBe(true);
    expect(pagina.msg).not.toBe('');
  });

  it('preserva el formulario y muestra errores de validación del servidor', async () => {
    await editar();
    pagina.form.nombre = 'Nombre modificado';
    pagina.save();
    http
      .expectOne(`${RUTA}/12`)
      .flush(
        { errors: { Nombre: ['Nombre inválido.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(pagina.modalOpen).toBe(true);
    expect(pagina.form.nombre).toBe('Nombre modificado');
    expect(pagina.guardando).toBe(false);
    expect(raiz.textContent).toContain('Nombre inválido.');
  });

  it('mantiene la búsqueda al cambiar de estado y cancela consultas sustituidas', async () => {
    pagina.filtroBusqueda = 'compras';
    pagina.load();
    const anterior = http.expectOne(`${RUTA}?activo=true`);
    await filtrarDeshabilitados();
    expect(anterior.cancelled).toBe(true);
    expect(pagina.filtroBusqueda).toBe('compras');
    expect(pagina.rowsFiltradas).toHaveLength(1);
  });

  it('distingue el error del listado vacío y permite reintentar', async () => {
    pagina.load();
    http.expectOne(`${RUTA}?activo=true`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(pagina.errorListado).not.toBe('');
    expect(raiz.textContent).not.toContain('No hay acciones que coincidan');
    const reintentar = Array.from(raiz.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reintentar',
    );
    reintentar?.click();
    http.expectOne(`${RUTA}?activo=true`).flush({ permisos: [] });
    await fixture.whenStable();
    expect(pagina.errorListado).toBe('');
    expect(raiz.textContent).toContain('No hay acciones que coincidan');
  });
});
