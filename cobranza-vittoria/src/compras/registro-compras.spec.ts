import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegistroCompras } from './registro-compras';
import { ApiService } from '../app/core/services/api.service';
import { compraPrueba, pendientePrueba, detalleCompraPrueba } from './compras.fixture';
import { prepararItems, peticionCompra } from './formulario-compra/datos-compra';
import { detallePrueba } from '../ordenes-compra/ordenes-compra.fixture';
describe('RegistroCompras — contrato HTTP', () => {
  let api: RegistroCompras;
  let http: HttpTestingController;
  let base: string;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RegistroCompras);
    http = TestBed.inject(HttpTestingController);
    base = TestBed.inject(ApiService).baseUrl + '/api/compras/compras';
  });
  afterEach(() => http.verify());
  it('conserva false y cero en filtros y omite null', () => {
    api
      .compras({ aceptada: false, idProveedor: 0 })
      .subscribe((rows) => expect(rows).toEqual([compraPrueba]));
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('aceptada')).toBe('false');
    expect(req.request.params.get('idProveedor')).toBe('0');
    req.flush([compraPrueba]);
    api.compras({ aceptada: null, idProveedor: null }).subscribe();
    const sinFiltros = http.expectOne(base);
    expect(sinFiltros.request.params.keys()).toEqual([]);
    sinFiltros.flush([]);
  });
  it('consulta pendientes, detalle y metadata con casing SQL', () => {
    api.pendientesCompra().subscribe((rows) => expect(rows).toEqual([pendientePrueba]));
    http.expectOne(base + '/pendientes-desde-oc').flush([pendientePrueba]);
    api.compra(9).subscribe((detalle) => expect(detalle).toEqual(detalleCompraPrueba));
    http.expectOne(base + '/9').flush(detalleCompraPrueba);
    api.documentosCompra(9).subscribe((rows) => expect(rows).toEqual([]));
    http.expectOne(base + '/9/documentos').flush([]);
    expect(api.documentoCompraDownloadUrl(9, 2)).toBe(base + '/9/documentos/2/download');
  });
  it('registra el DTO documentado, sin proveedor de cabecera ni moneda implícita', () => {
    const dto = peticionCompra(8, '10', '2026-10-20', prepararItems(detallePrueba, []));
    api.registrarCompra(dto).subscribe((res) => expect(res.idCompra).toBe(9));
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      numeroCompra: '10',
      idOrdenCompra: 8,
      fechaCompra: '2026-10-20',
      incluyeIGV: true,
      subtotalSinIGV: 127.11,
      montoIGV: 22.89,
      montoTotal: 150,
      observacion: '',
      items: detallePrueba.items.map((x) => ({
        idMaterial: x.idMaterial,
        cantidad: 2,
        precioUnitario: 25,
      })),
    });
    req.flush({ idCompra: 9, montoTotal: 150 });
  });
  it('envía aceptación y propaga conflictos presupuestarios', () => {
    const error = vi.fn();
    api.aceptarCompra(9, { idUsuario: 7, observacion: null }).subscribe({ error });
    const req = http.expectOne(base + '/9/aceptar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idUsuario: 7, observacion: null });
    req.flush({ message: 'Saldo insuficiente' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });
  it('sube archivos con el campo repetido files y conserva nombres', () => {
    const files = [new File(['a'], 'uno.pdf'), new File(['b'], 'dos.jpg')];
    api.uploadDocumentosCompra(9, files).subscribe();
    const req = http.expectOne(base + '/9/documentos');
    expect(req.request.method).toBe('POST');
    const form: FormData = req.request.body;
    expect(form.getAll('files')).toEqual(files);
    req.flush({ ok: true });
  });
});
