import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorItemSalida } from './editor-item-salida';
import { materialesPrueba } from '../inventario.fixture';
import {
  botonInventario,
  especialidadesPrueba,
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
    fixture.componentRef.setInput('materiales', materialesPrueba);
    fixture.componentRef.setInput('especialidades', especialidadesPrueba);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  it('agrega cantidad cero con nombre/código/unidad del material seleccionado', async () => {
    const guardar = vi.fn();

    fixture.componentInstance.guardar.subscribe(guardar);
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Eléctrica');
    await seleccionarInventario(fixture, '#editor-item-salida-campo-1', 'Cable');
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

  it('bloquea material hasta seleccionar especialidad y limpia solo su selección al cambiarla', async () => {
    const raiz: HTMLElement = fixture.nativeElement;
    const material = raiz.querySelector<HTMLSelectElement>('#editor-item-salida-campo-1');

    expect(material?.disabled).toBe(true);
    expect(botonInventario(fixture, 'Agregar ítem').disabled).toBe(true);
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Eléctrica');

    expect(material?.disabled).toBe(false);
    expect(material?.textContent).toContain('Cable');
    expect(material?.textContent).not.toContain('Cemento');
    await seleccionarInventario(fixture, '#editor-item-salida-campo-1', 'Cable');
    await escribirInventario(fixture, 'input[type=number]', '2.25');
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Civil');

    expect(material?.textContent).toContain('Cemento');
    expect(material?.textContent).not.toContain('Cable');
    expect(botonInventario(fixture, 'Agregar ítem').disabled).toBe(true);
    expect(raiz.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe('2.25');
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Seleccionar');

    expect(material?.disabled).toBe(true);
  });

  it('rechaza cantidades negativas y no emite un ítem', async () => {
    const guardar = vi.fn();

    fixture.componentInstance.guardar.subscribe(guardar);
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Eléctrica');
    await seleccionarInventario(fixture, '#editor-item-salida-campo-1', 'Cable');
    await escribirInventario(fixture, 'input[type=number]', '-1');
    botonInventario(fixture, 'Agregar ítem').click();
    await fixture.whenStable();

    expect(guardar).not.toHaveBeenCalled();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('mayor o igual a 0');
  });
});
