import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ListaTransferencias } from './lista-transferencias';
import { FormularioTransferencia } from '../formulario-transferencia/formulario-transferencia';
import { RegistroTransferenciasProyecto } from '../registro-transferencias-proyecto';
import { TransferenciaProyecto } from '../contratos-transferencias-proyecto';
import { transferenciasPrueba } from '../pruebas/transferencias.fixture';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  proveedoresCatalogosPrueba,
  botonInventario,
  seleccionarInventario,
  escribirInventario,
  simularDialogosInventario,
  restaurarDialogosInventario,
} from '../../pruebas/dom-inventario';

describe('ListaTransferencias — filtros, consulta y detalle', () => {
  const api = {
    listar: vi.fn<() => Observable<TransferenciaProyecto[]>>(),
    obtener: vi.fn<() => Observable<TransferenciaProyecto[]>>(),
  };
  const notificaciones = { show: vi.fn() };
  let fixture: ComponentFixture<ListaTransferencias>;

  beforeEach(async () => {
    vi.resetAllMocks();
    api.listar.mockReturnValue(of(transferenciasPrueba));
    api.obtener.mockReturnValue(of(transferenciasPrueba));
    simularDialogosInventario();
    TestBed.configureTestingModule({
      providers: [
        ...proveedoresCatalogosPrueba,
        { provide: RegistroTransferenciasProyecto, useValue: api },
        { provide: NotificationService, useValue: notificaciones },
      ],
    });
    fixture = TestBed.createComponent(ListaTransferencias);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(restaurarDialogosInventario);

  it('combina filtros, consulta todos los detalles y conserva cantidades', async () => {
    await escribirInventario(fixture, '#transferencias-id', '7');
    await seleccionarInventario(fixture, '#transferencias-origen', 'Obra');
    await seleccionarInventario(fixture, '#transferencias-destino', 'Obra');
    await escribirInventario(fixture, '#transferencias-desde', '2026-10-01');
    await escribirInventario(fixture, '#transferencias-hasta', '2026-10-22');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    expect(api.listar).toHaveBeenLastCalledWith({
      idTransferencia: 7,
      idProyectoOrigen: 3,
      idProyectoDestino: 3,
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-22',
    });
    botonInventario(fixture, 'Ver detalle').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(api.obtener).toHaveBeenCalledWith(7);
    expect(raiz.querySelector('dialog')?.textContent).toContain('Transferencia #7');
    expect(raiz.querySelector('dialog')?.textContent).toContain('Reasignación autorizada');
    expect(raiz.querySelectorAll('dialog tbody tr')).toHaveLength(2);
    expect(raiz.querySelector('dialog')?.textContent).toContain('3.25');
    botonInventario(fixture, 'Cerrar').click();
    await fixture.whenStable();
    botonInventario(fixture, 'Limpiar filtros').click();
    await fixture.whenStable();
    expect(api.listar).toHaveBeenLastCalledWith({});
  });

  it('rechaza fechas invertidas e ID no válido', async () => {
    await escribirInventario(fixture, '#transferencias-id', '0');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();
    expect(api.listar).toHaveBeenCalledOnce();
    await escribirInventario(fixture, '#transferencias-id', '7');
    await escribirInventario(fixture, '#transferencias-desde', '2026-10-23');
    await escribirInventario(fixture, '#transferencias-hasta', '2026-10-22');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('no puede ser posterior');
    expect(api.listar).toHaveBeenCalledOnce();
  });

  it('muestra 404 del detalle sin abrir un diálogo parcial y permite reintentar', async () => {
    api.obtener.mockReturnValue(
      throwError(() => ({ status: 404, error: { message: 'La transferencia no existe.' } })),
    );
    botonInventario(fixture, 'Ver detalle').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('La transferencia no existe');
    expect(raiz.querySelector('dialog')).toBeNull();
    api.obtener.mockReturnValue(of(transferenciasPrueba));
    botonInventario(fixture, 'Reintentar detalle').click();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('dialog tbody tr')).toHaveLength(2);
  });

  it('diferencia vacío, carga y error y recupera el listado', async () => {
    const respuesta = new Subject<TransferenciaProyecto[]>();

    api.listar.mockReturnValue(respuesta);
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Cargando transferencias');
    respuesta.error({ error: { message: 'Inventario no disponible' } });
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Inventario no disponible');
    api.listar.mockReturnValue(of([]));
    botonInventario(fixture, 'Reintentar').click();
    await fixture.whenStable();
    expect(raiz.textContent).toContain('No hay transferencias');
  });

  it('recarga los filtros aplicados después de registrar y muestra confirmación', async () => {
    botonInventario(fixture, 'Nueva transferencia').click();
    await fixture.whenStable();

    const formulario = fixture.debugElement.query(By.directive(FormularioTransferencia))
      .componentInstance as FormularioTransferencia;

    formulario.guardada.emit();
    await fixture.whenStable();
    expect(api.listar).toHaveBeenCalledTimes(2);
    expect(notificaciones.show).toHaveBeenCalledWith(
      'Transferencia registrada correctamente.',
      'success',
    );
    expect(fixture.debugElement.query(By.directive(FormularioTransferencia))).toBeNull();
  });
});
