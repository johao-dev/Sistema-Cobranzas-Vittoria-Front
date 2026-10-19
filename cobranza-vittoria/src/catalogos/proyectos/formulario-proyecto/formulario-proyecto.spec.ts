import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { FormularioProyecto } from './formulario-proyecto';
import { ProyectoUpsert } from '../contratos-proyectos';
import {
  PROYECTO,
  PROYECTO_REQUEST,
  enviar,
  escribir,
  obtenerRaiz,
} from '../../pruebas/muestras-catalogos';

describe('FormularioProyecto', () => {
  it('valida campos requeridos sin emitir una petición', async () => {
    const fixture = TestBed.createComponent(FormularioProyecto);
    const recibido = vi.fn<(dto: ProyectoUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
    expect(raiz.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('conserva identificador y estado, normalizando el texto al editar', async () => {
    const fixture = TestBed.createComponent(FormularioProyecto);
    fixture.componentRef.setInput('valor', PROYECTO);
    const recibido = vi.fn<(dto: ProyectoUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    await fixture.whenStable();
    const raiz = obtenerRaiz(fixture.nativeElement);
    escribir(raiz, '#proyecto-nombreProyecto', '  Nuevo proyecto  ');
    await fixture.whenStable();
    enviar(raiz);
    expect(recibido).toHaveBeenCalledExactlyOnceWith({
      ...PROYECTO_REQUEST,
      idProyecto: 1,
      nombreProyecto: 'Nuevo proyecto',
    });
  });
});
