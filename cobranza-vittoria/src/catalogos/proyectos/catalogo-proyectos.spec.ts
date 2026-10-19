import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoProyectos } from './catalogo-proyectos';
import { environment } from '../../core/config/environment';
import { PROYECTO, PROYECTO_REQUEST } from '../pruebas/muestras-catalogos';

const BASE = `${environment.apiUrl}/api/maestra/proyectos`;

describe('CatalogoProyectos', () => {
  let api: CatalogoProyectos;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CatalogoProyectos);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista respetando camelCase y el filtro false', () => {
    const recibido = vi.fn<(datos: (typeof PROYECTO)[]) => void>();
    api.proyectos(false).subscribe(recibido);
    const peticion = http.expectOne(`${BASE}?activo=false`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush([PROYECTO]);
    expect(recibido).toHaveBeenCalledWith([PROYECTO]);
  });
  it('omite el filtro nulo', () => {
    api.proyectos(null).subscribe();
    http.expectOne(BASE).flush([]);
  });
  it('crea con POST y devuelve el identificador', () => {
    const recibido = vi.fn<(datos: { idProyecto: number }) => void>();
    api.guardarProyecto(PROYECTO_REQUEST).subscribe(recibido);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(PROYECTO_REQUEST);
    peticion.flush({ idProyecto: 2 });
    expect(recibido).toHaveBeenCalledWith({ idProyecto: 2 });
  });
  it('actualiza con PUT al recurso identificado', () => {
    const dto = { ...PROYECTO_REQUEST, idProyecto: 2 };
    api.guardarProyecto(dto).subscribe();
    const peticion = http.expectOne(`${BASE}/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(dto);
    peticion.flush({ idProyecto: 2 });
  });
  it('propaga errores HTTP al consumidor', () => {
    const fallo = vi.fn<(error: HttpErrorResponse) => void>();
    api.proyectos().subscribe({ error: fallo });
    http.expectOne(BASE).flush(null, { status: 500, statusText: 'Error' });
    expect(fallo).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
});
