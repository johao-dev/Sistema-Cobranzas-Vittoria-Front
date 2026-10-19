import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoMateriales } from './catalogo-materiales';
import { environment } from '../../core/config/environment';
import { MATERIAL, MATERIAL_REQUEST } from '../pruebas/muestras-catalogos';

const BASE = `${environment.apiUrl}/api/maestra/materiales`;

describe('CatalogoMateriales', () => {
  let api: CatalogoMateriales;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CatalogoMateriales);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista respetando camelCase y el filtro false', () => {
    const recibido = vi.fn<(datos: (typeof MATERIAL)[]) => void>();
    api.materiales(false).subscribe(recibido);
    const peticion = http.expectOne(`${BASE}?activo=false`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([MATERIAL]);
    expect(recibido).toHaveBeenCalledWith([MATERIAL]);
  });
  it('omite el filtro nulo', () => {
    api.materiales(null).subscribe();
    http.expectOne(BASE).flush([]);
  });
  it('crea con POST y devuelve el identificador', () => {
    const recibido = vi.fn<(datos: { idMaterial: number }) => void>();
    api.guardarMaterial(MATERIAL_REQUEST).subscribe(recibido);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(MATERIAL_REQUEST);
    peticion.flush({ idMaterial: 2 });
    expect(recibido).toHaveBeenCalledWith({ idMaterial: 2 });
  });
  it('actualiza con PUT al recurso identificado', () => {
    const dto = { ...MATERIAL_REQUEST, idMaterial: 2 };
    api.guardarMaterial(dto).subscribe();
    const peticion = http.expectOne(`${BASE}/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ idMaterial: 2 });
  });
  it('propaga errores HTTP al consumidor', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    api.materiales().subscribe({ error: fallo });
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
  it('conserva la partida en el PUT y normaliza textos sin cambiar importes', () => {
    api
      .guardarMaterial({
        ...MATERIAL_REQUEST,
        idMaterial: 1,
        codigo: ' M1 ',
        descripcion: ' Cemento ',
        unidadMedida: ' KG ',
        stockMinimo: 1.25,
      })
      .subscribe();
    const peticion = http.expectOne(`${BASE}/1`);
    expect(peticion.request.body).toMatchObject({
      codigo: 'M1',
      descripcion: 'Cemento',
      unidadMedida: 'KG',
      stockMinimo: 1.25,
      idCatalogoPartida: 7,
    });
    peticion.flush({ idMaterial: 1 });
  });
  it('obtiene el detalle y el siguiente código por sus endpoints propios', () => {
    api.material(1).subscribe((datos) => expect(datos).toEqual(MATERIAL));
    http.expectOne(`${BASE}/1`).flush(MATERIAL);
    api.siguienteCodigo().subscribe((datos) => expect(datos.codigo).toBe('M2'));
    http.expectOne(`${BASE}/siguiente-codigo`).flush({ codigo: 'M2' });
  });
  it('envía especialidad sin perder un filtro de activo false', () => {
    api.materiales(false, 2).subscribe();
    http.expectOne(`${BASE}?activo=false&idEspecialidad=2`).flush([]);
  });
});
