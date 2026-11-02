import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../core/config/environment';
import { RegistroUsuarios } from './registro-usuarios';

describe('RegistroUsuarios', () => {
  let service: RegistroUsuarios;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RegistroUsuarios);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('extrae usuarios cuando el backend responde con data anidada', () => {
    const usuarios = [{ idUsuario: 1, usuarioLogin: 'admin', activo: true }];
    service.usuarios().subscribe((response) => expect(response).toMatchObject(usuarios));

    http.expectOne(`${environment.apiUrl}/api/seguridad/usuarios`).flush({ data: { usuarios } });
  });

  it('envía el contrato de creación con password', () => {
    const dto = {
      nombres: 'Juan',
      apellidos: 'Pérez',
      correo: 'juan@correo.com',
      usuarioLogin: 'jperez',
      password: 'secreto',
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
});
