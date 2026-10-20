import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { FormularioOrden } from './formulario-orden';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { requerimientoPrueba } from '../ordenes-compra.fixture';

function elemento<T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string): T {
  const raiz: HTMLElement = fixture.nativeElement;
  const encontrado = raiz.querySelector<T>(selector);
  if (!encontrado) throw new Error('No se encontró ' + selector);
  return encontrado;
}

function pulsar(fixture: ComponentFixture<unknown>, texto: string): void {
  const raiz: HTMLElement = fixture.nativeElement;
  const boton = [...raiz.querySelectorAll('button')].find((boton) =>
    boton.textContent?.includes(texto),
  );
  if (!boton) throw new Error('No se encontró botón ' + texto);
  boton.click();
}

function escribir(fixture: ComponentFixture<unknown>, selector: string, valor: string): void {
  const control = elemento<HTMLInputElement>(fixture, selector);
  control.value = valor;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

const proveedor = { idProveedor: 30, razonSocial: 'Proveedor', activo: true };

describe('FormularioOrden — interfaz sin Zone.js', () => {
  const registro = {
    crear: vi.fn<() => Observable<{ idOrdenCompra: number; total: number }>>(() =>
      of({ idOrdenCompra: 9, total: 0 }),
    ),
  };
  const catalogo = { proveedores: vi.fn(() => of([proveedor])) };
  let fixture: ComponentFixture<FormularioOrden>;

  beforeEach(async () => {
    vi.resetAllMocks();
    // jsdom no implementa este límite nativo; el componente y su estado siguen siendo reales.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    registro.crear.mockReturnValue(of({ idOrdenCompra: 9, total: 0 }));
    catalogo.proveedores.mockReturnValue(of([proveedor]));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroOrdenesCompra, useValue: registro },
        { provide: CatalogoProveedores, useValue: catalogo },
      ],
    });
    fixture = TestBed.createComponent(FormularioOrden);
    fixture.componentRef.setInput('detalle', requerimientoPrueba);
    fixture.componentRef.setInput('numero', '9');
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  function seleccionarProveedores(): void {
    const raiz: HTMLElement = fixture.nativeElement;
    for (const select of raiz.querySelectorAll<HTMLSelectElement>('.provider-select')) {
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change'));
    }
  }

  it('muestra cabecera y cantidades del requerimiento y valida proveedor antes de guardar', async () => {
    expect(elemento<HTMLInputElement>(fixture, '#oc-numero').value).toBe('9');
    expect(elemento<HTMLInputElement>(fixture, '#oc-proyecto').value).toBe('Obra');
    expect(elemento<HTMLInputElement>(fixture, '#oc-usuario').value).toBe('Ingeniero');
    pulsar(fixture, 'Generar O.C.');
    await fixture.whenStable();
    expect(registro.crear).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('proveedor por cada material');
  });

  it('conserva proveedor por línea, redondeo, identidad del solicitante y fecha local en el POST', async () => {
    seleccionarProveedores();
    escribir(fixture, 'input.precio-input', '1.236');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('3.10');
    const creada = vi.fn();
    fixture.componentInstance.creada.subscribe(creada);
    pulsar(fixture, 'Generar O.C.');
    expect(registro.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idRequerimiento: 4,
        idUsuarioCreacion: 7,
        items: [
          { idMaterial: 10, cantidad: 2.5, idProveedor: 30, precioUnitario: 1.24 },
          { idMaterial: 20, cantidad: 3, idProveedor: 30, precioUnitario: 0 },
        ],
      }),
    );
    expect(creada).toHaveBeenCalledOnce();
  });

  it('bloquea guardados y cierre duplicados, conserva los datos tras error y permite reintentar', async () => {
    const pendiente = new Subject<{ idOrdenCompra: number; total: number }>();
    registro.crear.mockReturnValueOnce(pendiente);
    seleccionarProveedores();
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    pulsar(fixture, 'Generar O.C.');
    pulsar(fixture, 'Generar O.C.');
    elemento(fixture, 'dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(registro.crear).toHaveBeenCalledOnce();
    expect(cerrar).not.toHaveBeenCalled();
    pendiente.error(new HttpErrorResponse({ status: 409, error: { message: 'Orden duplicada' } }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Orden duplicada');
    expect(elemento<HTMLSelectElement>(fixture, '.provider-select').disabled).toBe(false);
    pulsar(fixture, 'Generar O.C.');
    expect(registro.crear).toHaveBeenCalledTimes(2);
  });

  it('impide precios negativos antes del envío', async () => {
    seleccionarProveedores();
    escribir(fixture, 'input.precio-input', '-1');
    pulsar(fixture, 'Generar O.C.');
    await fixture.whenStable();
    expect(registro.crear).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('negativo');
  });

  it('libera una escritura pendiente al destruir el formulario', () => {
    const cancelar = vi.fn();
    registro.crear.mockReturnValue(new Observable(() => cancelar));
    seleccionarProveedores();
    pulsar(fixture, 'Generar O.C.');
    fixture.destroy();
    expect(cancelar).toHaveBeenCalledOnce();
  });
});
