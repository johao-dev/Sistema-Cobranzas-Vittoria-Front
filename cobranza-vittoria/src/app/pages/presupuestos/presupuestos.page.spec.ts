import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresupuestosPage } from './presupuestos.page';
import { ArbolPresupuestarioComponent } from '../control-presupuestario/arbol/arbol-presupuestario.component';
import {
  ArbolPresupuestario,
  ControlPresupuestarioService,
  NodoArbol,
} from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';

const DETALLE = {
  idPresupuestoDetalle: 30,
  idCatalogoPartida: 2,
  codigo: '01.01',
  nombre: 'Concreto',
  montoPresupuestado: 100,
  observacion: 'Incluye transporte',
};

function datosArbol(monto = 100): ArbolPresupuestario {
  const hoja: NodoArbol = {
    idCatalogoPartida: 2,
    idPresupuestoDetalle: 30,
    codigo: '01.01',
    nombre: 'Concreto',
    idPartidaPadre: 1,
    nivel: 2,
    esHoja: true,
    cantidadHijas: 0,
    cantidadHojas: 1,
    montoPresupuestado: monto,
    montoComprometido: 0,
    montoEjecutado: 0,
    saldoDisponible: monto,
    porcentajeComprometido: 0,
    porcentajeEjecutado: 0,
    excedido: false,
    partidasExcedidas: 0,
  };
  return {
    encabezado: {
      idCentroCosto: 5,
      codigoCentroCosto: 'OBRA',
      nombreCentroCosto: 'Obra',
      idPresupuesto: 10,
      idPresupuestoVersion: 20,
      estadoPresupuesto: 'EN_ELABORACION',
      codigoMoneda: 'PEN',
      simboloMoneda: 'S/',
    },
    totales: { ...hoja, cantidadPartidas: 1 },
    nodos: [
      {
        ...hoja,
        idCatalogoPartida: 1,
        idPresupuestoDetalle: null,
        codigo: '01',
        nombre: 'Estructuras',
        idPartidaPadre: null,
        nivel: 1,
        esHoja: false,
        cantidadHijas: 1,
      },
      hoja,
    ],
  };
}

