import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { environment } from '../../../core/config/environment';
import { PermisoAsignadoResponse } from '../contratos-roles';
import { AsignacionPermisosRol } from './asignacion-permisos-rol';

const BASE = `${environment.apiUrl}/api/seguridad`;
const PERMISO = { idPermiso: 10, codigo: 'compras.ver', nombre: 'Ver compras' };
const INACTIVO = { idPermiso: 11, codigo: 'anterior.ver', nombre: 'Permiso anterior' };
const ROL = {
  idRol: 3,
  nombre: 'Residente',
  descripcion: 'Obras',
  activo: true,
  permisos: [PERMISO, INACTIVO],
};

describe('AsignacionPermisosRol', () => {
  let fixture: ComponentFixture<AsignacionPermisosRol>;
  let asignacion: AsignacionPermisosRol;
  let http: HttpTestingController;
  const notificaciones = { show: vi.fn() };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AsignacionPermisosRol],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Notificaciones, useValue: notificaciones },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AsignacionPermisosRol);
    asignacion = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('rol', ROL);
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    notificaciones.show.mockReset();
  });
  async function cargar(permisos: PermisoAsignadoResponse[] = ROL.permisos): Promise<void> {
    fixture.componentRef.setInput('rol', { ...ROL, permisos });
    fixture.detectChanges();
    http
      .expectOne(`${BASE}/permisos?activo=true`)
      .flush({ permisos: [{ ...PERMISO, descripcion: '', activo: true }] });
    await fixture.whenStable();
  }

  it('conserva asignaciones que no figuran en el catálogo activo y avisa sobre claims', async () => {
    await cargar();
    expect(fixture.nativeElement.textContent).toContain('Permiso anterior');
    asignacion['asignarPermisos']();
    const req = http.expectOne(`${BASE}/roles/3/permisos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idPermisos: [10, 11] });
    asignacion['asignarPermisos']();
    http.expectNone(`${BASE}/roles/3/permisos`);
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${BASE}/roles/3/permisos`).flush(ROL);
    expect(notificaciones.show).toHaveBeenCalledWith(
      expect.stringContaining('claims'),
      'success',
      5000,
    );
    expect(asignacion['guardando']()).toBe(false);
  });

  it('retira el último permiso por DELETE y sincroniza los chips', async () => {
    await cargar([PERMISO]);
    asignacion['quitarPermiso'](PERMISO);
    const req = http.expectOne(`${BASE}/roles/3/permisos/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${BASE}/roles/3/permisos`).flush({ ...ROL, permisos: [] });
    await fixture.whenStable();
    expect(asignacion['asignados']()).toEqual([]);
    expect(asignacion['seleccionados']().size).toBe(0);
    asignacion['asignarPermisos']();
    http.expectNone((req) => req.method === 'POST');
    expect(notificaciones.show).toHaveBeenCalledWith(expect.stringContaining('botón ×'), 'info');
  });

  it('distingue un cambio guardado de un fallo al consultar y reintenta solo la consulta', async () => {
    await cargar();
    asignacion['asignarPermisos']();
    http
      .expectOne(`${BASE}/roles/3/permisos`)
      .flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne(`${BASE}/roles/3/permisos`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('El cambio se guardó');
    asignacion['asignarPermisos']();
    http.expectNone((req) => req.method === 'POST');
    asignacion['sincronizar']();
    http.expectOne(`${BASE}/roles/3/permisos`).flush({ ...ROL, permisos: [PERMISO] });
    expect(asignacion['errorSincronizacion']()).toBe('');
    expect([...asignacion['seleccionados']()]).toEqual([10]);
    http.expectNone((req) => req.method === 'POST');
  });

  it('restaura controles y mantiene la selección ante un rechazo de escritura', async () => {
    await cargar();
    asignacion['asignarPermisos']();
    http
      .expectOne(`${BASE}/roles/3/permisos`)
      .flush({ message: 'Operación rechazada' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(asignacion['guardando']()).toBe(false);
    expect(asignacion['deshabilitado']()).toBe(false);
    expect([...asignacion['seleccionados']()]).toEqual([10, 11]);
    expect(notificaciones.show).toHaveBeenCalledWith('Operación rechazada', 'error');
  });

  it('bloquea escrituras mientras falla el catálogo y permite reintentarlo', async () => {
    fixture.detectChanges();
    http
      .expectOne(`${BASE}/permisos?activo=true`)
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    asignacion['asignarPermisos']();
    http.expectNone((req) => req.method === 'POST');
    expect(asignacion['errorCatalogo']()).not.toBe('');
    asignacion['cargarCatalogo']();
    await cargar();
    expect(asignacion['deshabilitado']()).toBe(false);
  });

  it('cancela la escritura al destruir el componente y no inicia una lectura posterior', async () => {
    await cargar();
    asignacion['asignarPermisos']();
    const req = http.expectOne(`${BASE}/roles/3/permisos`);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
    http.expectNone((req) => req.method === 'GET');
  });
});
