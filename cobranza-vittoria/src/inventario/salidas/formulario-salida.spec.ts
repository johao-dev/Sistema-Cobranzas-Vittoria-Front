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
  seleccionarInventario,
  escribirInventario,
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

  it.each([
    ['un material', ['Cable']],
    ['materiales de la misma especialidad', ['Cable', 'Tubo']],
    ['materiales de distintas especialidades', ['Cable', 'Cemento']],
  ])(
    'crea salida con %s seleccionando especialidad dentro de cada ítem',
    async (_caso, nombres) => {
      botonInventario(fixture, 'Limpiar').click();
      await fixture.whenStable();
      await seleccionarInventario(fixture, '#formulario-salida-campo-3', 'Obra');
      await escribirInventario(fixture, '#formulario-salida-campo-5', 'Residente');

      const raiz: HTMLElement = fixture.nativeElement;

      expect(raiz.querySelector('#formulario-salida-campo-1')).toBeNull();
      for (const nombre of nombres) {
        botonInventario(fixture, '+ Agregar ítem').click();
        await fixture.whenStable();

        expect(raiz.querySelector<HTMLSelectElement>('#editor-item-salida-campo-1')?.disabled).toBe(
          true,
        );
        await seleccionarInventario(
          fixture,
          '#editor-item-salida-especialidad',
          nombre === 'Cemento' ? 'Civil' : 'Eléctrica',
        );
        await seleccionarInventario(fixture, '#editor-item-salida-campo-1', nombre);
        await escribirInventario(fixture, '#editor-item-salida-campo-2', '1.15');
        botonInventario(fixture, 'Agregar ítem').click();
        await fixture.whenStable();
      }

      expect(raiz.querySelectorAll('.data-table tbody tr')).toHaveLength(nombres.length);
      expect(raiz.querySelector('.data-table')?.textContent).toContain('Cable');
      botonInventario(fixture, 'Guardar').click();

      expect(api.crearSalida).toHaveBeenCalledWith({
        idKardexSalida: null,
        idProyecto: 3,
        fecha: expect.any(String),
        solicitante: 'Residente',
        numeroDocumento: null,
        observacion: null,
        items: nombres.map((nombre) => ({
          idMaterial: materialesPrueba.find((material) => material.descripcion === nombre)
            ?.idMaterial,
          cantidad: 1.15,
          observacion: null,
        })),
      });
    },
  );

  it('preselecciona especialidad desde Material al editar y conserva otros ítems al cambiarla', async () => {
    botonInventario(fixture, 'Editar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const especialidad = raiz.querySelector<HTMLSelectElement>('#editor-item-salida-especialidad');
    const material = raiz.querySelector<HTMLSelectElement>('#editor-item-salida-campo-1');

    expect(especialidad?.selectedOptions[0].textContent).toContain('Eléctrica');
    expect(material?.selectedOptions[0].textContent).toContain('Cable');
    await seleccionarInventario(fixture, '#editor-item-salida-especialidad', 'Civil');
    await seleccionarInventario(fixture, '#editor-item-salida-campo-1', 'Cemento');
    botonInventario(fixture, 'Guardar cambios').click();
    await fixture.whenStable();
    botonInventario(fixture, 'Guardar').click();

    expect(api.actualizarSalida).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        items: [
          { idMaterial: 12, cantidad: 0, observacion: 'Ítem' },
          { idMaterial: 11, cantidad: 2, observacion: 'Ítem' },
        ],
      }),
    );
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
