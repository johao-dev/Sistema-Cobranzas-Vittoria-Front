import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { NuevoProveedorOrden } from './nuevo-proveedor-orden';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';

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

describe('NuevoProveedorOrden — recuperación y RUC', () => {
  const catalogo = {
    proveedores: vi.fn<() => Observable<(typeof proveedor)[]>>(() => of([proveedor])),
    guardarProveedor: vi.fn(() => of({ idProveedor: 30 })),
    consultaRuc: vi.fn<
      () => Observable<{
        numero_documento: string;
        razon_social: string;
        estado: string;
        direccion: string;
      }>
    >(),
  };
  let fixture: ComponentFixture<NuevoProveedorOrden>;

  beforeEach(async () => {
    vi.resetAllMocks();
    // jsdom no implementa este límite nativo; el componente y su estado siguen siendo reales.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    catalogo.proveedores.mockReturnValue(of([proveedor]));
    catalogo.guardarProveedor.mockReturnValue(of({ idProveedor: 30 }));
    TestBed.configureTestingModule({
      providers: [{ provide: CatalogoProveedores, useValue: catalogo }],
    });
    fixture = TestBed.createComponent(NuevoProveedorOrden);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  it('valida razón social y conserva los campos de alta vigentes', async () => {
    pulsar(fixture, 'Guardar proveedor');
    expect(catalogo.guardarProveedor).not.toHaveBeenCalled();
    escribir(fixture, '#oc-proveedor-nombre', 'Nuevo');
    const guardado = vi.fn();
    fixture.componentInstance.guardado.subscribe(guardado);
    pulsar(fixture, 'Guardar proveedor');
    await fixture.whenStable();
    expect(catalogo.guardarProveedor).toHaveBeenCalledWith(
      expect.objectContaining({
        razonSocial: 'Nuevo',
        banco: '',
        trabajamosConProveedor: 'SI',
        activo: true,
      }),
    );
    expect(guardado).toHaveBeenCalledWith({ idProveedor: 30, proveedores: [proveedor] });
  });

  it('reintenta GET sin duplicar POST si el proveedor ya fue creado', async () => {
    catalogo.proveedores.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    escribir(fixture, '#oc-proveedor-nombre', 'Nuevo');
    pulsar(fixture, 'Guardar proveedor');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Proveedor creado. No se pudo actualizar');
    expect(elemento<HTMLInputElement>(fixture, '#oc-proveedor-nombre').disabled).toBe(true);
    pulsar(fixture, 'Actualizar catálogo');
    expect(catalogo.guardarProveedor).toHaveBeenCalledOnce();
    expect(catalogo.proveedores).toHaveBeenCalledTimes(2);
  });

  it('no duplica consulta por blur/Enter y descarta la respuesta cuando cambia el RUC', async () => {
    const pendiente = new Subject<{
      numero_documento: string;
      razon_social: string;
      estado: string;
      direccion: string;
    }>();
    catalogo.consultaRuc.mockReturnValue(pendiente);
    escribir(fixture, '#oc-proveedor-ruc', '20123456789');
    const ruc = elemento(fixture, '#oc-proveedor-ruc');
    ruc.dispatchEvent(new Event('blur'));
    ruc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(catalogo.consultaRuc).toHaveBeenCalledOnce();
    escribir(fixture, '#oc-proveedor-ruc', '20987654321');
    pendiente.next({
      numero_documento: '20123456789',
      razon_social: 'Respuesta antigua',
      estado: 'ACTIVO',
      direccion: 'Calle',
    });
    await fixture.whenStable();
    expect(elemento<HTMLInputElement>(fixture, '#oc-proveedor-nombre').value).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Consultando');
  });

  it('rellena campos SUNAT y mantiene dirección vacía para el marcador guion', async () => {
    catalogo.consultaRuc.mockReturnValue(
      of({
        numero_documento: '20123456789',
        razon_social: 'SUNAT',
        estado: 'ACTIVO',
        direccion: '-',
      }),
    );
    escribir(fixture, '#oc-proveedor-ruc', '20123456789');
    elemento(fixture, '#oc-proveedor-ruc').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(elemento<HTMLInputElement>(fixture, '#oc-proveedor-nombre').value).toBe('SUNAT');
    expect(elemento<HTMLInputElement>(fixture, '#oc-proveedor-direccion').value).toBe('');
  });
});
