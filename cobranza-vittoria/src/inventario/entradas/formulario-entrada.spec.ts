import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';

import { FormularioEntrada } from './formulario-entrada';
import { RegistroInventario } from '../registro-inventario';
import { KardexEntradaResponseDto } from '../contratos-inventario';
import { entradaPrueba, materialesPrueba } from '../inventario.fixture';
import {
  botonInventario,
  especialidadesPrueba,
  proyectosPrueba,
  simularDialogosInventario,
  restaurarDialogosInventario,
  seleccionarInventario,
} from '../pruebas/dom-inventario';

describe('FormularioEntrada — guardado y estado sin Zone.js', () => {
  const api = {
    crearEntrada: vi.fn(() => of(entradaPrueba)),
    actualizarEntrada: vi.fn<() => Observable<KardexEntradaResponseDto>>(),
  };
  let fixture: ComponentFixture<FormularioEntrada>;

  beforeEach(async () => {
    vi.resetAllMocks();
    api.actualizarEntrada.mockReturnValue(of(entradaPrueba));
    simularDialogosInventario();
    TestBed.configureTestingModule({ providers: [{ provide: RegistroInventario, useValue: api }] });
    fixture = TestBed.createComponent(FormularioEntrada);
    fixture.componentRef.setInput('entrada', entradaPrueba);
    fixture.componentRef.setInput('especialidades', especialidadesPrueba);
    fixture.componentRef.setInput('materiales', materialesPrueba);
    fixture.componentRef.setInput('proyectos', proyectosPrueba);
    fixture.componentRef.setInput('proveedores', []);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  it('edita sin mutar la fila, conserva cero y emite resultado de actualización', () => {
    const guardada = vi.fn();

    fixture.componentInstance.guardada.subscribe(guardada);
    botonInventario(fixture, 'Guardar').click();

    expect(api.actualizarEntrada).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ idKardexEntrada: 1, cantidad: 0, fecha: '2026-10-20' }),
    );
    expect(guardada).toHaveBeenCalledWith('Entrada actualizada correctamente.');
    expect(entradaPrueba.cantidad).toBe(0);
  });

  it('cambiar especialidad limpia material y filtra opciones', async () => {
    await seleccionarInventario(fixture, '#formulario-entrada-campo-1', 'Civil');

    const raiz: HTMLElement = fixture.nativeElement;
    const material = raiz.querySelector('#formulario-entrada-campo-5');

    expect(material?.textContent).toContain('Cemento');
    expect(material?.textContent).not.toContain('Cable');
    expect(botonInventario(fixture, 'Guardar').disabled).toBe(true);
  });

  it('mantiene el bloqueo de material hasta seleccionar especialidad al crear una entrada', async () => {
    botonInventario(fixture, 'Limpiar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const material = raiz.querySelector<HTMLSelectElement>('#formulario-entrada-campo-5');

    expect(material?.disabled).toBe(true);
    await seleccionarInventario(fixture, '#formulario-entrada-campo-1', 'Civil');

    expect(material?.disabled).toBe(false);
    expect(material?.textContent).not.toContain('Cable');
    await seleccionarInventario(fixture, '#formulario-entrada-campo-5', 'Cemento');
    await seleccionarInventario(fixture, '#formulario-entrada-campo-4', 'Obra');
    botonInventario(fixture, 'Guardar').click();

    expect(api.crearEntrada).toHaveBeenCalledWith(expect.objectContaining({ idMaterial: 12 }));
    expect(api.crearEntrada).not.toHaveBeenCalledWith(
      expect.objectContaining({ idEspecialidad: expect.anything() }),
    );
  });

  it('bloquea duplicados y cierre mientras guarda, y restaura formulario tras 422', async () => {
    const respuesta = new Subject<KardexEntradaResponseDto>();

    api.actualizarEntrada.mockReturnValue(respuesta);

    const cerrar = vi.fn();

    fixture.componentInstance.cerrar.subscribe(cerrar);
    botonInventario(fixture, 'Guardar').click();
    await fixture.whenStable();

    expect(botonInventario(fixture, 'Guardar').disabled).toBe(true);
    botonInventario(fixture, 'Guardar').click();

    const raiz: HTMLElement = fixture.nativeElement;

    raiz.querySelector<HTMLButtonElement>('.modal-close')?.click();

    expect(cerrar).not.toHaveBeenCalled();
    respuesta.error({ error: { errores: [{ mensaje: 'Stock insuficiente' }] } });
    await fixture.whenStable();

    expect(api.actualizarEntrada).toHaveBeenCalledTimes(1);
    expect(raiz.textContent).toContain('Stock insuficiente');
    expect(botonInventario(fixture, 'Guardar').disabled).toBe(false);
  });
});
