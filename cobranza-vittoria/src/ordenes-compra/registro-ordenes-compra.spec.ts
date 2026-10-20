import { Observable } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegistroOrdenesCompra } from './registro-ordenes-compra';
import { ApiService } from '../app/core/services/api.service';
import { detallePrueba, ordenPrueba, requerimientoPrueba } from './ordenes-compra.fixture';
import { controlesItemOrden, peticionOrden } from './formulario-orden/datos-formulario-orden';

describe('RegistroOrdenesCompra — contrato HTTP', () => {
  let registro: RegistroOrdenesCompra;
  let http: HttpTestingController;
  let endpoint: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    registro = TestBed.inject(RegistroOrdenesCompra);
    http = TestBed.inject(HttpTestingController);
    endpoint = TestBed.inject(ApiService).baseUrl + '/api/compras/ordenes-compra';
  });

  afterEach(() => http.verify());

  it('lista con filtros exactos y omite los valores null', () => {
    registro
      .listar({ estado: 'REGISTRADA', idProveedor: 30, idProyecto: null })
      .subscribe((resultado) => expect(resultado).toEqual([ordenPrueba]));

    const peticion = http.expectOne((req) => req.url === endpoint);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys()).toEqual(['estado', 'idProveedor']);
    expect(peticion.request.params.get('estado')).toBe('REGISTRADA');
    expect(peticion.request.params.get('idProveedor')).toBe('30');
    peticion.flush([ordenPrueba]);
  });

  it('obtiene detalle, historial y proveedores en plural', () => {
    registro.obtener(8).subscribe((resultado) => expect(resultado).toEqual(detallePrueba));
    http.expectOne(endpoint + '/8').flush(detallePrueba);
  });

  it.each(['crear', 'actualizar'] as const)(
    'conserva DTO exacto al %s, sin proveedor ni proyecto de cabecera ni moneda implícita',
    (accion) => {
      const items = requerimientoPrueba.items.map((item) => ({
        ...controlesItemOrden(item).getRawValue(),
        idProveedor: 30,
      }));
      const dto = peticionOrden(requerimientoPrueba, '9', '2026-10-20', items);
      const operacion: Observable<unknown> =
        accion === 'crear' ? registro.crear(dto) : registro.actualizar(8, dto);

      operacion.subscribe();

      const peticion = http.expectOne(endpoint + (accion === 'crear' ? '' : '/8'));
      expect(peticion.request.method).toBe(accion === 'crear' ? 'POST' : 'PUT');
      expect(peticion.request.body).toEqual({
        numeroOrdenCompra: '9',
        idRequerimiento: 4,
        fechaOrdenCompra: '2026-10-20',
        descripcion: '',
        idUsuarioCreacion: 7,
        rutaPdf: '',
        items: [
          { idMaterial: 10, cantidad: 2.5, idProveedor: 30, precioUnitario: 0 },
          { idMaterial: 20, cantidad: 3, idProveedor: 30, precioUnitario: 0 },
        ],
      });
      peticion.flush(accion === 'crear' ? { idOrdenCompra: 9, total: 0 } : { ok: true });
    },
  );

  it('envía PATCH con destino, identidad y observación y propaga conflictos', () => {
    const error = vi.fn();
    registro
      .cambiarEstado(8, { estadoNuevo: 'APROBADA', idUsuario: 99, observacion: null })
      .subscribe({ error });

    const peticion = http.expectOne(endpoint + '/8/estado');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({
      estadoNuevo: 'APROBADA',
      idUsuario: 99,
      observacion: null,
    });
    peticion.flush({ message: 'Saldo insuficiente' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });
});
