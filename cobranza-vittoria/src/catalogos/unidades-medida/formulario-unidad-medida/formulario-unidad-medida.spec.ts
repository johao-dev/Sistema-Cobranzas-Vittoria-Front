import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { FormularioUnidadMedida } from './formulario-unidad-medida';
import { UnidadMedidaUpsert } from '../contratos-unidades-medida';
import {
  UNIDAD,
  UNIDAD_REQUEST,
  enviar,
  escribir,
  obtenerRaiz,
} from '../../pruebas/muestras-catalogos';

describe('FormularioUnidadMedida', () => {
  it('valida campos requeridos sin emitir una petición', async () => {
    const fixture = TestBed.createComponent(FormularioUnidadMedida);
    const recibido = vi.fn<(dto: UnidadMedidaUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('conserva identificador y estado, normalizando el texto al editar', async () => {
    const fixture = TestBed.createComponent(FormularioUnidadMedida);
    fixture.componentRef.setInput('valor', UNIDAD);
    const recibido = vi.fn<(dto: UnidadMedidaUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    escribir(raiz, '#unidad-medida-nombre', '  Nueva unidad  ');
    await fixture.whenStable();
    enviar(raiz);
    expect(recibido).toHaveBeenCalledExactlyOnceWith({
      ...UNIDAD_REQUEST,
      idUnidadMedida: 1,
      nombre: 'Nueva unidad',
    });
  });
});
