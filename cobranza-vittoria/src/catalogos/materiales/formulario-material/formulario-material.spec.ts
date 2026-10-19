import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FormularioMaterial } from './formulario-material';
import { CatalogoMateriales } from '../catalogo-materiales';
import { MaterialUpsert } from '../contratos-materiales';
import {
  ESPECIALIDAD,
  MATERIAL,
  UNIDAD,
  enviar,
  obtenerElemento,
  obtenerRaiz,
  escribir,
} from '../../pruebas/muestras-catalogos';

describe('FormularioMaterial', () => {
  let fixture: ComponentFixture<FormularioMaterial>;
  async function crear(edicion: boolean = true): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [FormularioMaterial],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: CatalogoMateriales,
          useValue: { siguienteCodigo: () => of({ codigo: 'MAT-002' }) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FormularioMaterial);
    fixture.componentRef.setInput('valor', edicion ? MATERIAL : null);
    fixture.componentRef.setInput('especialidades', [ESPECIALIDAD]);
    fixture.componentRef.setInput('unidades', [UNIDAD]);
    await fixture.whenStable();
    return obtenerRaiz(fixture.nativeElement);
  }
  it('conserva partida inactiva o no disponible al editar y enviar', async () => {
    const raiz = await crear();
    const recibido = vi.fn<(dto: MaterialUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    expect(obtenerElemento<HTMLSelectElement>(raiz, '#material-partida').textContent).toContain(
      'Cimentación (no disponible)',
    );
    enviar(raiz);
    expect(recibido).toHaveBeenCalledWith(
      expect.objectContaining({
        idMaterial: 1,
        idCatalogoPartida: 7,
        codigo: 'MAT-001',
        unidadMedida: 'KG',
      }),
    );
  });
  it('bloquea el envío mientras se está cargando el detalle', async () => {
    const raiz = await crear();
    const recibido = vi.fn<(dto: MaterialUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    fixture.componentRef.setInput('bloqueado', true);
    await fixture.whenStable();
    enviar(raiz);
    expect(recibido).not.toHaveBeenCalled();
  });
  it('rechaza stock mínimo negativo y conserva el resto del formulario', async () => {
    const raiz = await crear();
    const recibido = vi.fn<(dto: MaterialUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    escribir(raiz, '#material-stock', '-1');
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('stock mínimo');
    expect(obtenerElemento<HTMLInputElement>(raiz, '#material-descripcion').value).toBe('Cemento');
  });
  it('muestra el código sugerido para altas, dejando al backend asignar el definitivo', async () => {
    const raiz = await crear(false);
    expect(obtenerElemento<HTMLInputElement>(raiz, '#material-codigo').value).toBe('MAT-002');
    const recibido = vi.fn<(dto: MaterialUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
  });
  it('una respuesta tardía de código nuevo no sobreescribe el código de un material editado', async () => {
    const pendiente = new Subject<{ codigo: string }>();
    TestBed.configureTestingModule({
      imports: [FormularioMaterial],
      providers: [{ provide: CatalogoMateriales, useValue: { siguienteCodigo: () => pendiente } }],
    });
    fixture = TestBed.createComponent(FormularioMaterial);
    await fixture.whenStable();
    expect(pendiente.observed).toBe(true);
    fixture.componentRef.setInput('valor', MATERIAL);
    await fixture.whenStable();
    expect(pendiente.observed).toBe(false);
    pendiente.next({ codigo: 'INCORRECTO' });
    expect(
      obtenerElemento<HTMLInputElement>(obtenerRaiz(fixture.nativeElement), '#material-codigo')
        .value,
    ).toBe('MAT-001');
  });
});
