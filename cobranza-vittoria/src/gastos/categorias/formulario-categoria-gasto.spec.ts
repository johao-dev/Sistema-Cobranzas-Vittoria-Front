import { TestBed } from '@angular/core/testing';
import { botonGasto, escribirGasto } from '../pruebas/dom-gastos';
import { FormularioCategoriaGasto } from './formulario-categoria-gasto';

describe('FormularioCategoriaGasto', () => {
  it('exige código/nombre y conserva el código explícito al editar', async () => {
    const fixture = TestBed.createComponent(FormularioCategoriaGasto);
    fixture.detectChanges();
    await fixture.whenStable();
    const guardar = vi.fn();
    fixture.componentInstance.guardar.subscribe(guardar);
    await escribirGasto(fixture, '#categoria-gasto-nombre', 'Terreno');
    botonGasto(fixture, 'Guardar categoría').click();
    await fixture.whenStable();
    expect(guardar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('código y el nombre');
    fixture.componentRef.setInput('valor', {
      idCategoriaGasto: 13,
      codigo: 'TERRENO',
      nombre: 'Terreno',
      activo: true,
    });
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar categoría').click();
    expect(guardar).toHaveBeenCalledWith({
      idCategoriaGasto: 13,
      codigo: 'TERRENO',
      nombre: 'Terreno',
      activo: true,
    });
  });
});
