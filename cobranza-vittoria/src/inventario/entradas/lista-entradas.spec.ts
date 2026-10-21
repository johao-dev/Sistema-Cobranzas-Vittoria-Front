import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ListaEntradas } from './lista-entradas';
import { RegistroInventario } from '../registro-inventario';
import { NotificationService } from '../../app/core/services/notification.service';
import { entradaPrueba } from '../inventario.fixture';
import {
  proveedoresCatalogosPrueba,
  escribirInventario,
  seleccionarInventario,
} from '../pruebas/dom-inventario';

describe('ListaEntradas — búsqueda y eliminación', () => {
  it('busca fecha civil y tildes y respeta cancelación de eliminación', async () => {
    const api = { listarEntradas: vi.fn(() => of([entradaPrueba])), eliminarEntrada: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ...proveedoresCatalogosPrueba,
        { provide: RegistroInventario, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(ListaEntradas);

    fixture.detectChanges();
    await fixture.whenStable();
    await escribirInventario(fixture, 'input[placeholder="Buscar entradas"]', '20/10/2026');

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await seleccionarInventario(fixture, '.actions-select', 'Eliminar');

    expect(api.eliminarEntrada).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
