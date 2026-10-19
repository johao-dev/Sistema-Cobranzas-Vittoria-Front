import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoProveedores } from './catalogo-proveedores';
import { environment } from '../../core/config/environment';
import { PROVEEDOR, PROVEEDOR_REQUEST } from '../pruebas/muestras-catalogos';

const BASE = `${environment.apiUrl}/api/maestra/proveedores`;

describe('CatalogoProveedores', () => {
  let api: CatalogoProveedores;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CatalogoProveedores);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista respetando camelCase y el filtro false', () => {
    const recibido = vi.fn<(datos: (typeof PROVEEDOR)[]) => void>();
    api.proveedores(false).subscribe(recibido);
    const peticion = http.expectOne(`${BASE}?activo=false`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([PROVEEDOR]);
    expect(recibido).toHaveBeenCalledWith([PROVEEDOR]);
  });
  it('omite el filtro nulo', () => {
    api.proveedores(null).subscribe();
    http.expectOne(BASE).flush([]);
  });
  it('crea con POST y devuelve el identificador', () => {
    const recibido = vi.fn<(datos: { idProveedor: number }) => void>();
    api.guardarProveedor(PROVEEDOR_REQUEST).subscribe(recibido);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(PROVEEDOR_REQUEST);
    peticion.flush({ idProveedor: 2 });
    expect(recibido).toHaveBeenCalledWith({ idProveedor: 2 });
  });
  it('actualiza con PUT al recurso identificado', () => {
    const dto = { ...PROVEEDOR_REQUEST, idProveedor: 2 };
    api.guardarProveedor(dto).subscribe();
    const peticion = http.expectOne(`${BASE}/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ idProveedor: 2 });
  });
  it('propaga errores HTTP al consumidor', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    api.proveedores().subscribe({ error: fallo });
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
  it('conserva el envoltorio de proveedor y sus especialidades', () => {
    const respuesta = { proveedor: PROVEEDOR, especialidades: [] };
    api.proveedor(1).subscribe((datos) => expect(datos).toEqual(respuesta));
    http.expectOne(`${BASE}/1`).flush(respuesta);
  });
  it('consulta SUNAT y conserva sus nombres de campo', () => {
    api
      .consultaRuc('20123456789')
      .subscribe((datos) => expect(datos.razon_social).toBe('Proveedor'));
    http.expectOne(`${BASE}/consulta-ruc/20123456789`).flush({
      razon_social: 'Proveedor',
      numero_documento: '20123456789',
      direccion: '',
      estado: 'ACTIVO',
    });
  });
  it('mantiene filtros por especialidad y la asociación sin inventar filtros de tipo de proveedor', () => {
    api.proveedores(true, 2).subscribe();
    http.expectOne(`${BASE}?activo=true&idEspecialidad=2`).flush([]);
    const dto = { idProveedor: 1, idEspecialidad: 2, activo: true };
    api.setProveedorEspecialidad(1, dto).subscribe();
    const peticion = http.expectOne(`${BASE}/1/especialidades`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ ok: true });
  });
});
