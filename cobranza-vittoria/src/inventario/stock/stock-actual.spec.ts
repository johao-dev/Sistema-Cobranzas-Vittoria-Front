import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

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
  const api = { listarStockActual: vi.fn(() => of([stockPrueba])) };
  const exportacion = { exportando: signal(false), exportar: vi.fn() };
  let fixture: ComponentFixture<StockActual>;

  beforeEach(async () => {
    vi.clearAllMocks();
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
    expect(raiz.querySelector('#inventario-filtro-proyecto')).toBeNull();
  });

  it('exporta con filtros actuales aunque no se haya pulsado Filtrar y sin proyecto', async () => {
    await seleccionarInventario(fixture, '#inventario-filtro-especialidad', 'Eléctrica');
    botonInventario(fixture, 'Exportar a Excel').click();

    expect(exportacion.exportar).toHaveBeenCalledWith(
      { idEspecialidad: 2, fechaDesde: null, fechaHasta: null },
      false,
    );
    expect(api.listarStockActual).toHaveBeenCalledTimes(1);
  });
});
