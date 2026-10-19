import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListaMateriales } from './lista-materiales';
import { FormularioMaterial } from '../formulario-material/formulario-material';
import { CatalogoMateriales } from '../catalogo-materiales';
import { Material } from '../contratos-materiales';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  MATERIAL,
  MATERIAL_REQUEST,
  ESPECIALIDAD,
  UNIDAD,
  escribir,
  obtenerRaiz,
  obtenerElemento,
  simularDialogosNativos,
} from '../../pruebas/muestras-catalogos';
import { CatalogoEspecialidades } from '../../especialidades/catalogo-especialidades';
import { CatalogoUnidadesMedida } from '../../unidades-medida/catalogo-unidades-medida';
import { ControlPresupuestarioService } from '../../../app/core/services/control-presupuestario.service';

describe('ListaMateriales sin Zone.js', () => {
  let fixture: ComponentFixture<ListaMateriales>;
  let listado: Subject<Material[]>;
  let guardado: Subject<{ idMaterial: number }>;
  let api: Pick<
    CatalogoMateriales,
    'materiales' | 'guardarMaterial' | 'material' | 'siguienteCodigo'
  >;
  let restaurarDialogos: () => void;

  beforeEach(async () => {
    restaurarDialogos = simularDialogosNativos();
    listado = new Subject<Material[]>();
    guardado = new Subject<{ idMaterial: number }>();
    api = {
      materiales: vi.fn<CatalogoMateriales['materiales']>().mockReturnValue(listado),
      guardarMaterial: vi.fn<CatalogoMateriales['guardarMaterial']>().mockReturnValue(guardado),
      material: vi.fn<CatalogoMateriales['material']>().mockReturnValue(of(MATERIAL)),
      siguienteCodigo: () => of({ codigo: 'M2' }),
    };
    await TestBed.configureTestingModule({
      imports: [ListaMateriales],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoMateriales, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: CatalogoEspecialidades, useValue: { especialidades: () => of([ESPECIALIDAD]) } },
        { provide: CatalogoUnidadesMedida, useValue: { unidadesMedida: () => of([UNIDAD]) } },
        { provide: ControlPresupuestarioService, useValue: { partidas: () => of([]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaMateriales);
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
    listado.next([MATERIAL]);
    listado.complete();
    await fixture.whenStable();
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    escribir(raiz, '#busqueda-materiales', 'sin coincidencias');
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
      By.directive(FormularioMaterial),
    ).componentInstance;
    if (!(formulario instanceof FormularioMaterial)) throw new Error('No se creó el formulario.');
    formulario.guardar.emit(MATERIAL_REQUEST);
    formulario.guardar.emit(MATERIAL_REQUEST);
    expect(api.guardarMaterial).toHaveBeenCalledTimes(1);
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
    listado.next([MATERIAL]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, '.btn-primary').click();
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioMaterial),
    ).componentInstance;
    if (!(formulario instanceof FormularioMaterial)) throw new Error('No se creó el formulario.');
    vi.mocked(api.materiales).mockReturnValue(of([MATERIAL]));
    formulario.guardar.emit(MATERIAL_REQUEST);
    guardado.next({ idMaterial: 2 });
    guardado.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLDialogElement>(raiz, 'dialog').open).toBe(false);
    expect(api.materiales).toHaveBeenCalledTimes(2);
  });

  it('bloquea el guardado si no se pudo recuperar el detalle completo al editar', async () => {
    const pendiente = new Subject<Material>();
    vi.mocked(api.material).mockReturnValue(pendiente);
    listado.next([MATERIAL]);
    listado.complete();
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    obtenerElemento<HTMLButtonElement>(raiz, 'tbody button').click();
    await fixture.whenStable();
    pendiente.error(new HttpErrorResponse({ status: 500 }));
    await fixture.whenStable();
    const formulario: unknown = fixture.debugElement.query(
      By.directive(FormularioMaterial),
    ).componentInstance;
    if (!(formulario instanceof FormularioMaterial)) throw new Error('No se creó el formulario.');
    formulario.guardar.emit({ ...MATERIAL_REQUEST, idMaterial: 1 });
    expect(api.guardarMaterial).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar el detalle',
    );
  });
});
