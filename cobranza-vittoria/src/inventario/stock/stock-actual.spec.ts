import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, Subject, finalize, of, throwError } from 'rxjs';
import { FiltrosStockProyecto, StockProyecto } from './contratos-stock-proyecto';

import { StockActual } from './stock-actual';
import { ExportacionStock } from './exportacion-stock';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { RegistroInventario } from '../registro-inventario';
import { stockPrueba } from '../inventario.fixture';
import {
  proveedoresCatalogosPrueba,
  escribirInventario,
  seleccionarInventario,
  botonInventario,
} from '../pruebas/dom-inventario';

describe('StockActual — filtros y búsqueda', () => {
  const stockProyecto: StockProyecto = {
    idStockProyecto: 9,
    idProyecto: 3,
    proyecto: 'Obra',
    idMaterial: 10,
    codigoMaterial: 'C10',
    nombre: 'Cañería',
    unidadMedida: 'M',
    idEspecialidad: 2,
    especialidad: 'Eléctrica',
    stock: 3.25,
    fechaUltimoMovimiento: '2026-10-22',
  };
  const api = {
    listarStockActual: vi.fn(() => of([stockPrueba])),
    listarStockProyecto: vi.fn<(filtros?: FiltrosStockProyecto) => Observable<StockProyecto[]>>(),
  };
  const exportacion = { exportando: signal(false), exportar: vi.fn() };
  let fixture: ComponentFixture<StockActual>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listarStockActual.mockReset().mockReturnValue(of([stockPrueba]));
    api.listarStockProyecto.mockReset().mockReturnValue(of([stockProyecto]));
    TestBed.configureTestingModule({
      providers: [...proveedoresCatalogosPrueba, { provide: RegistroInventario, useValue: api }],
    });
    TestBed.overrideComponent(StockActual, {
      set: {
        providers: [ReferenciasInventario, { provide: ExportacionStock, useValue: exportacion }],
      },
    });
    fixture = TestBed.createComponent(StockActual);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('busca por código/ID/nombre sin tildes y conserva cifras y fecha', async () => {
    await escribirInventario(
      fixture,
      'input[placeholder="Buscar por ID, código o nombre"]',
      'caneria',
    );

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(raiz.textContent).toContain('20/10/2026');
    expect(raiz.textContent).toContain('Cañería');
    expect(raiz.querySelector('#inventario-filtro-proyecto')).not.toBeNull();
    expect(raiz.textContent).toContain('Stock Global');
  });

  it('exporta con filtros actuales aunque no se haya pulsado Filtrar y sin proyecto', async () => {
    await seleccionarInventario(fixture, '#inventario-filtro-especialidad', 'Eléctrica');
    botonInventario(fixture, 'Exportar a Excel').click();

    expect(exportacion.exportar).toHaveBeenCalledWith(
      { idProyecto: null, idEspecialidad: 2, fechaDesde: null, fechaHasta: null },
      false,
    );
    expect(api.listarStockActual).toHaveBeenCalledTimes(1);
  });
  it('combina proyecto, especialidad y fechas, y vuelve al global al limpiar', async () => {
    await seleccionarInventario(fixture, '#inventario-filtro-proyecto', 'Obra');
    await seleccionarInventario(fixture, '#inventario-filtro-especialidad', 'Eléctrica');
    await escribirInventario(fixture, '#inventario-filtro-desde', '2026-10-01');
    await escribirInventario(fixture, '#inventario-filtro-hasta', '2026-10-22');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(api.listarStockProyecto).toHaveBeenCalledWith({
      idProyecto: 3,
      idEspecialidad: 2,
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-22',
    });
    expect(raiz.textContent).toContain('Stock por Proyecto');
    expect(raiz.textContent).toContain('22/10/2026');
    expect(raiz.textContent).toContain('3.25');
    expect(raiz.querySelector('thead')?.textContent).toContain('Proyecto');
    expect(raiz.querySelector('thead')?.textContent).not.toContain('Entrada');
    botonInventario(fixture, 'Exportar Stock Global a Excel').click();
    expect(exportacion.exportar).toHaveBeenCalledWith(
      expect.objectContaining({ idProyecto: 3 }),
      false,
    );
    expect(raiz.textContent).toContain('No incluye el filtro de proyecto');
    botonInventario(fixture, 'Limpiar filtros').click();
    await fixture.whenStable();

    expect(api.listarStockActual).toHaveBeenCalledTimes(2);
    expect(raiz.textContent).toContain('Stock Global');
    expect(raiz.querySelector('thead')?.textContent).toContain('Entrada');
  });

  it('distingue lista vacía de error y permite reintentar', async () => {
    api.listarStockProyecto.mockReturnValue(of([]));
    await seleccionarInventario(fixture, '#inventario-filtro-proyecto', 'Obra');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('No hay stock para los filtros');
    api.listarStockProyecto.mockReturnValue(
      throwError(() => ({
        error: { errores: [{ codigoError: 'STOCK_PROYECTO_NO_INICIALIZADO' }] },
      })),
    );
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    expect(raiz.textContent).toContain('Contacte al administrador');
    expect(raiz.querySelector('.empty-state')).toBeNull();
    api.listarStockProyecto.mockReturnValue(of([stockProyecto]));
    botonInventario(fixture, 'Reintentar').click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Cañería');
  });

  it('ignora respuestas tardías de proyecto al volver a global', async () => {
    const respuesta = new Subject<StockProyecto[]>();

    api.listarStockProyecto.mockReturnValue(respuesta);
    await seleccionarInventario(fixture, '#inventario-filtro-proyecto', 'Obra');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();
    botonInventario(fixture, 'Limpiar filtros').click();
    await fixture.whenStable();
    respuesta.next([stockProyecto]);
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Stock Global');
    expect(raiz.querySelector('tbody')?.textContent).toContain('20/10/2026');
    expect(raiz.textContent).not.toContain('22/10/2026');
  });
  it('consulta distribución al expandir y vuelve a consultarla al reabrir, sin añadir columna de acciones', async () => {
    api.listarStockProyecto.mockReturnValue(
      of([
        stockProyecto,
        {
          ...stockProyecto,
          idStockProyecto: 12,
          idProyecto: 6,
          proyecto: 'Otro proyecto',
          stock: 2.75,
        },
      ]),
    );

    expect(api.listarStockProyecto).not.toHaveBeenCalled();
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const boton = botonInventario(fixture, 'Distribución');

    expect(api.listarStockProyecto).toHaveBeenCalledWith({ idMaterial: 10 });
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe('stock-distribucion-10');
    expect(raiz.querySelectorAll('#stock-distribucion-10 tbody tr')).toHaveLength(2);
    expect(raiz.querySelector('#stock-distribucion-10')?.textContent).toContain('Otro proyecto');
    expect(raiz.querySelector('#stock-distribucion-10')?.textContent).toContain('2.75');
    expect(raiz.querySelector('thead')?.textContent).not.toContain('Acciones');
    expect(raiz.querySelector('.stock-distribucion-fila td')?.getAttribute('colspan')).toBe('9');
    boton.click();
    await fixture.whenStable();

    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(raiz.querySelector('#stock-distribucion-10')).toBeNull();
    boton.click();
    await fixture.whenStable();
    expect(api.listarStockProyecto).toHaveBeenCalledTimes(2);
  });

  it('muestra la distribución completa del material incluso con proyecto y fechas filtrados', async () => {
    await seleccionarInventario(fixture, '#inventario-filtro-proyecto', 'Obra');
    await escribirInventario(fixture, '#inventario-filtro-desde', '2026-10-01');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();
    api.listarStockProyecto.mockReturnValue(
      of([{ ...stockProyecto, idStockProyecto: 12, idProyecto: 6, proyecto: 'Otro proyecto' }]),
    );
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(api.listarStockProyecto).toHaveBeenLastCalledWith({ idMaterial: 10 });
    expect(raiz.querySelector('#stock-distribucion-10')?.textContent).toContain('Otro proyecto');
    expect(raiz.querySelector('.stock-distribucion-fila td')?.getAttribute('colspan')).toBe('8');
  });

  it('deja el espacio expandido en blanco si el material no tiene distribución', async () => {
    api.listarStockProyecto.mockReturnValue(of([]));
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const region = raiz.querySelector('#stock-distribucion-10');

    expect(region).not.toBeNull();
    expect(region?.textContent?.trim()).toBe('');
    expect(region?.querySelector('table')).toBeNull();
    expect(botonInventario(fixture, 'Distribución').getAttribute('aria-expanded')).toBe('true');
  });

  it('distingue el fallo de distribución del vacío y permite reintentar dentro de la fila', async () => {
    api.listarStockProyecto.mockReturnValue(
      throwError(() => ({ error: { message: 'No se pudo consultar la distribución' } })),
    );
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelector('#stock-distribucion-10 [role="alert"]')?.textContent).toContain(
      'No se pudo consultar la distribución',
    );
    expect(raiz.querySelector('.stock-fila')?.textContent).toContain('Cañería');
    api.listarStockProyecto.mockReturnValue(of([stockProyecto]));
    botonInventario(fixture, 'Reintentar distribución').click();
    await fixture.whenStable();
    expect(raiz.querySelector('#stock-distribucion-10 [role="alert"]')).toBeNull();
    expect(raiz.querySelector('#stock-distribucion-10 tbody')?.textContent).toContain('Obra');
  });

  it('cancela la distribución anterior al expandir otro material e ignora respuestas tardías', async () => {
    api.listarStockActual.mockReturnValue(
      of([stockPrueba, { ...stockPrueba, idKardexStock: 9, idMaterial: 11, nombre: 'Tubo' }]),
    );
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();
    const pendiente = new Subject<StockProyecto[]>();
    const cancelada = vi.fn();

    api.listarStockProyecto
      .mockReturnValueOnce(pendiente.pipe(finalize(cancelada)))
      .mockReturnValueOnce(
        of([{ ...stockProyecto, idMaterial: 11, proyecto: 'Distribución del tubo' }]),
      );
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelector('#stock-distribucion-10')?.textContent).toContain(
      'Cargando distribución',
    );
    raiz.querySelectorAll<HTMLButtonElement>('.stock-distribucion')[1].click();
    await fixture.whenStable();
    pendiente.next([stockProyecto]);
    await fixture.whenStable();

    expect(cancelada).toHaveBeenCalledOnce();
    expect(raiz.querySelectorAll('.stock-distribucion-fila')).toHaveLength(1);
    expect(raiz.querySelector('#stock-distribucion-10')).toBeNull();
    expect(raiz.querySelector('#stock-distribucion-11')?.textContent).toContain(
      'Distribución del tubo',
    );
    expect(api.listarStockProyecto).toHaveBeenLastCalledWith({ idMaterial: 11 });
  });

  it('cierra y cancela la distribución al volver a consultar el listado', async () => {
    const pendiente = new Subject<StockProyecto[]>();
    const cancelada = vi.fn();

    api.listarStockProyecto.mockReturnValue(pendiente.pipe(finalize(cancelada)));
    botonInventario(fixture, 'Distribución').click();
    await fixture.whenStable();
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(cancelada).toHaveBeenCalledOnce();
    expect(raiz.querySelector('.stock-distribucion-fila')).toBeNull();
    expect(botonInventario(fixture, 'Distribución').getAttribute('aria-expanded')).toBe('false');
  });
});
