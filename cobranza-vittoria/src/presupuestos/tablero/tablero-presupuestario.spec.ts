import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { TableroPresupuestario } from './tablero-presupuestario';
import { Tablero, TableroRubro } from './contratos-tablero-presupuestario';
import { ConsultasPresupuestarias } from '../consultas/consultas-presupuestarias';
import { partidaPrueba } from '../presupuestos.fixture';

function rubro(id: number, ejecutado: number): TableroRubro {
  return {
    idCatalogoPartida: id,
    codigo: String(id),
    nombre: `Rubro ${id}`,
    presupuestado: 1000,
    comprometido: 100,
    ejecutado,
    porcentajeDelTotal: 0,
  };
}

function tablero(rubrosFiltrados: TableroRubro[] = [rubro(1, 90), rubro(2, 30)]): Tablero {
  return {
    encabezado: {
      idCentroCosto: 5,
      codigoCentroCosto: 'CC',
      nombreCentroCosto: 'Obra',
      nombreProyecto: null,
      codigoMoneda: 'PEN',
      simboloMoneda: 'S/',
      cantidadPresupuestos: 1,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      fechaCorte: '2026-11-05',
      tieneCronograma: true,
      nivel: 1,
      nivelMaximo: 3,
      rama: [],
    },
    resumen: {
      presupuestado: 1900,
      comprometido: 190,
      ejecutado: 180,
      desviacion: -1720,
      desviacionPorcentaje: -90.53,
      porcentajeEjecutado: 9.47,
    },
    rubros: [rubro(1, 150), rubro(2, 30)],
    rubrosFiltrados,
    semanas: [{ semana: 1, fecha: '2026-01-07', realAcumulado: 180, presupuestoAcumulado: 100 }],
    alCorte: {
      presupuestoAcumulado: 100,
      realAcumulado: 180,
      desviacion: 80,
      desviacionPorcentaje: 80,
    },
    desviacionPorRubro: [
      {
        codigo: '1',
        nombre: 'Rubro 1',
        presupuestoAcumulado: 100,
        realAcumulado: 150,
        desviacion: 50,
        desviacionPorcentaje: 50,
      },
    ],
  };
}

