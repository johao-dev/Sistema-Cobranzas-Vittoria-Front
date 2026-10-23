import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';

import { FormularioTransferencia } from './formulario-transferencia';
import { RegistroTransferenciasProyecto } from '../registro-transferencias-proyecto';
import { TransferenciaProyecto } from '../contratos-transferencias-proyecto';
import { transferenciasPrueba } from '../pruebas/transferencias.fixture';
import { materialesPrueba } from '../../inventario.fixture';
import {
  proyectosPrueba,
  botonInventario,
  seleccionarInventario,
  escribirInventario,
  simularDialogosInventario,
  restaurarDialogosInventario,
} from '../../pruebas/dom-inventario';

describe('FormularioTransferencia — registro manual', () => {
  const api = { crear: vi.fn<() => Observable<TransferenciaProyecto[]>>() };
  let fixture: ComponentFixture<FormularioTransferencia>;

  beforeEach(async () => {
    api.crear.mockReset().mockReturnValue(of(transferenciasPrueba));
    simularDialogosInventario();
    TestBed.configureTestingModule({
      providers: [{ provide: RegistroTransferenciasProyecto, useValue: api }],
    });
    fixture = TestBed.createComponent(FormularioTransferencia);
    fixture.componentRef.setInput('proyectos', [
      ...proyectosPrueba,
      { ...proyectosPrueba[0], idProyecto: 6, nombreProyecto: 'Destino' },
    ]);
    fixture.componentRef.setInput('materiales', materialesPrueba);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  async function completar(): Promise<void> {
    await seleccionarInventario(fixture, '#transferencia-origen', 'Obra');
    await seleccionarInventario(fixture, '#transferencia-destino', 'Destino');
    await escribirInventario(fixture, '#transferencia-fecha', '2026-10-22');
    botonInventario(fixture, 'Agregar material').click();
    await fixture.whenStable();
    await seleccionarInventario(fixture, 'select[aria-label="Material 1"]', 'Cable');
    await escribirInventario(fixture, 'input[aria-label="Cantidad 1"]', '3.25');
  }

  it('registra varios materiales y bloquea su duplicación en el selector', async () => {
    await completar();
    botonInventario(fixture, 'Agregar material').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const opciones = raiz.querySelector<HTMLSelectElement>(
      'select[aria-label="Material 2"]',
    )?.options;

    expect(
      Array.from(opciones ?? []).find((opcion) => opcion.textContent?.includes('Cable'))?.disabled,
    ).toBe(true);
    await seleccionarInventario(fixture, 'select[aria-label="Material 2"]', 'Tubo');
    await escribirInventario(fixture, 'input[aria-label="Cantidad 2"]', '1.15');
    const guardada = vi.fn();

    fixture.componentInstance.guardada.subscribe(guardada);
    botonInventario(fixture, 'Registrar transferencia').click();
    await fixture.whenStable();

    expect(api.crear).toHaveBeenCalledWith({
      idProyectoOrigen: 3,
      idProyectoDestino: 6,
      fecha: '2026-10-22',
      observacion: '',
      items: [
        { idMaterial: 10, cantidad: 3.25 },
        { idMaterial: 11, cantidad: 1.15 },
      ],
    });
    expect(guardada).toHaveBeenCalledOnce();
  });

  it('rechaza proyectos iguales aun si se fuerza la opción inhabilitada y exige ítems', async () => {
    await seleccionarInventario(fixture, '#transferencia-origen', 'Obra');
    await seleccionarInventario(fixture, '#transferencia-destino', 'Obra');
    botonInventario(fixture, 'Registrar transferencia').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('deben ser diferentes');
    await seleccionarInventario(fixture, '#transferencia-destino', 'Destino');
    botonInventario(fixture, 'Registrar transferencia').click();
    await fixture.whenStable();

    expect(raiz.textContent).toContain('Agregue al menos un material');
    expect(api.crear).not.toHaveBeenCalled();
  });

  it.each(['0', '-1'])('rechaza cantidad %s y conserva el borrador', async (cantidad) => {
    await completar();
    await escribirInventario(fixture, 'input[aria-label="Cantidad 1"]', cantidad);
    botonInventario(fixture, 'Registrar transferencia').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('mayor a 0');
    expect(api.crear).not.toHaveBeenCalled();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('impide envíos y cierre mientras guarda y recupera el borrador ante falta de stock', async () => {
    const respuesta = new Subject<TransferenciaProyecto[]>();

    api.crear.mockReturnValue(respuesta);
    await completar();
    const guardada = vi.fn();
    const cerrar = vi.fn();

    fixture.componentInstance.guardada.subscribe(guardada);
    fixture.componentInstance.cerrar.subscribe(cerrar);
    botonInventario(fixture, 'Registrar transferencia').click();
    await fixture.whenStable();
    botonInventario(fixture, 'Guardando…').click();
    botonInventario(fixture, 'Cancelar').click();

    const raiz: HTMLElement = fixture.nativeElement;

    raiz.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(cerrar).not.toHaveBeenCalled();
    expect(api.crear).toHaveBeenCalledOnce();
    respuesta.error({
      error: {
        errores: [
          {
            codigoError: 'STOCK_PROYECTO_INSUFICIENTE',
            mensaje: 'idMaterial=10 idProyecto=3 disponible=2.00 solicitado=3.25',
          },
        ],
      },
    });
    await fixture.whenStable();

    expect(raiz.textContent).toContain('Disponible: 2.00');
    expect(raiz.querySelector<HTMLInputElement>('input[aria-label="Cantidad 1"]')?.value).toBe(
      '3.25',
    );
    expect(botonInventario(fixture, 'Registrar transferencia').disabled).toBe(false);
    expect(guardada).not.toHaveBeenCalled();
    botonInventario(fixture, 'Cancelar').click();
    expect(cerrar).toHaveBeenCalledOnce();
  });
  it('inhabilita el origen como destino y limpia un destino que deja de ser válido al cambiar origen', async () => {
    await seleccionarInventario(fixture, '#transferencia-origen', 'Obra');

    const raiz: HTMLElement = fixture.nativeElement;
    const destino = raiz.querySelector<HTMLSelectElement>('#transferencia-destino');
    const opcion = (texto: string) =>
      Array.from(destino?.options ?? []).find((opcion) => opcion.textContent?.includes(texto));

    expect(opcion('Obra')?.disabled).toBe(true);
    expect(opcion('Destino')?.disabled).toBe(false);
    await seleccionarInventario(fixture, '#transferencia-destino', 'Destino');
    await seleccionarInventario(fixture, '#transferencia-origen', 'Destino');

    expect(destino?.selectedOptions[0].textContent).toContain('Seleccionar');
    expect(opcion('Destino')?.disabled).toBe(true);
    expect(opcion('Obra')?.disabled).toBe(false);
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('limita a diez líneas y permite volver a agregar después de quitar una', async () => {
    for (let i = 0; i < 10; i++) {
      botonInventario(fixture, 'Agregar material').click();
      await fixture.whenStable();
    }

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(botonInventario(fixture, 'Agregar material').disabled).toBe(true);
    expect(raiz.textContent).toContain('10/10');
    botonInventario(fixture, 'Agregar material').click();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(10);
    botonInventario(fixture, 'Quitar').click();
    await fixture.whenStable();

    expect(botonInventario(fixture, 'Agregar material').disabled).toBe(false);
    botonInventario(fixture, 'Agregar material').click();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(10);
  });
});
