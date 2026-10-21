import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { KardexCompras } from './kardex-compras';
import { SalidaDesdeCompra } from './salida-desde-compra';
import { RegistroKardexCompras } from './registro-kardex-compras';
import { movimientoPrueba } from '../inventario.fixture';
import { proveedoresCatalogosPrueba } from '../pruebas/dom-inventario';

describe('KardexCompras — tabla y coordinación', () => {
  it('mantiene los movimientos sin agregarlos y recarga después de una salida', async () => {
    const api = {
      movimientos: vi.fn(() =>
        of([
          movimientoPrueba,
          { ...movimientoPrueba, Salida: 5 },
          { ...movimientoPrueba, IdMaterial: 11, Material: 'Tubo' },
        ]),
      ),
    };

    TestBed.configureTestingModule({
      providers: [...proveedoresCatalogosPrueba, { provide: RegistroKardexCompras, useValue: api }],
    });

    const fixture = TestBed.createComponent(KardexCompras);

    fixture.detectChanges();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(raiz.textContent).toContain('Compra 2');

    const salida = fixture.debugElement.query(By.directive(SalidaDesdeCompra))
      .componentInstance as SalidaDesdeCompra;

    expect(salida.compras()).toHaveLength(2);
    salida.registrada.emit('Salida confirmada');
    await fixture.whenStable();

    expect(api.movimientos).toHaveBeenCalledTimes(2);
    expect(raiz.textContent).toContain('Salida confirmada');
  });
});