describe('TableroPresupuestario: distribución filtrada y concurrencia', () => {
  let fixture: ComponentFixture<TableroPresupuestario>;
  const api = { dashboard: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    api.dashboard.mockReset().mockReturnValue(of(tablero()));
    TestBed.configureTestingModule({
      providers: [{ provide: ConsultasPresupuestarias, useValue: api }],
    });
    fixture = TestBed.createComponent(TableroPresupuestario);
    fixture.componentRef.setInput('idCentroCosto', 5);
    fixture.componentRef.setInput('nivel', 1);
    fixture.componentRef.setInput('partidas', [
      partidaPrueba({ idCatalogoPartida: 1, esHoja: false }),
    ]);
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('el centro del donut y sus proporciones usan el total filtrado; el resumen mantiene el original', () => {
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    expect(pagina.totalDistribucion).toBe(120);
    expect(pagina.segmentos.map((s) => s.porcentaje)).toEqual([75, 25]);
    expect(pagina.datos?.resumen.ejecutado).toBe(180);
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.dona__valor')?.textContent).toContain('120');
    expect(host.querySelector('.resumen')?.textContent).toContain('180');
  });

  it('construye cinco principales y Otros después de recibir las exclusiones', () => {
    const rubros = [70, 60, 50, 40, 30, 20, 10].map((monto, i) => rubro(i + 1, monto));
    api.dashboard.mockReturnValue(of(tablero(rubros)));
    fixture.detectChanges();
    expect(fixture.componentInstance.segmentos).toHaveLength(6);
    expect(fixture.componentInstance.segmentos[5]).toMatchObject({
      nombre: 'Otros',
      monto: 30,
      rubro: null,
    });
    api.dashboard.mockReturnValue(of(tablero(rubros.slice(0, -1))));
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    expect(fixture.componentInstance.totalDistribucion).toBe(270);
    expect(fixture.componentInstance.segmentos[5].monto).toBe(20);
    expect(fixture.componentInstance.segmentos[5].porcentaje).toBeCloseTo((20 / 270) * 100);
  });

  it('excluir en una rama mantiene la navegación y todos los demás datos y curvas', () => {
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    pagina.bajarA(pagina.rubrosDistribucion[0]);
    expect(pagina.idPartidaPadre).toBe(1);
    const anterior = pagina.datos!;
    const rutaReal = pagina.rutaReal;
    const respuesta = tablero([rubro(2, 15)]);
    respuesta.resumen.ejecutado = 9999;
    respuesta.semanas = [];
    api.dashboard.mockReturnValue(of(respuesta));
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, null, 1, [7]);
    expect(pagina.idPartidaPadre).toBe(1);
    for (const miembro of [
      'encabezado',
      'resumen',
      'rubros',
      'semanas',
      'alCorte',
      'desviacionPorRubro',
    ] as const) {
      expect(pagina.datos?.[miembro]).toBe(anterior[miembro]);
    }
    expect(pagina.rutaReal).toBe(rutaReal);
    expect(pagina.totalDistribucion).toBe(15);
    pagina.irARama(null);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [7]);
    fixture.componentRef.setInput('nivel', 2);
    fixture.detectChanges();
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 2, null, [7]);
  });

  it('descarta respuestas obsoletas incluso cuando cambia la selección durante la carga inicial', () => {
    const antigua = new Subject<Tablero>();
    const actual = new Subject<Tablero>();
    api.dashboard.mockReturnValueOnce(antigua).mockReturnValueOnce(actual);
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [1]);
    fixture.detectChanges();
    expect(fixture.componentInstance.cargando).toBe(false);
    vi.advanceTimersByTime(250);
    expect(antigua.observed).toBe(false);
    expect(fixture.componentInstance.cargando).toBe(true);
    actual.next(tablero([rubro(2, 12)]));
    antigua.next(tablero([rubro(1, 999)]));
    expect(fixture.componentInstance.totalDistribucion).toBe(12);
    expect(fixture.componentInstance.cargando).toBe(false);
  });

  it('si cambia la rama mientras carga, la exclusión más reciente conserva ese contexto', () => {
    fixture.detectChanges();
    const pendiente = new Subject<Tablero>();
    api.dashboard.mockReturnValueOnce(pendiente).mockReturnValueOnce(of(tablero([rubro(2, 5)])));
    fixture.componentInstance.bajarA(fixture.componentInstance.rubrosDistribucion[0]);
    fixture.componentRef.setInput('partidasExcluidas', [3]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    expect(pendiente.observed).toBe(false);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, null, 1, [3]);
    expect(fixture.componentInstance.totalDistribucion).toBe(5);
  });

  it('la llegada del catálogo reutilizado no vuelve a solicitar el dashboard', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidas', [
      partidaPrueba({ idCatalogoPartida: 2, esHoja: false }),
    ]);
    fixture.detectChanges();
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    expect(
      fixture.componentInstance.puedeBajar(fixture.componentInstance.rubrosDistribucion[1]),
    ).toBe(true);
  });

  it.each([[], [0, 0], [-10, 5], [10, -10], [-20, -10]].map((montos) => ({ montos })))(
    'conserva los importes %j sin dibujar arcos engañosos',
    ({ montos }) => {
      const filtrados = montos.map((monto, i) => rubro(i + 1, monto));
      api.dashboard.mockReturnValue(of(tablero(filtrados)));
      fixture.detectChanges();
      const pagina = fixture.componentInstance;
      expect(pagina.segmentos).toEqual([]);
      expect(pagina.rubrosDistribucion).toEqual(filtrados);
      expect(pagina.totalDistribucion).toBe(montos.reduce((a, b) => a + b, 0));
      const host: HTMLElement = fixture.nativeElement;
      expect(host.querySelectorAll('.distribucion__tabla tbody tr')).toHaveLength(montos.length);
      expect(host.querySelector('.resumen')?.textContent).toContain('180');
      expect(host.textContent).toContain('Evolución del gasto');
    },
  );

  it.each([
    [
      400,
      { errors: { PartidasExcluidas: ['Identificadores inválidos.'] } },
      'Identificadores inválidos.',
    ],
    [
      404,
      { error: 'PARTIDA_NO_ENCONTRADA', message: 'La partida 999 no existe.' },
      'La partida 999 no existe.',
    ],
  ])(
    'presenta el error HTTP %s y permite reintentar sin mostrar la distribución anterior',
    (status, error, mensaje) => {
      fixture.detectChanges();
      api.dashboard.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error })));
      fixture.componentRef.setInput('partidasExcluidas', [999]);
      fixture.detectChanges();
      vi.advanceTimersByTime(250);
      expect(fixture.componentInstance.error).toContain(mensaje);
      expect(fixture.componentInstance.segmentos).toEqual([]);
      expect(fixture.componentInstance.cargando).toBe(false);
      expect(fixture.componentInstance.datos?.resumen.ejecutado).toBe(180);
      api.dashboard.mockReturnValue(of(tablero()));
      const host: HTMLElement = fixture.nativeElement;
      host.querySelector<HTMLButtonElement>('[role=alert] button')!.click();
      fixture.detectChanges();
      expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [999]);
      expect(fixture.componentInstance.error).toBe('');
    },
  );

  it('cancela la consulta pendiente al destruir el componente', () => {
    const pendiente = new Subject<Tablero>();
    api.dashboard.mockReturnValue(pendiente);
    fixture.detectChanges();
    fixture.destroy();
    expect(pendiente.observed).toBe(false);
  });

  it('un cambio de partidas espera exactamente 250 ms antes de consultar', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [3]);
    fixture.detectChanges();
    expect(fixture.componentInstance.partidasExcluidas()).toEqual([3]);
    expect(fixture.componentInstance.cargando).toBe(false);
    vi.advanceTimersByTime(249);
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(api.dashboard).toHaveBeenCalledTimes(2);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [3]);
  });

  it('los cambios rápidos reinician la espera y solo consultan la última selección', () => {
    fixture.detectChanges();
    for (const ids of [[3], [3, 7], [7]]) {
      fixture.componentRef.setInput('partidasExcluidas', ids);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);
    }
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(149);
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(api.dashboard).toHaveBeenCalledTimes(2);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [7]);
  });

  it('normaliza conjuntos equivalentes sin reiniciar la espera ni repetir consultas', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [7, 3]);
    fixture.detectChanges();
    vi.advanceTimersByTime(200);
    fixture.componentRef.setInput('partidasExcluidas', [3, 7, 3]);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);
    expect(api.dashboard).toHaveBeenCalledTimes(2);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [3, 7]);
    fixture.componentRef.setInput('partidasExcluidas', [7, 3]);
    fixture.detectChanges();
    vi.advanceTimersByTime(500);
    expect(api.dashboard).toHaveBeenCalledTimes(2);
  });

  it('deshacer una selección antes de consultar reutiliza los datos vigentes', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    fixture.componentRef.setInput('partidasExcluidas', []);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.totalDistribucion).toBe(120);
  });

  it.each([
    { input: 'idCentroCosto', valor: 6, presupuesto: null, nivel: 1, centro: 6 },
    { input: 'idPresupuesto', valor: 10, presupuesto: 10, nivel: 1, centro: 5 },
    { input: 'nivel', valor: 2, presupuesto: null, nivel: 2, centro: 5 },
  ])(
    'cambiar $input carga inmediatamente e invalida la selección pendiente',
    ({ input, valor, presupuesto, nivel, centro }) => {
      fixture.detectChanges();
      fixture.componentRef.setInput('partidasExcluidas', [7]);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);
      fixture.componentRef.setInput(input, valor);
      if (input !== 'nivel') fixture.componentRef.setInput('partidasExcluidas', []);
      fixture.detectChanges();
      expect(api.dashboard).toHaveBeenCalledTimes(2);
      expect(api.dashboard).toHaveBeenLastCalledWith(
        centro,
        presupuesto,
        nivel,
        null,
        input === 'nivel' ? [7] : [],
      );
      vi.advanceTimersByTime(500);
      expect(api.dashboard).toHaveBeenCalledTimes(2);
    },
  );

  it('bajar a una rama y volver por el breadcrumb son inmediatos e invalidan la espera', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(100);
    fixture.componentInstance.bajarA(fixture.componentInstance.rubrosDistribucion[0]);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, null, 1, [7]);
    vi.advanceTimersByTime(500);
    expect(api.dashboard).toHaveBeenCalledTimes(2);
    fixture.componentRef.setInput('partidasExcluidas', [8]);
    fixture.detectChanges();
    fixture.componentInstance.irARama(null);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [8]);
    vi.advanceTimersByTime(500);
    expect(api.dashboard).toHaveBeenCalledTimes(3);
  });

  it('descarta la respuesta anterior desde el primer cambio, incluso antes de vencer el debounce', () => {
    const antigua = new Subject<Tablero>();
    api.dashboard.mockReturnValueOnce(antigua);
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [3]);
    fixture.detectChanges();
    expect(antigua.observed).toBe(false);
    antigua.next(tablero([rubro(1, 999)]));
    vi.advanceTimersByTime(249);
    expect(fixture.componentInstance.datos).toBeNull();
    expect(api.dashboard).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.totalDistribucion).toBe(120);
  });

  it('un reintento durante una espera consulta inmediatamente sin otra petición diferida', () => {
    fixture.detectChanges();
    api.dashboard.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    expect(fixture.componentInstance.error).not.toBe('');
    fixture.componentRef.setInput('partidasExcluidas', [8]);
    fixture.detectChanges();
    fixture.componentInstance.cargar(true);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, [8]);
    expect(fixture.componentInstance.error).toBe('');
    vi.advanceTimersByTime(500);
    expect(api.dashboard).toHaveBeenCalledTimes(3);
  });

  it('destruir el componente cancela también la consulta diferida', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    fixture.destroy();
    vi.advanceTimersByTime(500);
    expect(api.dashboard).toHaveBeenCalledTimes(1);
  });

  it('un error invalida la distribución anterior aunque se cancele otra consulta y se vuelva a la selección original', () => {
    fixture.detectChanges();
    api.dashboard.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentRef.setInput('partidasExcluidas', [7]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    const pendiente = new Subject<Tablero>();
    api.dashboard.mockReturnValueOnce(pendiente);
    fixture.componentRef.setInput('partidasExcluidas', [8]);
    fixture.detectChanges();
    vi.advanceTimersByTime(250);
    fixture.componentRef.setInput('partidasExcluidas', []);
    fixture.detectChanges();
    expect(pendiente.observed).toBe(false);
    vi.advanceTimersByTime(250);
    expect(api.dashboard).toHaveBeenCalledTimes(4);
    expect(api.dashboard).toHaveBeenLastCalledWith(5, null, 1, null, []);
    expect(fixture.componentInstance.totalDistribucion).toBe(120);
  });
});
