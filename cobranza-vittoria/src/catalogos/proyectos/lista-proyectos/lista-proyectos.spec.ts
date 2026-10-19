import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaProyectos } from './lista-proyectos';
import { FormularioProyecto } from '../formulario-proyecto/formulario-proyecto';
import { CatalogoProyectos } from '../catalogo-proyectos';
import { Proyecto } from '../contratos-proyectos';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  PROYECTO,
  PROYECTO_REQUEST,
  escribir,
  obtenerRaiz,
  obtenerElemento,
  simularDialogosNativos,
} from '../../pruebas/muestras-catalogos';

describe('ListaProyectos sin Zone.js', () => {
  let fixture: ComponentFixture<ListaProyectos>;
  let listado: Subject<Proyecto[]>;
  let guardado: Subject<{ idProyecto: number }>;
  let api: Pick<CatalogoProyectos, 'proyectos' | 'guardarProyecto'>;
  let restaurarDialogos: () => void;

  beforeEach(async () => {
    restaurarDialogos = simularDialogosNativos();
    listado = new Subject<Proyecto[]>();
    guardado = new Subject<{ idProyecto: number }>();
    api = {
      proyectos: vi.fn<CatalogoProyectos['proyectos']>().mockReturnValue(listado),
      guardarProyecto: vi.fn<CatalogoProyectos['guardarProyecto']>().mockReturnValue(guardado),
    };
    await TestBed.configureTestingModule({
      imports: [ListaProyectos],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoProyectos, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaProyectos);
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
    listado.next([PROYECTO]);
    listado.complete();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    escribir(raiz, '#busqueda-proyectos', 'sin coincidencias');
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
      By.directive(FormularioProyecto),
    ).componentInstance;
    if (!(formulario instanceof FormularioProyecto)) throw new Error('No se creó el formulario.');
    formulario.guardar.emit(PROYECTO_REQUEST);
    formulario.guardar.emit(PROYECTO_REQUEST);
    expect(api.guardarProyecto).toHaveBeenCalledTimes(1);
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
    listado.next([PROYECTO]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioProyecto),
    ).componentInstance;
    if (!(formulario instanceof FormularioProyecto)) throw new Error('No se creó el formulario.');
    vi.mocked(api.proyectos).mockReturnValue(of([PROYECTO]));
    formulario.guardar.emit(PROYECTO_REQUEST);
    guardado.next({ idProyecto: 2 });
    guardado.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(false);
    expect(api.proyectos).toHaveBeenCalledTimes(2);
  });
});
