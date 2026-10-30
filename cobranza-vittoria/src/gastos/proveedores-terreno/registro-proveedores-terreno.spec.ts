import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../core/config/environment';
import { ProveedorTerrenoUpsert } from './contratos-proveedores-terreno';
import { RegistroProveedoresTerreno } from './registro-proveedores-terreno';

describe('RegistroProveedoresTerreno: contrato HTTP específico', () => {
  let servicio: RegistroProveedoresTerreno;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/maestra/proveedores-terreno`;
  const dto: ProveedorTerrenoUpsert = {
    idProveedorTerreno: null,
    razonSocial: 'Proveedor',
    ruc: '',
    contacto: '',
    telefono: '',
    correo: '',
    activo: true,
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(RegistroProveedoresTerreno);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('conserva filtro false y omite filtros no seleccionados', () => {
    servicio.listar(false).subscribe();
    const filtro = http.expectOne(`${base}?activo=false`);
    expect(filtro.request.method).toBe('GET');
    filtro.flush([]);
    servicio.listar(null).subscribe();
    http.expectOne(base).flush([]);
  });
  it('crea y actualiza usando únicamente su identificador y contrato', () => {
    const respuesta = vi.fn();
    servicio.guardar(dto).subscribe(respuesta);
    const crear = http.expectOne(base);
    expect(crear.request.method).toBe('POST');
    expect(crear.request.body).toEqual(dto);
    crear.flush({ idProveedorTerreno: 9 });
    expect(respuesta).toHaveBeenLastCalledWith({ idProveedorTerreno: 9 });
    servicio.guardar({ ...dto, idProveedorTerreno: 9 }).subscribe();
    const editar = http.expectOne(`${base}/9`);
    expect(editar.request.method).toBe('PUT');
    editar.flush({ idProveedorTerreno: 9 });
  });
  it('desactiva sin confundir IDs y propaga errores', () => {
    const error = vi.fn();
    servicio.desactivar(9).subscribe({ error });
    const eliminar = http.expectOne(`${base}/9`);
    expect(eliminar.request.method).toBe('DELETE');
    eliminar.flush({ message: 'Registro vinculado' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });
});
