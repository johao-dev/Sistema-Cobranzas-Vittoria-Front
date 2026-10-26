import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../core/config/environment';
import { SeguridadService } from './seguridad.service';

describe('SeguridadService', () => {
  let service: SeguridadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SeguridadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta permisos con filtro booleano explícito y conserva el valor por defecto de la API', () => {
    service.permisos(false).subscribe(response => expect(response.permisos).toEqual([]));
    const filtrada = http.expectOne(`${environment.apiUrl}/api/seguridad/permisos?activo=false`);
    expect(filtrada.request.method).toBe('GET');
    filtrada.flush({ permisos: [] });

    service.permisos().subscribe();
    http.expectOne(`${environment.apiUrl}/api/seguridad/permisos`).flush({ permisos: [] });
  });

  it('habilita un permiso con PATCH sin cuerpo y acepta 204', () => {
    let respondio = false;
    service.habilitarPermiso(12).subscribe(() => { respondio = true; });
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

  it('extrae roles cuando el backend responde con una envoltura', () => {
    const roles = [{ idRol: 1, nombreRol: 'Administrador', activo: true }];
    service.roles().subscribe(response => expect(response).toEqual(roles));

    http.expectOne(`${environment.apiUrl}/api/seguridad/roles`).flush({ roles });
  });

  it('extrae usuarios cuando el backend responde con data anidada', () => {
    const usuarios = [{ idUsuario: 1, usuarioLogin: 'admin', activo: true }];
    service.usuarios().subscribe(response => expect(response).toEqual(usuarios));

    http.expectOne(`${environment.apiUrl}/api/seguridad/usuarios`).flush({ data: { usuarios } });
  });

  it('acepta también un arreglo directo dentro de data', () => {
    const roles = [{ idRol: 2, nombreRol: 'Residente', activo: true }];
    service.roles().subscribe(response => expect(response).toEqual(roles));

    http.expectOne(`${environment.apiUrl}/api/seguridad/roles`).flush({ data: roles });
  });

  it('envía el contrato de creación con password', () => {
    const dto = {
      nombres: 'Juan', apellidos: 'Pérez', correo: 'juan@correo.com', usuarioLogin: 'jperez', password: 'secreto'
    };
    service.crearUsuario(dto).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/usuarios`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(dto);
    request.flush({ idUsuario: 1 });
  });

  it('asigna roles con el arreglo idRoles requerido por la API', () => {
    service.asignarRoles(12, [1, 3, 3]).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/usuarios/12/roles`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ idRoles: [1, 3] });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('obtiene el rol junto con sus permisos asignados', () => {
    const response = {
      idRol: 3,
      nombre: 'Residente',
      descripcion: 'Rol para residentes de obra',
      activo: true,
      permisos: [{ idPermiso: 10, codigo: 'requerimientos.ver', nombre: 'Ver requerimientos' }]
    };
    service.obtenerRolConPermisos(3).subscribe(result => expect(result).toEqual(response));

    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/roles/3/permisos`);
    expect(request.request.method).toBe('GET');
    request.flush(response);
  });

  it('persiste permisos únicos en el payload de asignación', () => {
    service.asignarPermisosRol(3, [10, 10, 11]).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/roles/3/permisos`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ idPermisos: [10, 11] });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('retira un permiso individual del rol', () => {
    service.quitarPermisoRol(3, 10).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/api/seguridad/roles/3/permisos/10`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
