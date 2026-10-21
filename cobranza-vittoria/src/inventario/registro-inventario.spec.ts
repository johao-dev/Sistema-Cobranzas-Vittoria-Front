import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RegistroInventario } from './registro-inventario';
import { ApiService } from '../app/core/services/api.service';
import { entradaPrueba, salidasPrueba, stockPrueba } from './inventario.fixture';
import { borradorEntrada, peticionEntrada } from './entradas/datos-entrada';
import {
  controlesSalida,
  controlesItemSalida,
  itemDesdeSalida,
  peticionSalida,
} from './salidas/datos-salida';

describe('RegistroInventario — contrato HTTP', () => {
  let api: RegistroInventario;
  let http: HttpTestingController;
  let base: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RegistroInventario);
    http = TestBed.inject(HttpTestingController);
    base = TestBed.inject(ApiService).baseUrl + '/api/almacen/kardex';
  });

  afterEach(() => http.verify());

  it('filtra entradas por todas las referencias y omite null y cadenas vacías', () => {
    api
      .listarEntradas({
        idEspecialidad: 2,
        idProveedor: 0,
        idProyecto: null,
        fechaDesde: '2026-10-01',
        fechaHasta: '',
      })
      .subscribe((rows) => expect(rows).toEqual([entradaPrueba]));

    const req = http.expectOne((r) => r.url === base + '/entradas');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['idEspecialidad', 'idProveedor', 'fechaDesde']);
    expect(req.request.params.get('idProveedor')).toBe('0');
    req.flush([entradaPrueba]);
  });

  it.each(['crear', 'actualizar'] as const)(
    '%s entrada conserva IDs, cero y DateOnly',
    (accion) => {
      const dto = peticionEntrada(borradorEntrada(entradaPrueba));
      if (typeof dto === 'string') throw new Error(dto);

      (accion === 'crear' ? api.crearEntrada(dto) : api.actualizarEntrada(1, dto)).subscribe(
        (row) => expect(row).toEqual(entradaPrueba),
      );

      const req = http.expectOne(base + '/entradas' + (accion === 'actualizar' ? '/1' : ''));

      expect(req.request.method).toBe(accion === 'crear' ? 'POST' : 'PUT');
      expect(req.request.body).toEqual({
        idKardexEntrada: 1,
        idMaterial: 10,
        idProveedor: null,
        idProyecto: 3,
        numeroDocumento: null,
        fecha: '2026-10-20',
        cantidad: 0,
        observacion: null,
      });
      req.flush(entradaPrueba);
    },
  );

  it('consulta salidas con cabecera repetida y sin el filtro de proveedor', () => {
    api
      .listarSalidas({ idProyecto: 3, idProveedor: 7 })
      .subscribe((rows) => expect(rows).toEqual(salidasPrueba));

    const req = http.expectOne((r) => r.url === base + '/salidas');

    expect(req.request.params.keys()).toEqual(['idProyecto']);
    req.flush(salidasPrueba);
  });

  it.each(['crear', 'actualizar'] as const)(
    '%s salida conserva todas las líneas y respuesta en arreglo',
    (accion) => {
      const form = controlesSalida();

      form.patchValue({
        idKardexSalida: 4,
        idProyecto: 3,
        fecha: '2026-10-20',
        solicitante: '  José  ',
      });
      salidasPrueba.forEach((row) =>
        form.controls.items.push(controlesItemSalida(itemDesdeSalida(row, []))),
      );

      const dto = peticionSalida(form.getRawValue());
      if (typeof dto === 'string') throw new Error(dto);

      (accion === 'crear' ? api.crearSalida(dto) : api.actualizarSalida(4, dto)).subscribe((rows) =>
        expect(rows).toEqual(salidasPrueba),
      );

      const req = http.expectOne(base + '/salidas' + (accion === 'actualizar' ? '/4' : ''));

      expect(req.request.method).toBe(accion === 'crear' ? 'POST' : 'PUT');
      expect(req.request.body).toEqual({
        idKardexSalida: 4,
        idProyecto: 3,
        numeroDocumento: null,
        fecha: '2026-10-20',
        solicitante: 'José',
        observacion: null,
        items: [
          { idMaterial: 10, cantidad: 0, observacion: 'Ítem' },
          { idMaterial: 11, cantidad: 2, observacion: 'Ítem' },
        ],
      });
      req.flush(salidasPrueba);
    },
  );

  it('elimina entrada/salida con sus IDs y respuesta ok', () => {
    api.eliminarEntrada(1).subscribe((res) => expect(res).toEqual({ ok: true }));

    const entrada = http.expectOne(base + '/entradas/1');

    expect(entrada.request.method).toBe('DELETE');
    entrada.flush({ ok: true });

    api.eliminarSalida(4).subscribe((res) => expect(res).toEqual({ ok: true }));

    const salida = http.expectOne(base + '/salidas/4');

    expect(salida.request.method).toBe('DELETE');
    salida.flush({ ok: true });
  });

  it('consulta stock sin proyecto y exporta XLSX binario con false explícito', () => {
    api
      .listarStockActual({ idEspecialidad: 2, fechaDesde: '2026-10-01' })
      .subscribe((rows) => expect(rows).toEqual([stockPrueba]));

    const consulta = http.expectOne((r) => r.url === base + '/stock-actual');

    expect(consulta.request.params.keys()).toEqual(['idEspecialidad', 'fechaDesde']);
    consulta.flush([stockPrueba]);

    api
      .exportarStockExcel({ idEspecialidad: 2 }, false)
      .subscribe((res) => expect(res.body).toBeInstanceOf(Blob));

    const req = http.expectOne((r) => r.url === base + '/stock-actual/exportar-excel');

    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('incluirTotales')).toBe('false');
    req.flush(new Blob(['xlsx']));
  });

  it('propaga 422 con detalle de stock, sin convertirlo en éxito', () => {
    const error = vi.fn();

    api.eliminarEntrada(1).subscribe({ error });
    http.expectOne(base + '/entradas/1').flush(
      {
        errores: [
          {
            campo: 'cantidad',
            codigoError: 'STOCK_INCONSISTENTE_AL_ELIMINAR',
            mensaje: 'Stock insuficiente',
          },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 422 }));
  });
});
