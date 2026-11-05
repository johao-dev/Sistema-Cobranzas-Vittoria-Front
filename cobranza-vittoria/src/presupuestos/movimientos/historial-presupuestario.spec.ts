import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { simularDialogosPresupuestos } from '../dialogos.fixture';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { ConsultasPresupuestarias } from '../consultas/consultas-presupuestarias';
import { MovimientoConsolidado } from '../consultas/contratos-consultas-presupuestarias';
import { ContextoMovimientos, HistorialPresupuestario } from './historial-presupuestario';

function movimiento(cambios: Partial<MovimientoConsolidado> = {}): MovimientoConsolidado {
  return {
    idMovimientoPresupuestal: 501,
    idPresupuestoDetalle: 1011,
    idTipoMovimientoPresupuestal: 2,
    tipo: 'LIBERACION',
    nombreTipo: 'Liberación',
    origen: 'COMPRA',
    idOrigen: 1,
    claveEvento: 'evento-501',
    fecha: '2026-01-01T10:00:00',
    monto: 100,
    afectacion: 'COMPROMISO',
    direccion: 'DECREMENTO',
    observacion: 'Compensación',
    idPresupuesto: 10,
    idPresupuestoVersion: 101,
    numeroVersion: 1,
    estadoPresupuesto: 'HISTORICO',
    idCatalogoPartida: 25,
    codigoPartida: '1',
    partida: 'Concreto',
    codigoPresupuesto: 'P-1',
    idMoneda: 1,
    moneda: 'PEN',
    simboloMoneda: 'S/',
    esNuevo: false,
    efectoComprometido: -100,
    efectoEjecutado: 0,
    ...cambios,
  };
}

const contexto: ContextoMovimientos = {
  modo: 'consolidado',
  idPresupuesto: 10,
  idCatalogoPartida: 25,
  codigo: '1',
  nombre: 'Concreto',
};

