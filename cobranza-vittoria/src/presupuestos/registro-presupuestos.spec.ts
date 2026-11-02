import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../core/config/environment';
import { RegistroPresupuestos } from './registro-presupuestos';
import { BorradorPresupuesto } from './borradores-presupuesto';

const BORRADOR: BorradorPresupuesto = {
  idPresupuesto: null,
  idCentroCosto: '5',
  idMoneda: '1',
  codigo: ' P-01 ',
  nombre: ' Obra ',
  descripcion: ' ',
  fechaInicio: '',
  fechaFin: '2026-12-31',
  activo: true,
};

describe('RegistroPresupuestos: contrato HTTP', () => {
  let registro: RegistroPresupuestos;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/control-presupuestario`;
  const version = `${base}/presupuestos/10/versiones/20`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    registro = TestBed.inject(RegistroPresupuestos);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('filtra presupuestos con HttpParams y conserva false', () => {
    registro.presupuestos(false, 5, 1, 'Obra & terreno').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/presupuestos`);
    expect(req.request.params.get('activo')).toBe('false');
    expect(req.request.params.get('idCentroCosto')).toBe('5');
    expect(req.request.params.get('idMoneda')).toBe('1');
    expect(req.request.params.get('busqueda')).toBe('Obra & terreno');
    req.flush([]);
  });

  it('crea presupuesto sin enviar activo ni ids de edición y conserva las fechas', () => {
    registro.crearPresupuesto(BORRADOR).subscribe();
    const req = http.expectOne(`${base}/presupuestos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      idCentroCosto: 5,
      idMoneda: 1,
      codigo: 'P-01',
      nombre: 'Obra',
      descripcion: null,
      fechaInicio: null,
      fechaFin: '2026-12-31',
    });
    req.flush(
      { idPresupuesto: 10, idPresupuestoVersion: 20, numeroVersion: 1, estado: 'BORRADOR' },
      { status: 201, statusText: 'Created' },
    );
  });

  it.each([false, true])(
    'actualizar conserva moneda/centro inmutables y confirmarInactivacion=%s',
    (confirmar) => {
      registro.actualizarPresupuesto(10, { ...BORRADOR, activo: false }, confirmar).subscribe();
      const req = http.expectOne(`${base}/presupuestos/10`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        nombre: 'Obra',
        activo: false,
        descripcion: null,
        fechaInicio: null,
        fechaFin: '2026-12-31',
        confirmarInactivacion: confirmar,
      });
      req.flush({});
    },
  );

  it('propaga el conflicto para que el formulario solicite confirmación', () => {
    const error = vi.fn();
    registro.actualizarPresupuesto(10, BORRADOR).subscribe({ error });
    http
      .expectOne(`${base}/presupuestos/10`)
      .flush({ error: 'PRESUPUESTO_CON_REGISTROS' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
  });

  it('versiones y partidas se consultan bajo su presupuesto', () => {
    registro.versiones(10).subscribe();
    http.expectOne(`${base}/presupuestos/10/versiones`).flush([]);
    registro.version(10, 20).subscribe();
    http.expectOne(version).flush({});
    registro.detalles(10, 20).subscribe();
    http.expectOne(`${version}/partidas`).flush([]);
    registro.presupuesto(10).subscribe();
    http.expectOne(`${base}/presupuestos/10`).flush({});
  });

  it('crea una versión copiando el vigente sin inventar una versión base', () => {
    registro.crearVersion(10, { descripcion: ' ', motivoCambio: ' Ampliación ' }).subscribe();
    const req = http.expectOne(`${base}/presupuestos/10/versiones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ descripcion: null, motivoCambio: 'Ampliación' });
    req.flush({});
  });

  it('aprueba con cuerpo vacío y anula con motivo recortado', () => {
    registro.aprobarVersion(10, 20).subscribe();
    const aprobar = http.expectOne(`${version}/aprobar`);
    expect(aprobar.request.method).toBe('POST');
    expect(aprobar.request.body).toEqual({});
    aprobar.flush({});
    registro.anularVersion(10, 20, ' Descartada ').subscribe();
    const anular = http.expectOne(`${version}/anular`);
    expect(anular.request.body).toEqual({ motivo: 'Descartada' });
    anular.flush({});
  });

  it('agrega/edita un monto sin cambiar la identidad de la partida al editar', () => {
    const dto = {
      idPresupuestoDetalle: 30,
      idCatalogoPartida: '2',
      montoPresupuestado: 123.4567,
      observacion: ' Transporte ',
    };
    registro.agregarDetalle(10, 20, dto).subscribe();
    const post = http.expectOne(`${version}/partidas`);
    expect(post.request.body).toEqual({
      idCatalogoPartida: 2,
      montoPresupuestado: 123.4567,
      observacion: 'Transporte',
    });
    post.flush({});
    registro.actualizarDetalle(10, 20, 30, dto).subscribe();
    const put = http.expectOne(`${version}/partidas/30`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ montoPresupuestado: 123.4567, observacion: 'Transporte' });
    put.flush({});
  });

  it('lote conserva 0 y quitarAusentes explícito', () => {
    registro
      .cargarDetallesLote(
        10,
        20,
        [{ idCatalogoPartida: 2, montoPresupuestado: 0, observacion: '' }],
        true,
      )
      .subscribe();
    const req = http.expectOne(`${version}/partidas/lote`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      detalles: [{ idCatalogoPartida: 2, montoPresupuestado: 0, observacion: null }],
      quitarAusentes: true,
    });
    req.flush({});
  });

  it.each(['montos', 'estructura'])(
    'importa %s por multipart y propaga el 422 completo',
    (tipo) => {
      const archivo = new File(['x'], 'presupuesto.xlsx');
      const error = vi.fn();
      (tipo === 'montos'
        ? registro.importarPresupuesto(10, 20, archivo, false)
        : registro.importarEstructura(10, 20, archivo, true)
      ).subscribe({ error });
      const req = http.expectOne(
        `${version}/partidas/${tipo === 'montos' ? 'importar' : 'importar-estructura'}`,
      );
      const form: unknown = req.request.body;
      expect(form).toBeInstanceOf(FormData);
      if (!(form instanceof FormData)) throw new Error('Falta el formulario');
      expect(form.get('archivo')).toBe(archivo);
      expect(form.get('quitarAusentes')).toBe(String(tipo === 'estructura'));
      const errores = [
        { fila: 2, campo: 'Monto', codigoError: 'MONTO_INVALIDO', mensaje: 'Importe inválido' },
      ];
      req.flush({ errores }, { status: 422, statusText: 'Unprocessable Entity' });
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ error: { errores } }));
    },
  );

  it.each(['montos', 'estructura'])(
    'descarga plantilla de %s como respuesta con cabeceras',
    (tipo) => {
      const respuesta = vi.fn();
      (tipo === 'montos'
        ? registro.plantillaPresupuesto(10, 20, 'csv')
        : registro.plantillaEstructura(10, 20, 'csv')
      ).subscribe(respuesta);
      const req = http.expectOne(
        (r) =>
          r.url ===
          `${version}/partidas/${tipo === 'montos' ? 'plantilla' : 'plantilla-estructura'}`,
      );
      expect(req.request.responseType).toBe('blob');
      expect(req.request.params.get('formato')).toBe('csv');
      req.flush(new Blob(['x']), {
        headers: { 'Content-Disposition': 'attachment; filename=presupuesto.csv' },
      });
      expect(respuesta).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(Blob) }));
    },
  );

  it('elimina el detalle sin cuerpo y consulta su historial', () => {
    registro.eliminarDetalle(10, 20, 30).subscribe();
    const req = http.expectOne(`${version}/partidas/30`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    registro.movimientos(10, 20, 30).subscribe();
    http.expectOne(`${version}/partidas/30/movimientos`).flush([]);
    registro.movimiento(40).subscribe();
    http.expectOne(`${base}/movimientos/40`).flush({});
  });

  it('registra un ajuste trazable sin redondear su monto', () => {
    registro
      .registrarAjuste(10, 20, 30, {
        afectacion: 'EJECUCION',
        direccion: 'DECREMENTO',
        monto: 10.1234,
        observacion: ' Corrección ',
        fecha: '',
      })
      .subscribe();
    const req = http.expectOne(`${version}/partidas/30/ajustes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      afectacion: 'EJECUCION',
      direccion: 'DECREMENTO',
      monto: 10.1234,
      observacion: 'Corrección',
      fecha: null,
    });
    req.flush({});
  });
});
