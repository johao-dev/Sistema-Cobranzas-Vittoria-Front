import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { FormularioCompra } from './formulario-compra';
import { EditorImporte } from '../editor-importe/editor-importe';
import { RegistroCompras } from '../registro-compras';
import { RegistroOrdenesCompra } from '../../ordenes-compra/registro-ordenes-compra';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { detallePrueba } from '../../ordenes-compra/ordenes-compra.fixture';
import { DetalleOrdenCompra } from '../../ordenes-compra/contratos-ordenes-compra';
import { CompraCreada } from '../contratos-compras';

describe('FormularioCompra — registro sin Zone.js', () => {
  const registro = {
    registrarCompra: vi.fn<() => Observable<CompraCreada>>(),
    uploadDocumentosCompra: vi.fn<() => Observable<{ ok: boolean }>>(),
  };
  const ordenes = { obtener: vi.fn<() => Observable<DetalleOrdenCompra>>() };
  let fixture: ComponentFixture<FormularioCompra>;
  function boton(texto: string): HTMLButtonElement {
    const elemento = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((x) => x.textContent?.includes(texto));
    if (!elemento) throw new Error('Falta botón: ' + texto);
    return elemento;
  }
  beforeEach(async () => {
    vi.resetAllMocks();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    registro.registrarCompra.mockReturnValue(of({ idCompra: 9, montoTotal: 150 }));
    registro.uploadDocumentosCompra.mockReturnValue(of({ ok: true }));
    ordenes.obtener.mockReturnValue(of(detallePrueba));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroCompras, useValue: registro },
        { provide: RegistroOrdenesCompra, useValue: ordenes },
        { provide: CatalogoMateriales, useValue: { materiales: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(FormularioCompra);
    fixture.componentRef.setInput('idOrden', 8);
    fixture.componentRef.setInput('numero', '10');
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  it('carga precios de la OC y registra todas las líneas sin adjuntos', async () => {
    const emitido = vi.fn();
    fixture.componentInstance.registrada.subscribe(emitido);
    expect(fixture.nativeElement.textContent).toContain('Material 0');
    boton('Registrar compra').click();
    await fixture.whenStable();
    expect(registro.registrarCompra).toHaveBeenCalledWith(
      expect.objectContaining({
        idOrdenCompra: 8,
        montoTotal: 150,
        items: [
          { idMaterial: 10, cantidad: 2, precioUnitario: 25 },
          { idMaterial: 11, cantidad: 2, precioUnitario: 25 },
          { idMaterial: 12, cantidad: 2, precioUnitario: 25 },
        ],
      }),
    );
    expect(registro.uploadDocumentosCompra).not.toHaveBeenCalled();
    expect(emitido).toHaveBeenCalledWith(expect.stringContaining('registrada correctamente'));
  });
  it('editar usa una copia y cancelar conserva el precio original', async () => {
    boton('Editar precio').click();
    await fixture.whenStable();
    const editor = fixture.debugElement.query(By.directive(EditorImporte));
    const input: HTMLInputElement = editor.nativeElement.querySelector(
      'input:not([readonly])[type=number]',
    );
    input.value = '118';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const botones: NodeListOf<HTMLButtonElement> = editor.nativeElement.querySelectorAll('button');
    Array.from(botones)
      .find((x) => x.textContent?.includes('Cancelar'))
      ?.click();
    await fixture.whenStable();
    boton('Registrar compra').click();
    expect(registro.registrarCompra).toHaveBeenCalledWith(
      expect.objectContaining({ montoTotal: 150 }),
    );
  });
  it('filtrar la tabla no elimina materiales del registro', async () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelectorAll('select')[1];
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    boton('Registrar compra').click();
    expect(registro.registrarCompra).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ idMaterial: 12 })]),
      }),
    );
  });
  it('bloquea registro y cierre mientras el envío está pendiente y restaura tras error', async () => {
    const respuesta = new Subject<CompraCreada>();
    registro.registrarCompra.mockReturnValue(respuesta);
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    boton('Registrar compra').click();
    await fixture.whenStable();
    expect(boton('Registrar compra').disabled).toBe(true);
    boton('Registrar compra').click();
    boton('Cancelar / Limpiar').click();
    expect(registro.registrarCompra).toHaveBeenCalledTimes(1);
    expect(cerrar).not.toHaveBeenCalled();
    respuesta.error({ error: { errors: { Monto: ['Saldo insuficiente'] } } });
    await fixture.whenStable();
    expect(boton('Registrar compra').disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente');
  });
  it('conserva registro exitoso si fallan adjuntos y no registra por segunda vez', async () => {
    boton('Editar precio').click();
    await fixture.whenStable();
    const editor = fixture.debugElement.query(By.directive(EditorImporte))
      .componentInstance as EditorImporte;
    editor.guardar.emit({ ...editor.item(), files: [new File(['x'], 'sustento.pdf')] });
    await fixture.whenStable();
    registro.uploadDocumentosCompra.mockReturnValue(
      throwError(() => ({ error: { message: 'Fallo de almacenamiento' } })),
    );
    const emitido = vi.fn();
    fixture.componentInstance.registrada.subscribe(emitido);
    boton('Registrar compra').click();
    await fixture.whenStable();
    expect(registro.uploadDocumentosCompra).toHaveBeenCalledWith(
      9,
      expect.arrayContaining([expect.any(File)]),
    );
    expect(registro.registrarCompra).toHaveBeenCalledTimes(1);
    expect(emitido).toHaveBeenCalledWith(
      expect.stringContaining('La compra se registró, pero falló'),
    );
  });
  it('muestra errores de carga asíncronos y permite reintentar', async () => {
    fixture.destroy();
    const respuesta = new Subject<DetalleOrdenCompra>();
    ordenes.obtener.mockReturnValue(respuesta);
    fixture = TestBed.createComponent(FormularioCompra);
    fixture.componentRef.setInput('idOrden', 8);
    fixture.componentRef.setInput('numero', '10');
    fixture.detectChanges();
    respuesta.error({ error: { message: 'No disponible' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No disponible');
    ordenes.obtener.mockReturnValue(of(detallePrueba));
    boton('Reintentar').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Material 0');
  });
});
