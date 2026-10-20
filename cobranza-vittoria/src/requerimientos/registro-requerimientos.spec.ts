import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegistroRequerimientos } from './registro-requerimientos';
import { environment } from '../core/config/environment';
import {
  RequerimientoItemPatchRequest,
  RequerimientoItemResponse,
  RequerimientoRequest,
} from './contratos-requerimientos';

describe('RegistroRequerimientos — ítems de almacén', () => {
  let service: RegistroRequerimientos;
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

    service = TestBed.inject(RegistroRequerimientos);
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

  it('lista con filtros de estado, especialidad y proyecto, omitiendo los nulos', () => {
    service.listar({ estado: 'Registrado', idEspecialidad: 4, idProyecto: 6 }).subscribe();

    const request = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/api/compras/requerimientos`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['estado', 'idEspecialidad', 'idProyecto']);
    expect(request.request.params.get('estado')).toBe('Registrado');
    expect(request.request.params.get('idEspecialidad')).toBe('4');
    expect(request.request.params.get('idProyecto')).toBe('6');

    request.flush([]);

    service.listar({ estado: '', idProyecto: null, idEspecialidad: null }).subscribe();

    http.expectOne(`${environment.apiUrl}/api/compras/requerimientos`).flush([]);
  });

  it('lee el detalle sin transformar su envoltorio ni las validaciones', () => {
    const respuesta = {
      requerimiento: { idRequerimiento: 45 },
      items: [],
      validaciones: [{ fechaValidacion: '2026-10-20T12:00:00Z' }],
      puedeEditar: false,
    };

    const recibido = vi.fn();

    service.obtener(45).subscribe(recibido);

    const request = http.expectOne(`${environment.apiUrl}/api/compras/requerimientos/45`);

    expect(request.request.method).toBe('GET');

    request.flush(respuesta);

    expect(recibido).toHaveBeenCalledWith(respuesta);
  });

  it('crea y reemplaza el borrador con su DTO vigente y conserva null de las partidas', () => {
    const dto: RequerimientoRequest = {
      numeroRequerimiento: '46',
      fechaRequerimiento: '2026-10-20T00:00:00Z',
      fechaEntrega: null,
      idProyecto: 6,
      descripcion: '',
      observacion: null,
      items: [{ idMaterial: 93, cantidad: 2.5, idPresupuestoDetalle: null }],
    };

    service.crear(dto).subscribe();

    const alta = http.expectOne(`${environment.apiUrl}/api/compras/requerimientos`);

    expect(alta.request.method).toBe('POST');
    expect(alta.request.body).toEqual(dto);
    expect(alta.request.body).not.toHaveProperty('idEspecialidad');
    expect(alta.request.body).not.toHaveProperty('idUsuarioSolicitante');

    alta.flush({ idRequerimiento: 46 });

    service.actualizar(46, dto).subscribe();

    const edicion = http.expectOne(`${environment.apiUrl}/api/compras/requerimientos/46`);

    expect(edicion.request.method).toBe('PUT');
    expect(edicion.request.body).toEqual(dto);

    edicion.flush({ ok: true });
  });

  it.each([
    ['enviar', 'enviar'],
    ['aprobar', 'aprobar'],
    ['rechazar', 'rechazar'],
    ['enviarCompras', 'enviar-compras'],
  ] as const)('usa POST para la operación %s y su observación', (operacion, ruta) => {
    service[operacion](45, { observacion: 'Explicación' }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/api/compras/requerimientos/45/${ruta}`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ observacion: 'Explicación' });

    request.flush({ ok: true });
  });

  it.each(['Conforme', 'Observado'] as const)('procesa almacén con resultado %s', (resultado) => {
    service
      .validarAlmacen(45, { resultado, observacion: resultado === 'Observado' ? 'Revisar' : null })
      .subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/api/compras/requerimientos/45/validacion-almacen`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      resultado,
      observacion: resultado === 'Observado' ? 'Revisar' : null,
    });

    request.flush({ ok: true });
  });
});
