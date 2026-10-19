import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoUnidadesMedida } from './catalogo-unidades-medida';
import { environment } from '../../core/config/environment';
import { UNIDAD, UNIDAD_REQUEST } from '../pruebas/muestras-catalogos';

const BASE = `${environment.apiUrl}/api/maestra/unidades-medida`;

describe('CatalogoUnidadesMedida', () => {
  let api: CatalogoUnidadesMedida;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CatalogoUnidadesMedida);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista respetando camelCase y el filtro false', () => {
    const recibido = vi.fn<(datos: (typeof UNIDAD)[]) => void>();
    api.unidadesMedida(false).subscribe(recibido);
    const peticion = http.expectOne(`${BASE}?activo=false`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([UNIDAD]);
    expect(recibido).toHaveBeenCalledWith([UNIDAD]);
  });
  it('omite el filtro nulo', () => {
    api.unidadesMedida(null).subscribe();
    http.expectOne(BASE).flush([]);
  });
  it('crea con POST y devuelve el identificador', () => {
    const recibido = vi.fn<(datos: { idUnidadMedida: number }) => void>();
    api.guardarUnidadMedida(UNIDAD_REQUEST).subscribe(recibido);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(UNIDAD_REQUEST);
    peticion.flush({ idUnidadMedida: 2 });
    expect(recibido).toHaveBeenCalledWith({ idUnidadMedida: 2 });
  });
  it('actualiza con PUT al recurso identificado', () => {
    const dto = { ...UNIDAD_REQUEST, idUnidadMedida: 2 };
    api.guardarUnidadMedida(dto).subscribe();
    const peticion = http.expectOne(`${BASE}/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ idUnidadMedida: 2 });
  });
  it('propaga errores HTTP al consumidor', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    api.unidadesMedida().subscribe({ error: fallo });
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
});
