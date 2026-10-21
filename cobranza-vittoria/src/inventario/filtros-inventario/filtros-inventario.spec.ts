import { TestBed } from '@angular/core/testing';

import { FiltrosInventario } from './filtros-inventario';
import {
  especialidadesPrueba,
  botonInventario,
  escribirInventario,
} from '../pruebas/dom-inventario';

describe('FiltrosInventario — rango de fechas y limpieza', () => {
  it('rechaza fechas invertidas, limpia y no envía proyecto al stock', async () => {
    const fixture = TestBed.createComponent(FiltrosInventario);

    fixture.componentRef.setInput('especialidades', especialidadesPrueba);
    fixture.componentRef.setInput('mostrarProyecto', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const consultar = vi.fn();

    fixture.componentInstance.consultar.subscribe(consultar);
    await escribirInventario(fixture, '#inventario-filtro-desde', '2026-10-21');
    await escribirInventario(fixture, '#inventario-filtro-hasta', '2026-10-20');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    expect(consultar).not.toHaveBeenCalled();
    botonInventario(fixture, 'Limpiar filtros').click();

    expect(consultar).toHaveBeenCalledWith({
      idEspecialidad: null,
      fechaDesde: null,
      fechaHasta: null,
    });
  });
});
