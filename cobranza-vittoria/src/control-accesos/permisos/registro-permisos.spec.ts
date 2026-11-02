import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../core/config/environment';
import { RegistroPermisos } from './registro-permisos';

describe('RegistroPermisos', () => {
  let service: RegistroPermisos;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RegistroPermisos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta permisos con filtro booleano explícito y conserva el valor por defecto de la API', () => {
    service.permisos(false).subscribe((response) => expect(response.permisos).toEqual([]));
    const filtrada = http.expectOne(`${environment.apiUrl}/api/seguridad/permisos?activo=false`);
    expect(filtrada.request.method).toBe('GET');
    filtrada.flush({ permisos: [] });

    service.permisos().subscribe();
    http.expectOne(`${environment.apiUrl}/api/seguridad/permisos`).flush({ permisos: [] });
  });

  it('habilita un permiso con PATCH sin cuerpo y acepta 204', () => {
    let respondio = false;
    service.habilitarPermiso(12).subscribe(() => {
      respondio = true;
    });
    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/permisos/12/enable`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(respondio).toBe(true);
  });

  it('deshabilita un permiso con PATCH sin cuerpo y acepta 204', () => {
    service.deshabilitarPermiso(12).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/permisos/12/disable`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('actualiza únicamente nombre y descripción mediante PUT', () => {
    service.actualizarPermiso(12, { nombre: 'Consultar compras', descripcion: '' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/permisos/12`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ nombre: 'Consultar compras', descripcion: '' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
