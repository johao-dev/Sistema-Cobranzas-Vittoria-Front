import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaUnidadesMedida } from './lista-unidades-medida';
import { FormularioUnidadMedida } from '../formulario-unidad-medida/formulario-unidad-medida';
import { CatalogoUnidadesMedida } from '../catalogo-unidades-medida';
import { UnidadMedida } from '../contratos-unidades-medida';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  UNIDAD,
  UNIDAD_REQUEST,
  escribir,
  obtenerRaiz,
  obtenerElemento,
  simularDialogosNativos,
} from '../../pruebas/muestras-catalogos';

describe('ListaUnidadesMedida sin Zone.js', () => {
  let fixture: ComponentFixture<ListaUnidadesMedida>;
  let listado: Subject<UnidadMedida[]>;
  let guardado: Subject<{ idUnidadMedida: number }>;
  let api: Pick<CatalogoUnidadesMedida, 'unidadesMedida' | 'guardarUnidadMedida'>;
  let restaurarDialogos: () => void;

  beforeEach(async () => {
    restaurarDialogos = simularDialogosNativos();
    listado = new Subject<UnidadMedida[]>();
    guardado = new Subject<{ idUnidadMedida: number }>();
    api = {
      unidadesMedida: vi.fn<CatalogoUnidadesMedida['unidadesMedida']>().mockReturnValue(listado),
      guardarUnidadMedida: vi
        .fn<CatalogoUnidadesMedida['guardarUnidadMedida']>()
        .mockReturnValue(guardado),
    };
    await TestBed.configureTestingModule({
      imports: [ListaUnidadesMedida],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoUnidadesMedida, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaUnidadesMedida);
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
    listado.next([UNIDAD]);
    listado.complete();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    escribir(raiz, '#busqueda-unidades-medida', 'sin coincidencias');
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
      By.directive(FormularioUnidadMedida),
    ).componentInstance;
    if (!(formulario instanceof FormularioUnidadMedida))
      throw new Error('No se creó el formulario.');
    formulario.guardar.emit(UNIDAD_REQUEST);
    formulario.guardar.emit(UNIDAD_REQUEST);
    expect(api.guardarUnidadMedida).toHaveBeenCalledTimes(1);
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
    listado.next([UNIDAD]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioUnidadMedida),
    ).componentInstance;
    if (!(formulario instanceof FormularioUnidadMedida))
      throw new Error('No se creó el formulario.');
    vi.mocked(api.unidadesMedida).mockReturnValue(of([UNIDAD]));
    formulario.guardar.emit(UNIDAD_REQUEST);
    guardado.next({ idUnidadMedida: 2 });
    guardado.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(false);
    expect(api.unidadesMedida).toHaveBeenCalledTimes(2);
  });
});
