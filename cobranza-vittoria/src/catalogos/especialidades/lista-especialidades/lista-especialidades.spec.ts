import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaEspecialidades } from './lista-especialidades';
import { FormularioEspecialidad } from '../formulario-especialidad/formulario-especialidad';
import { CatalogoEspecialidades } from '../catalogo-especialidades';
import { Especialidad } from '../contratos-especialidades';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  ESPECIALIDAD,
  ESPECIALIDAD_REQUEST,
  escribir,
  obtenerRaiz,
  obtenerElemento,
  simularDialogosNativos,
} from '../../pruebas/muestras-catalogos';

describe('ListaEspecialidades sin Zone.js', () => {
  let fixture: ComponentFixture<ListaEspecialidades>;
  let listado: Subject<Especialidad[]>;
  let guardado: Subject<{ idEspecialidad: number }>;
  let api: Pick<CatalogoEspecialidades, 'especialidades' | 'guardarEspecialidad'>;
  let restaurarDialogos: () => void;

  beforeEach(async () => {
    restaurarDialogos = simularDialogosNativos();
    listado = new Subject<Especialidad[]>();
    guardado = new Subject<{ idEspecialidad: number }>();
    api = {
      especialidades: vi.fn<CatalogoEspecialidades['especialidades']>().mockReturnValue(listado),
      guardarEspecialidad: vi
        .fn<CatalogoEspecialidades['guardarEspecialidad']>()
        .mockReturnValue(guardado),
    };
    await TestBed.configureTestingModule({
      imports: [ListaEspecialidades],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoEspecialidades, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaEspecialidades);
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
    listado.next([ESPECIALIDAD]);
    listado.complete();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    escribir(raiz, '#busqueda-especialidades', 'sin coincidencias');
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
      By.directive(FormularioEspecialidad),
    ).componentInstance;
    if (!(formulario instanceof FormularioEspecialidad))
      throw new Error('No se creó el formulario.');
    formulario.guardar.emit(ESPECIALIDAD_REQUEST);
    formulario.guardar.emit(ESPECIALIDAD_REQUEST);
    expect(api.guardarEspecialidad).toHaveBeenCalledTimes(1);
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
    listado.next([ESPECIALIDAD]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioEspecialidad),
    ).componentInstance;
    if (!(formulario instanceof FormularioEspecialidad))
      throw new Error('No se creó el formulario.');
    vi.mocked(api.especialidades).mockReturnValue(of([ESPECIALIDAD]));
    formulario.guardar.emit(ESPECIALIDAD_REQUEST);
    guardado.next({ idEspecialidad: 2 });
    guardado.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(false);
    expect(api.especialidades).toHaveBeenCalledTimes(2);
  });
});
