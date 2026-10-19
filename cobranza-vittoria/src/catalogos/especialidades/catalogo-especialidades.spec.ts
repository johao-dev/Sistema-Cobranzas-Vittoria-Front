import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoEspecialidades } from './catalogo-especialidades';
import { environment } from '../../core/config/environment';
import { ESPECIALIDAD, ESPECIALIDAD_REQUEST } from '../pruebas/muestras-catalogos';

const BASE = `${environment.apiUrl}/api/maestra/especialidades`;

describe('CatalogoEspecialidades', () => {
  let api: CatalogoEspecialidades;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CatalogoEspecialidades);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista respetando camelCase y el filtro false', () => {
    const recibido = vi.fn<(datos: (typeof ESPECIALIDAD)[]) => void>();
    api.especialidades(false).subscribe(recibido);
    const peticion = http.expectOne(`${BASE}?activo=false`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([ESPECIALIDAD]);
    expect(recibido).toHaveBeenCalledWith([ESPECIALIDAD]);
  });
  it('omite el filtro nulo', () => {
    api.especialidades(null).subscribe();
    http.expectOne(BASE).flush([]);
  });
  it('crea con POST y devuelve el identificador', () => {
    const recibido = vi.fn<(datos: { idEspecialidad: number }) => void>();
    api.guardarEspecialidad(ESPECIALIDAD_REQUEST).subscribe(recibido);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(ESPECIALIDAD_REQUEST);
    peticion.flush({ idEspecialidad: 2 });
    expect(recibido).toHaveBeenCalledWith({ idEspecialidad: 2 });
  });
  it('actualiza con PUT al recurso identificado', () => {
    const dto = { ...ESPECIALIDAD_REQUEST, idEspecialidad: 2 };
    api.guardarEspecialidad(dto).subscribe();
    const peticion = http.expectOne(`${BASE}/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ idEspecialidad: 2 });
  });
  it('propaga errores HTTP al consumidor', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    api.especialidades().subscribe({ error: fallo });
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
});
