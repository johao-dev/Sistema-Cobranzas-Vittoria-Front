import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorItemSalida } from './editor-item-salida';
import { materialesPrueba } from '../inventario.fixture';
import {
  botonInventario,
  simularDialogosInventario,
  restaurarDialogosInventario,
  seleccionarInventario,
  escribirInventario,
} from '../pruebas/dom-inventario';

describe('EditorItemSalida — selección y cantidad', () => {
  let fixture: ComponentFixture<EditorItemSalida>;

  beforeEach(async () => {
    simularDialogosInventario();
    fixture = TestBed.createComponent(EditorItemSalida);
    fixture.componentRef.setInput('materiales', materialesPrueba.slice(0, 2));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  it('agrega cantidad cero con nombre/código/unidad del material seleccionado', async () => {
    const guardar = vi.fn();

    fixture.componentInstance.guardar.subscribe(guardar);
    await seleccionarInventario(fixture, 'select', 'Cable');
    botonInventario(fixture, 'Agregar ítem').click();

    expect(guardar).toHaveBeenCalledWith({
      idMaterial: 10,
      codigoMaterial: 'C10',
      nombre: 'Cable',
      unidadMedida: 'M',
      cantidad: 0,
      observacion: '',
    });
  });

  it('rechaza cantidades negativas y no emite un ítem', async () => {
    const guardar = vi.fn();

    fixture.componentInstance.guardar.subscribe(guardar);
    await seleccionarInventario(fixture, 'select', 'Cable');
    await escribirInventario(fixture, 'input[type=number]', '-1');
    botonInventario(fixture, 'Agregar ítem').click();
    await fixture.whenStable();

    expect(guardar).not.toHaveBeenCalled();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('mayor o igual a 0');
  });
});
