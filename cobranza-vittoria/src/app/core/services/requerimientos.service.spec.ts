import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequerimientosService } from './requerimientos.service';
import { environment } from '../../../core/config/environment';
import {
  RequerimientoItemPatchRequest,
  RequerimientoItemResponse,
} from '../../models/requerimientos.models';

describe('RequerimientosService — ítems de almacén', () => {
  let service: RequerimientosService;
  let http: HttpTestingController;
  const endpoint: string = `${environment.apiUrl}/api/compras/requerimientos/45/items`;
  const persistido: RequerimientoItemResponse = {
    idRequerimientoDetalle: 710,
    idRequerimiento: 45,
    idMaterial: 93,
    cantidad: 2.5,
    idPresupuestoDetalle: null,
    observacion: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequerimientosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('agrega con POST y entrega la fila persistida del 201', () => {
    const recibido = vi.fn();
    service.agregarItem(45, { idMaterial: 93, cantidad: 2.5 }).subscribe(recibido);

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ idMaterial: 93, cantidad: 2.5 });
    request.flush(persistido, { status: 201, statusText: 'Created' });
    expect(recibido).toHaveBeenCalledWith(persistido);
  });

  it.each<RequerimientoItemPatchRequest>([
    { cantidad: 3 },
    { idPresupuestoDetalle: null },
    { observacion: null },
    { idPresupuestoDetalle: 18, observacion: 'Revisado' },
  ])('preserva omisiones y null del PATCH %j usando el ID del detalle', (cambios) => {
    service.actualizarItem(45, 710, cambios).subscribe();

    const request = http.expectOne(`${endpoint}/710`);
    expect(request.request.method).toBe('PATCH');
    expect(JSON.parse(JSON.stringify(request.request.body))).toEqual(cambios);
    expect(request.request.body).not.toHaveProperty('idMaterial');
    request.flush(persistido);
  });

  it('elimina con DELETE y acepta 204 sin cuerpo', () => {
    const recibido = vi.fn();
    service.eliminarItem(45, 710).subscribe(recibido);

    const request = http.expectOne(`${endpoint}/710`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(recibido).toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404, 409])('propaga el error HTTP %i', (status) => {
    const error = vi.fn();
    service.actualizarItem(45, 710, { cantidad: 3 }).subscribe({ error });

    http.expectOne(`${endpoint}/710`).flush(
      { message: 'Operación rechazada' },
      {
        status,
        statusText: 'Error',
      },
    );
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });
});
