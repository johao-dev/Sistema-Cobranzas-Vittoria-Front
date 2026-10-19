import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { FormularioEspecialidad } from './formulario-especialidad';
import { EspecialidadUpsert } from '../contratos-especialidades';
import {
  ESPECIALIDAD,
  ESPECIALIDAD_REQUEST,
  enviar,
  escribir,
  obtenerRaiz,
} from '../../pruebas/muestras-catalogos';

describe('FormularioEspecialidad', () => {
  it('valida campos requeridos sin emitir una petición', async () => {
    const fixture = TestBed.createComponent(FormularioEspecialidad);
    const recibido = vi.fn<(dto: EspecialidadUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('conserva identificador y estado, normalizando el texto al editar', async () => {
    const fixture = TestBed.createComponent(FormularioEspecialidad);
    fixture.componentRef.setInput('valor', ESPECIALIDAD);
    const recibido = vi.fn<(dto: EspecialidadUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    escribir(raiz, '#especialidad-nombre', '  Nueva especialidad  ');
    await fixture.whenStable();
    enviar(raiz);
    expect(recibido).toHaveBeenCalledExactlyOnceWith({
      ...ESPECIALIDAD_REQUEST,
      idEspecialidad: 1,
      nombre: 'Nueva especialidad',
    });
  });
});
