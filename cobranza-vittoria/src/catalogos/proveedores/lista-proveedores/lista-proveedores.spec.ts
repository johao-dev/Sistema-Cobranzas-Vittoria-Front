import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaProveedores } from './lista-proveedores';
import { FormularioProveedor } from '../formulario-proveedor/formulario-proveedor';
import { CatalogoProveedores } from '../catalogo-proveedores';
import { Proveedor, DetalleProveedor } from '../contratos-proveedores';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  PROVEEDOR,
  PROVEEDOR_REQUEST,
  escribir,
  obtenerRaiz,
  obtenerElemento,
  simularDialogosNativos,
} from '../../pruebas/muestras-catalogos';

describe('ListaProveedores sin Zone.js', () => {
  let fixture: ComponentFixture<ListaProveedores>;
  let listado: Subject<Proveedor[]>;
  let guardado: Subject<{ idProveedor: number }>;
  let api: Pick<
    CatalogoProveedores,
    'proveedores' | 'guardarProveedor' | 'proveedor' | 'consultaRuc'
  >;
  let restaurarDialogos: () => void;

  beforeEach(async () => {
    restaurarDialogos = simularDialogosNativos();
    listado = new Subject<Proveedor[]>();
    guardado = new Subject<{ idProveedor: number }>();
    api = {
      proveedores: vi.fn<CatalogoProveedores['proveedores']>().mockReturnValue(listado),
      guardarProveedor: vi.fn<CatalogoProveedores['guardarProveedor']>().mockReturnValue(guardado),
      proveedor: vi
        .fn<CatalogoProveedores['proveedor']>()
        .mockReturnValue(of({ proveedor: PROVEEDOR, especialidades: [] })),
      consultaRuc: () =>
        of({
          razon_social: 'Proveedor',
          numero_documento: '20123456789',
          direccion: '',
          estado: 'ACTIVO',
        }),
    };
    await TestBed.configureTestingModule({
      imports: [ListaProveedores],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoProveedores, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaProveedores);
    await fixture.whenStable();
  });
  afterEach(() => {
    listado.complete();
    guardado.complete();
    restaurarDialogos();
  });

  it('muestra carga y datos asíncronos y filtra el listado', async () => {
    const raiz = obtenerRaiz(fixture.nativeElement);
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Cargando');
    listado.next([PROVEEDOR]);
    listado.complete();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    escribir(raiz, '#busqueda-proveedores', 'sin coincidencias');
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(0);
  });

  it('impide guardados duplicados y conserva el formulario ante un error HTTP', async () => {
    listado.next([]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioProveedor),
    ).componentInstance;
    if (!(formulario instanceof FormularioProveedor)) throw new Error('No se creó el formulario.');
    formulario.guardar.emit(PROVEEDOR_REQUEST);
    formulario.guardar.emit(PROVEEDOR_REQUEST);
    expect(api.guardarProveedor).toHaveBeenCalledTimes(1);
    guardado.error(
      new HttpErrorResponse({ status: 400, error: { message: 'Revisa el registro.' } }),
    );
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(true);
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Revisa el registro');
  });

  it('distingue un fallo del listado del estado vacío y cancela al salir', async () => {
    const raiz = obtenerRaiz(fixture.nativeElement);
    listado.error(new HttpErrorResponse({ status: 500 }));
    await fixture.whenStable();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar');
    expect(raiz.textContent).not.toContain('No se encontraron registros.');
    fixture.destroy();
    expect(listado.observed).toBe(false);
  });
  it('cierra el diálogo y actualiza el listado tras guardar correctamente', async () => {
    listado.next([PROVEEDOR]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioProveedor),
    ).componentInstance;
    if (!(formulario instanceof FormularioProveedor)) throw new Error('No se creó el formulario.');
    vi.mocked(api.proveedores).mockReturnValue(of([PROVEEDOR]));
    formulario.guardar.emit(PROVEEDOR_REQUEST);
    guardado.next({ idProveedor: 2 });
    guardado.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(false);
    expect(api.proveedores).toHaveBeenCalledTimes(2);
  });

  it('bloquea el guardado si no se pudo recuperar el detalle completo al editar', async () => {
    const pendiente = new Subject<DetalleProveedor>();
    vi.mocked(api.proveedor).mockReturnValue(pendiente);
    listado.next([PROVEEDOR]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, 'tbody button').click();
    await fixture.whenStable();
    pendiente.error(new HttpErrorResponse({ status: 500 }));
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioProveedor),
    ).componentInstance;
    if (!(formulario instanceof FormularioProveedor)) throw new Error('No se creó el formulario.');
    formulario.guardar.emit({ ...PROVEEDOR_REQUEST, idProveedor: 1 });
    expect(api.guardarProveedor).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar el detalle',
    );
  });
});
