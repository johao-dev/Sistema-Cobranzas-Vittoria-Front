import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { ConsultaRuc } from '../../catalogos/proveedores/contratos-proveedores';
import { botonGasto, escribirGasto } from '../pruebas/dom-gastos';
import { FormularioProveedorEspecifico } from './formulario-proveedor-especifico';

describe('Formulario de los proveedores específicos de Gastos', () => {
  let fixture: ComponentFixture<FormularioProveedorEspecifico>;
  const api = { consultaRuc: vi.fn<() => Observable<ConsultaRuc>>() };
  beforeEach(async () => {
    vi.resetAllMocks();
    api.consultaRuc.mockReturnValue(
      of({
        numero_documento: '20123456789',
        razon_social: 'SUNAT',
        estado: 'ACTIVO',
        direccion: '',
      }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: CatalogoProveedores, useValue: api }],
    });
    fixture = TestBed.createComponent(FormularioProveedorEspecifico);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  it('exige categoría para proveedor de gasto, pero permite terreno sin categoría', async () => {
    const guardar = vi.fn();
    fixture.componentInstance.guardar.subscribe(guardar);
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-1', 'Proveedor');
    fixture.componentRef.setInput('categorias', []);
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar proveedor').click();
    await fixture.whenStable();
    expect(guardar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Selecciona la categoría');
    fixture.componentRef.setInput('categorias', null);
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ razonSocial: 'Proveedor', idCategoriaGasto: null }),
    );
  });
  it('conserva contacto y estado al editar y bloquea la emisión mientras guarda', async () => {
    const guardar = vi.fn();
    fixture.componentInstance.guardar.subscribe(guardar);
    fixture.componentRef.setInput('valor', {
      razonSocial: 'Proveedor',
      ruc: '',
      contacto: 'Contacto',
      telefono: '123',
      correo: '',
      activo: false,
      idCategoriaGasto: null,
    });
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ contacto: 'Contacto', activo: false }),
    );
    fixture.componentRef.setInput('guardando', true);
    await fixture.whenStable();
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(guardar).toHaveBeenCalledTimes(1);
  });
  it('no aplica una respuesta SUNAT tardía a otro RUC', async () => {
    const respuesta = new Subject<ConsultaRuc>();
    api.consultaRuc.mockReturnValue(respuesta);
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-2', '20123456789');
    const raiz: HTMLElement = fixture.nativeElement;
    const campo = raiz.querySelector<HTMLInputElement>('#formulario-proveedor-especifico-campo-2');
    campo?.dispatchEvent(new Event('blur'));
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-2', '20999999999');
    respuesta.next({
      numero_documento: '20123456789',
      razon_social: 'Anterior',
      estado: 'ACTIVO',
      direccion: '',
    });
    respuesta.complete();
    await fixture.whenStable();
    expect(
      raiz.querySelector<HTMLInputElement>('#formulario-proveedor-especifico-campo-1')?.value,
    ).toBe('');
  });
});
