import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../core/config/environment';
import { CatalogoCentrosCosto } from './catalogo-centros-costo';

describe('CatalogoCentrosCosto: creación y reemplazo', () => {
  let catalogo: CatalogoCentrosCosto;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/control-presupuestario/centros-costo`;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    catalogo = TestBed.inject(CatalogoCentrosCosto);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('crea un centro de proyecto con ids numéricos y textos recortados', () => {
    catalogo
      .guardarCentroCosto({
        codigo: ' CC ',
        nombre: ' Obra ',
        idTipoCentroCosto: '1',
        idProyecto: '5',
        descripcion: '',
        activo: true,
      })
      .subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      codigo: 'CC',
      nombre: 'Obra',
      idTipoCentroCosto: 1,
      idProyecto: 5,
      descripcion: null,
    });
    req.flush({});
  });
  it('editar conserva campos inmutables y permite limpiar el proyecto', () => {
    catalogo
      .guardarCentroCosto({
        idCentroCosto: 5,
        nombre: ' Oficina ',
        idProyecto: '',
        descripcion: ' Administración ',
        activo: false,
      })
      .subscribe();
    const req = http.expectOne(`${base}/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nombre: 'Oficina',
      idProyecto: null,
      descripcion: 'Administración',
      activo: false,
    });
    req.flush({});
  });
});
