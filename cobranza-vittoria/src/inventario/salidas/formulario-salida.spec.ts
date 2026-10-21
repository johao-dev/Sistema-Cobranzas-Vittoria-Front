import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of } from 'rxjs';

import { FormularioSalida } from './formulario-salida';
import { EditorItemSalida } from './editor-item-salida';
import { RegistroInventario } from '../registro-inventario';
import { KardexSalidaResponseDto } from '../contratos-inventario';
import { salidasPrueba, materialesPrueba } from '../inventario.fixture';
import {
  botonInventario,
  especialidadesPrueba,
  proyectosPrueba,
  simularDialogosInventario,
  restaurarDialogosInventario,
} from '../pruebas/dom-inventario';

describe('FormularioSalida — edición de cabecera y todos sus ítems', () => {
  const api = {
    crearSalida: vi.fn(() => of(salidasPrueba)),
    actualizarSalida: vi.fn<() => Observable<KardexSalidaResponseDto[]>>(),
  };
  let fixture: ComponentFixture<FormularioSalida>;

  beforeEach(async () => {
    vi.resetAllMocks();
    api.actualizarSalida.mockReturnValue(of(salidasPrueba));
    simularDialogosInventario();
    TestBed.configureTestingModule({ providers: [{ provide: RegistroInventario, useValue: api }] });
    fixture = TestBed.createComponent(FormularioSalida);
    fixture.componentRef.setInput('filas', salidasPrueba);
    fixture.componentRef.setInput('especialidades', especialidadesPrueba);
    fixture.componentRef.setInput('materiales', materialesPrueba);
    fixture.componentRef.setInput('proyectos', proyectosPrueba);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  it('reconstruye la salida completa y conserva observación de cada línea', () => {
    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Cable');
    expect(raiz.textContent).toContain('Tubo');
    botonInventario(fixture, 'Guardar').click();

    expect(api.actualizarSalida).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        idKardexSalida: 4,
        items: [
          { idMaterial: 10, cantidad: 0, observacion: 'Ítem' },
          { idMaterial: 11, cantidad: 2, observacion: 'Ítem' },
        ],
      }),
    );
  });

  it('editor usa borrador y cancelar no altera el DTO original', async () => {
    botonInventario(fixture, 'Editar').click();
    await fixture.whenStable();

    const editor = fixture.debugElement.query(By.directive(EditorItemSalida))
      .componentInstance as EditorItemSalida;

    expect(editor.item()?.cantidad).toBe(0);
    editor.cerrar.emit();
    await fixture.whenStable();
    botonInventario(fixture, 'Guardar').click();

    expect(api.actualizarSalida).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ idMaterial: 10, cantidad: 0 })]),
      }),
    );
  });

  it('guardar un ítem sustituye solo su posición y quitar solicita confirmación', async () => {
    botonInventario(fixture, 'Editar').click();
    await fixture.whenStable();

    const editor = fixture.debugElement.query(By.directive(EditorItemSalida))
      .componentInstance as EditorItemSalida;
    const item = editor.item();
    if (!item) throw new Error('Falta ítem');

    editor.guardar.emit({ ...item, cantidad: 7 });
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    botonInventario(fixture, 'Quitar').click();
    botonInventario(fixture, 'Guardar').click();

    expect(api.actualizarSalida).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        items: [
          { idMaterial: 10, cantidad: 7, observacion: 'Ítem' },
          { idMaterial: 11, cantidad: 2, observacion: 'Ítem' },
        ],
      }),
    );
    expect(salidasPrueba[0].cantidad).toBe(0);
  });

  it('bloquea duplicados durante PUT y muestra errores de stock sin cerrar', async () => {
    const respuesta = new Subject<KardexSalidaResponseDto[]>();

    api.actualizarSalida.mockReturnValue(respuesta);

    const guardada = vi.fn();

    fixture.componentInstance.guardada.subscribe(guardada);
    botonInventario(fixture, 'Guardar').click();
    await fixture.whenStable();

    expect(botonInventario(fixture, 'Guardar').disabled).toBe(true);
    botonInventario(fixture, 'Guardar').click();
    respuesta.error({ error: { message: 'Stock insuficiente' } });
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Stock insuficiente');
    expect(botonInventario(fixture, 'Guardar').disabled).toBe(false);
    expect(guardada).not.toHaveBeenCalled();
    expect(api.actualizarSalida).toHaveBeenCalledOnce();
  });
});