describe('Presupuestos con árbol como vista única sin Zone.js', () => {
  let fixture: ComponentFixture<PresupuestosPage>;
  let pagina: PresupuestosPage;
  let arbol: ArbolPresupuestarioComponent;
  let raiz: HTMLElement;
  const api = {
    detalles: vi.fn(),
    arbolVersion: vi.fn(),
    arbolVigente: vi.fn(),
    actualizarDetalle: vi.fn(),
    agregarDetalle: vi.fn(),
    eliminarDetalle: vi.fn(),
    registrarAjuste: vi.fn(),
    movimientos: vi.fn(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockReset());
    notificaciones.show.mockReset();
    api.detalles.mockReturnValue(of([DETALLE]));
    api.arbolVersion.mockReturnValue(of(datosArbol()));
    api.arbolVigente.mockReturnValue(of(datosArbol()));
    api.actualizarDetalle.mockReturnValue(of({}));
    api.agregarDetalle.mockReturnValue(of({}));
    api.eliminarDetalle.mockReturnValue(of({}));
    api.registrarAjuste.mockReturnValue(of({}));
    api.movimientos.mockReturnValue(of([]));
    // Esta entrega verifica el detalle de una versión; la bandeja y sus catálogos no cambian.
    vi.spyOn(PresupuestosPage.prototype, 'ngOnInit').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [PresupuestosPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ControlPresupuestarioService, useValue: api },
        { provide: NotificationService, useValue: notificaciones },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PresupuestosPage);
    pagina = fixture.componentInstance;
    pagina.seleccionado = { idPresupuesto: 10, nombre: 'Obra', simboloMoneda: 'S/' };
    pagina.seleccionarVersion({ idPresupuestoVersion: 20, numeroVersion: 1, estado: 'BORRADOR' });
    await fixture.whenStable();
    const instancia: unknown = fixture.debugElement.query(
      By.directive(ArbolPresupuestarioComponent),
    ).componentInstance;
    if (!(instancia instanceof ArbolPresupuestarioComponent)) throw new Error('Falta el árbol');
    arbol = instancia;
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('Falta la página');
    raiz = elemento;
    arbol.expandirTodo();
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  function boton(nombre: string): HTMLButtonElement {
    const encontrado = raiz.querySelector<HTMLButtonElement>(`button[aria-label="${nombre}"]`);
    if (!encontrado) throw new Error(`Falta el botón ${nombre}`);
    return encontrado;
  }

  it('muestra observación y cuatro acciones solo en la hoja, sin selector de vistas', () => {
    expect(raiz.querySelector('.vista-toggle')).toBeNull();
    expect(raiz.querySelectorAll('.arbol-acciones-partida')).toHaveLength(1);
    expect(raiz.querySelector('.arbol-observacion')?.textContent).toContain(DETALLE.observacion);
    expect(boton('Editar 01.01').disabled).toBe(false);
    expect(boton('Quitar 01.01').disabled).toBe(false);
    expect(boton('Historial de 01.01')).toBeTruthy();
    expect(boton('Ajustar 01.01')).toBeTruthy();
  });

  it('abre el editor existente sin disparar el historial y envía el mismo detalle', async () => {
    boton('Editar 01.01').click();
    await fixture.whenStable();
    expect(pagina.modalDetalle).toBe(true);
    expect(pagina.formDetalle.observacion).toBe(DETALLE.observacion);
    expect(api.movimientos).not.toHaveBeenCalled();
    pagina.formDetalle.montoPresupuestado = 200;
    pagina.guardarDetalle();
    await fixture.whenStable();
    expect(api.actualizarDetalle).toHaveBeenCalledWith(
      10,
      20,
      30,
      expect.objectContaining({ montoPresupuestado: 200 }),
    );
    expect(api.agregarDetalle).not.toHaveBeenCalled();
    expect(api.arbolVersion).toHaveBeenCalledTimes(2);
  });

  it('abre el historial de la hoja una sola vez', () => {
    boton('Historial de 01.01').click();
    expect(pagina.modalMovimientos).toBe(true);
    expect(api.movimientos).toHaveBeenCalledExactlyOnceWith(10, 20, 30);
  });

  it('conserva Ajuste disponible en una versión aprobada y refresca al guardarlo', async () => {
    pagina.seleccionarVersion({ idPresupuestoVersion: 20, numeroVersion: 1, estado: 'APROBADO' });
    await fixture.whenStable();
    expect(boton('Editar 01.01').disabled).toBe(true);
    expect(boton('Quitar 01.01').disabled).toBe(true);
    boton('Ajustar 01.01').click();
    expect(pagina.modalAjuste).toBe(true);
    pagina.formAjuste.monto = 10;
    pagina.formAjuste.observacion = 'Corrección';
    pagina.registrarAjuste();
    await fixture.whenStable();
    expect(api.registrarAjuste).toHaveBeenCalledWith(
      10,
      20,
      30,
      expect.objectContaining({ monto: 10 }),
    );
    expect(api.arbolVersion).toHaveBeenCalledTimes(2);
    arbol.emitirAccion('editar', datosArbol().nodos[1]);
    expect(pagina.modalDetalle).toBe(false);
  });

  it('confirma Quitar y conserva la rama al recargar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    boton('Quitar 01.01').click();
    await fixture.whenStable();
    expect(api.eliminarDetalle).toHaveBeenCalledExactlyOnceWith(10, 20, 30);
    expect(api.arbolVersion).toHaveBeenCalledTimes(2);
    expect(arbol.estaExpandido(datosArbol().nodos[0])).toBe(true);
  });

  it('conserva filtros, selección, tabla y desplazamiento durante la actualización', async () => {
    arbol.busqueda = 'Concreto';
    arbol.onBusqueda();
    arbol.nivelMaximo = '2';
    arbol.seleccionado = datosArbol().nodos[1];
    fixture.detectChanges();
    const tabla = raiz.querySelector<HTMLElement>('.arbol-tabla');
    if (!tabla) throw new Error('Falta la tabla');
    tabla.scrollTop = 250;
    tabla.scrollLeft = 100;
    const respuesta = new Subject<ArbolPresupuestario>();
    api.arbolVersion.mockReturnValue(respuesta);
    pagina.cargarDetalles(true);
    await fixture.whenStable();
    expect(raiz.querySelector('.arbol-tabla')).toBe(tabla);
    expect(boton('Editar 01.01').disabled).toBe(true);
    respuesta.next(datosArbol(200));
    respuesta.complete();
    await fixture.whenStable();
    expect(arbol.busqueda).toBe('Concreto');
    expect(arbol.nivelMaximo).toBe('2');
    expect(arbol.seleccionado?.idCatalogoPartida).toBe(2);
    expect(arbol.estaExpandido(datosArbol().nodos[0])).toBe(true);
    expect(raiz.querySelector('.arbol-tabla')).toBe(tabla);
    expect(tabla.scrollTop).toBe(250);
    expect(tabla.scrollLeft).toBe(100);
    expect(arbol.datos?.totales.montoPresupuestado).toBe(200);
    expect(arbol.filas[0].nodo.montoPresupuestado).toBe(200);
  });

  it('permite reintentar una recarga fallida sin perder la navegación', async () => {
    api.arbolVersion.mockReturnValue(throwError(() => new Error('Sin conexión')));
    pagina.cargarDetalles(true);
    await fixture.whenStable();
    expect(arbol.error).toBeTruthy();
    expect(arbol.filas).toHaveLength(2);
    api.arbolVersion.mockReturnValue(of(datosArbol(200)));
    const reintento = Array.from(raiz.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reintentar',
    );
    reintento?.click();
    await fixture.whenStable();
    expect(arbol.error).toBe('');
    expect(arbol.filas).toHaveLength(2);
  });

  it('bloquea envíos duplicados y preserva el editor cuando falla el guardado', async () => {
    const respuesta = new Subject<object>();
    api.actualizarDetalle.mockReturnValue(respuesta);
    boton('Editar 01.01').click();
    pagina.guardarDetalle();
    pagina.guardarDetalle();
    expect(api.actualizarDetalle).toHaveBeenCalledTimes(1);
    respuesta.error(new Error('Error al guardar'));
    await fixture.whenStable();
    expect(pagina.guardando).toBe(false);
    expect(pagina.modalDetalle).toBe(true);
    expect(api.arbolVersion).toHaveBeenCalledTimes(1);
  });

  it('cancela consultas al cambiar de versión e ignora resultados anteriores', async () => {
    const respuestaArbol = new Subject<ArbolPresupuestario>();
    const respuestaDetalles = new Subject<(typeof DETALLE)[]>();
    api.arbolVersion.mockReturnValue(respuestaArbol);
    api.detalles.mockReturnValue(respuestaDetalles);
    pagina.cargarDetalles(true);
    await fixture.whenStable();
    api.arbolVersion.mockReturnValue(of(datosArbol()));
    api.detalles.mockReturnValue(of([]));
    pagina.seleccionarVersion({ idPresupuestoVersion: 21, estado: 'APROBADO' });
    await fixture.whenStable();
    respuestaDetalles.next([DETALLE]);
    respuestaArbol.next(datosArbol(999));
    await fixture.whenStable();
    expect(pagina.detalles).toEqual([]);
    expect(arbol.busqueda).toBe('');
    expect(arbol.filas).toHaveLength(1);
    expect(arbol.datos?.totales.montoPresupuestado).toBe(100);
  });

  it('mantiene el árbol de seguimiento sin las acciones de edición', async () => {
    const seguimiento = TestBed.createComponent(ArbolPresupuestarioComponent);
    seguimiento.componentRef.setInput('idCentroCosto', 5);
    await seguimiento.whenStable();
    seguimiento.componentInstance.expandirTodo();
    seguimiento.detectChanges();
    const elemento: unknown = seguimiento.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('Falta seguimiento');
    expect(elemento.querySelector('.arbol-acciones-partida')).toBeNull();
    expect(elemento.querySelector('.arbol-movimientos')?.textContent).toContain('Movimientos');
    seguimiento.destroy();
  });
});
