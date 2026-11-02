import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../core/config/environment';
import { RegistroRoles } from './registro-roles';

describe('RegistroRoles', () => {
  let service: RegistroRoles;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RegistroRoles);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('extrae roles cuando el backend responde con una envoltura', () => {
    const roles = [{ idRol: 1, nombre: 'Administrador', activo: true }];
    service.roles().subscribe((response) => expect(response).toMatchObject(roles));

    http.expectOne(`${environment.apiUrl}/api/seguridad/roles`).flush({ roles });
  });

  it('acepta también un arreglo directo dentro de data', () => {
    const roles = [{ idRol: 2, nombre: 'Residente', activo: true }];
    service.roles().subscribe((response) => expect(response).toMatchObject(roles));

    http.expectOne(`${environment.apiUrl}/api/seguridad/roles`).flush({ data: roles });
  });

  it('obtiene el rol junto con sus permisos asignados', () => {
    const response = {
      idRol: 3,
      nombre: 'Residente',
      descripcion: 'Rol para residentes de obra',
      activo: true,
      permisos: [{ idPermiso: 10, codigo: 'requerimientos.ver', nombre: 'Ver requerimientos' }],
    };
    service.obtenerRolConPermisos(3).subscribe((result) => expect(result).toEqual(response));

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
