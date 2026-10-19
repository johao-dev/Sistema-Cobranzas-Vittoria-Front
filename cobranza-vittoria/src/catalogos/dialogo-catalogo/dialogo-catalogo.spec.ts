import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DialogoCatalogo } from './dialogo-catalogo';
import {
  obtenerElemento,
  obtenerRaiz,
  simularDialogosNativos,
} from '../pruebas/muestras-catalogos';

describe('DialogoCatalogo', () => {
  let restaurar: () => void;
  beforeEach(() => {
    restaurar = simularDialogosNativos();
  });
  afterEach(() => restaurar());
  it('abre y cierra con la entrada, y comunica el cierre por Escape/cancel', async () => {
    const fixture = TestBed.createComponent(DialogoCatalogo);
    fixture.componentRef.setInput('abierto', true);
    fixture.componentRef.setInput('titulo', 'Editar material');
    const cerrado = vi.fn<() => void>();
    fixture.componentInstance.cerrar.subscribe(cerrado);
    await fixture.whenStable();
    const dialogo: HTMLDialogElement = obtenerElemento(
      obtenerRaiz(fixture.nativeElement),
      'dialog',
    );
    expect(dialogo.open).toBe(true);
    expect(dialogo.textContent).toContain('Editar material');
    const evento = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(evento);
    expect(cerrado).toHaveBeenCalledOnce();
    expect(evento.defaultPrevented).toBe(true);
    fixture.componentRef.setInput('abierto', false);
    await fixture.whenStable();
    expect(dialogo.open).toBe(false);
  });
});