describe('HistorialPresupuestario: modos y conciliación sin Zone.js', () => {
  let fixture: ComponentFixture<HistorialPresupuestario>;
  let restaurar: () => void;
  const registro = { movimientos: vi.fn() };
  const consultas = { movimientosConsolidados: vi.fn() };
  const filas = [
    movimiento(),
    movimiento({
      idMovimientoPresupuestal: 502,
      monto: 475,
      efectoComprometido: 475,
      numeroVersion: 2,
      idPresupuestoVersion: 102,
    }),
    movimiento({
      idMovimientoPresupuestal: 503,
      monto: 600,
      efectoComprometido: 0,
      efectoEjecutado: 600,
      tipo: 'EJECUCION',
      numeroVersion: 3,
      idPresupuestoVersion: 103,
      estadoPresupuesto: 'APROBADO',
    }),
    movimiento({
      idMovimientoPresupuestal: 504,
      monto: 70,
      efectoComprometido: 0,
      efectoEjecutado: -70,
      tipo: 'AJUSTE',
      afectacion: 'EJECUCION',
      numeroVersion: 3,
      estadoPresupuesto: 'APROBADO',
    }),
  ];
  beforeEach(() => {
    restaurar = simularDialogosPresupuestos();
    registro.movimientos.mockReset().mockReturnValue(of([]));
    consultas.movimientosConsolidados.mockReset().mockReturnValue(of(filas));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroPresupuestos, useValue: registro },
        { provide: ConsultasPresupuestarias, useValue: consultas },
      ],
    });
    fixture = TestBed.createComponent(HistorialPresupuestario);
    fixture.componentRef.setInput('contexto', contexto);
  });
  afterEach(() => {
    fixture.destroy();
    restaurar();
  });

  function texto(): string {
    return fixture.nativeElement.textContent;
  }

  it('muestra versiones de origen, montos originales y totales de efectos con signo', async () => {
    await fixture.whenStable();
    expect(consultas.movimientosConsolidados).toHaveBeenCalledExactlyOnceWith(10, 25);
    expect(registro.movimientos).not.toHaveBeenCalled();
    expect(texto()).toContain('v1 · HISTORICO');
    expect(texto()).toContain('v2 · HISTORICO');
    expect(texto()).toContain('v3 · APROBADO');
    expect(texto()).toContain('-100.00');
    expect(texto()).toContain('+475.00');
    expect(texto()).toContain('-70.00');
    expect(texto()).toContain('375.00');
    expect(texto()).toContain('530.00');
    const host: HTMLElement = fixture.nativeElement;
    const montos = Array.from(host.querySelectorAll('tbody tr')).map((fila) =>
      fila.querySelectorAll('td')[6].textContent?.trim(),
    );
    expect(montos).toEqual(['S/ 100.00', 'S/ 475.00', 'S/ 600.00', 'S/ 70.00']);
    expect(
      fixture.componentInstance['movimientos']().map((m) => m.idMovimientoPresupuestal),
    ).toEqual([501, 502, 503, 504]);
  });

  it('el modo individual conserva su ruta y no muestra conciliación consolidada', async () => {
    fixture.componentRef.setInput('contexto', {
      modo: 'individual',
      idPresupuesto: 10,
      idVersion: 101,
      idDetalle: 1011,
      codigo: '1',
      nombre: 'Concreto',
    });
    registro.movimientos.mockReturnValue(of([movimiento()]));
    await fixture.whenStable();
    expect(registro.movimientos).toHaveBeenCalledExactlyOnceWith(10, 101, 1011);
    expect(consultas.movimientosConsolidados).not.toHaveBeenCalled();
    expect(texto()).toContain('únicamente');
    expect(texto()).not.toContain('Efecto comprometido');
    expect(texto()).not.toContain('Comprometido acumulado');
  });

  it('cancela la partida anterior, limpia sus filas y mantiene la carga de la nueva', async () => {
    const anterior = new Subject<MovimientoConsolidado[]>();
    const nueva = new Subject<MovimientoConsolidado[]>();
    consultas.movimientosConsolidados.mockReturnValueOnce(anterior).mockReturnValueOnce(nueva);
    await fixture.whenStable();
    anterior.next(filas);
    await fixture.whenStable();
    fixture.componentRef.setInput('contexto', { ...contexto, idCatalogoPartida: 26 });
    await fixture.whenStable();
    expect(anterior.observed).toBe(false);
    expect(fixture.componentInstance['cargando']()).toBe(true);
    expect(fixture.componentInstance['movimientos']()).toEqual([]);
    anterior.next(filas);
    nueva.next([]);
    nueva.complete();
    await fixture.whenStable();
    expect(texto()).toContain('Esta partida no registra movimientos');
    expect(fixture.componentInstance['cargando']()).toBe(false);
  });

  it.each(['cerrar', 'destruir'])('cancela la petición al %s el historial', async (accion) => {
    const respuesta = new Subject<MovimientoConsolidado[]>();
    consultas.movimientosConsolidados.mockReturnValue(respuesta);
    await fixture.whenStable();
    const cerrado = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrado);
    if (accion === 'cerrar') {
      const host: HTMLElement = fixture.nativeElement;
      host.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click();
      expect(cerrado).toHaveBeenCalledTimes(1);
    } else fixture.destroy();
    expect(respuesta.observed).toBe(false);
    respuesta.next(filas);
    expect(fixture.componentInstance['movimientos']()).toEqual([]);
    expect(fixture.componentInstance['cargando']()).toBe(false);
  });

  it.each([
    [401, {}, 'Inicia sesión'],
    [403, {}, 'permisos necesarios'],
    [404, {}, 'No se encontró el presupuesto o la partida'],
    [404, { message: 'Partida no encontrada' }, 'Partida no encontrada'],
    [400, { errors: { Id: ['El ID debe ser positivo'] } }, 'El ID debe ser positivo'],
    [500, { message: 'No se pudo consultar' }, 'No se pudo consultar'],
  ])(
    'muestra HTTP %s y permite reintentar sin datos anteriores',
    async (status, error, esperado) => {
      consultas.movimientosConsolidados.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, error })),
      );
      await fixture.whenStable();
      expect(texto()).toContain(esperado);
      expect(fixture.componentInstance['cargando']()).toBe(false);
      expect(texto()).not.toContain('Comprometido acumulado');
      const host: HTMLElement = fixture.nativeElement;
      Array.from(host.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Reintentar')!
        .click();
      await fixture.whenStable();
      expect(texto()).toContain('375.00');
      expect(host.querySelector('[role="alert"]')).toBeNull();
    },
  );
});
