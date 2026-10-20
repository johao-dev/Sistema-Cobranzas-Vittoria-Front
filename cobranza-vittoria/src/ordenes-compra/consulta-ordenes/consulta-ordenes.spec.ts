import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ConsultaOrdenes } from './consulta-ordenes';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { RegistroRequerimientos } from '../../requerimientos/registro-requerimientos';
import { DetalleOrdenCompra } from '../contratos-ordenes-compra';
import { detallePrueba, ordenPrueba, requerimientoPrueba } from '../ordenes-compra.fixture';

describe('ConsultaOrdenes', () => {
  const ordenes = {
    listar: vi.fn(() => of([ordenPrueba])),
    obtener: vi.fn<(id: number) => Observable<DetalleOrdenCompra>>(() => of(detallePrueba)),
  };
  const requerimientos = {
    listar: vi.fn(() => of([requerimientoPrueba.requerimiento])),
    obtener: vi.fn(() => of(requerimientoPrueba)),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    ordenes.listar.mockReturnValue(of([ordenPrueba]));
    ordenes.obtener.mockReturnValue(of(detallePrueba));
    requerimientos.listar.mockReturnValue(of([requerimientoPrueba.requerimiento]));
    requerimientos.obtener.mockReturnValue(of(requerimientoPrueba));
    TestBed.configureTestingModule({
      providers: [
        ConsultaOrdenes,
        { provide: RegistroOrdenesCompra, useValue: ordenes },
        { provide: RegistroRequerimientos, useValue: requerimientos },
      ],
    });
  });

  it('carga EnviadoOC y todas las órdenes, sin consumir catálogos ajenos', () => {
    const consulta = TestBed.inject(ConsultaOrdenes);
    expect(requerimientos.listar).toHaveBeenCalledWith({ estado: 'EnviadoOC' });
    expect(consulta.pendientes()).toEqual([requerimientoPrueba.requerimiento]);
    expect(consulta.ordenes()).toEqual([ordenPrueba]);
    expect(consulta.cargando()).toBe(false);
  });

  it('expone fallo parcial y permite recuperar sin borrar el listado ya cargado', () => {
    const consulta = TestBed.inject(ConsultaOrdenes);
    ordenes.listar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    consulta.recargar();
    expect(consulta.errorOrdenes()).toContain('No se pudieron cargar');
    expect(consulta.errorPendientes()).toBe('');
    expect(consulta.ordenes()).toEqual([ordenPrueba]);
    expect(consulta.cargando()).toBe(false);
    consulta.recargar();
    expect(consulta.errorOrdenes()).toBe('');
  });

  it('cancela un detalle anterior al seleccionar otro requerimiento y al cerrar', () => {
    const pendiente = new Subject<DetalleOrdenCompra>();
    const cancelada = vi.fn();
    ordenes.obtener.mockReturnValue(
      new Observable((subscriber) => {
        const suscripcion = pendiente.subscribe(subscriber);
        return () => {
          cancelada();
          suscripcion.unsubscribe();
        };
      }),
    );
    const consulta = TestBed.inject(ConsultaOrdenes);
    consulta.abrirOrden(8);
    expect(consulta.cargandoDetalle()).toBe(true);
    consulta.abrirRequerimiento(4);
    expect(cancelada).toHaveBeenCalledOnce();
    pendiente.next(detallePrueba);
    expect(consulta.seleccion()?.tipo).toBe('requerimiento');
    expect(consulta.cargandoDetalle()).toBe(false);
    consulta.cerrar();
    expect(consulta.seleccion()).toBeNull();
  });

  it('restaura la carga tras error y cancela lecturas al destruir su ámbito', () => {
    ordenes.obtener.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    const consulta = TestBed.inject(ConsultaOrdenes);
    consulta.abrirOrden(8);
    expect(consulta.cargandoDetalle()).toBe(false);
    expect(consulta.mensaje()).toContain('No se pudo cargar');
    expect(consulta.seleccion()).toBeNull();

    const cancelar = vi.fn();
    ordenes.obtener.mockReturnValue(new Observable(() => cancelar));
    consulta.abrirOrden(8);
    TestBed.resetTestingModule();
    expect(cancelar).toHaveBeenCalledOnce();
  });
});
