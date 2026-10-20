import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { DetalleCompra } from './detalle-compra';
import { RegistroCompras } from '../registro-compras';
import { detalleCompraPrueba } from '../compras.fixture';
import { CompraDetalleResponse } from '../contratos-compras';
describe('DetalleCompra — documentos', () => {
  const api = {
    compra: vi.fn<() => Observable<CompraDetalleResponse>>(),
    uploadDocumentosCompra: vi.fn<() => Observable<{ ok: boolean }>>(),
    documentoCompraDownloadUrl: vi.fn(() => '/archivo'),
  };
  let fixture: ComponentFixture<DetalleCompra>;
  const documento = {
    IdCompraDocumento: 2,
    IdCompra: 9,
    NombreArchivo: 'sustento.pdf',
    RutaArchivo: 'privada',
    Extension: '.pdf',
    FechaCreacion: '2026-10-20',
  };
  function subir(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.btn-primary');
  }
  beforeEach(async () => {
    vi.resetAllMocks();
    api.compra.mockReturnValue(of(detalleCompraPrueba));
    api.uploadDocumentosCompra.mockReturnValue(of({ ok: true }));
    api.documentoCompraDownloadUrl.mockReturnValue('/archivo');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    TestBed.configureTestingModule({ providers: [{ provide: RegistroCompras, useValue: api }] });
    fixture = TestBed.createComponent(DetalleCompra);
    fixture.componentRef.setInput('idCompra', 9);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  it('muestra los campos SQL y exige archivos', async () => {
    expect(fixture.nativeElement.textContent).toContain('CP-009');
    expect(fixture.nativeElement.textContent).toContain('Cemento');
    subir().click();
    await fixture.whenStable();
    expect(api.uploadDocumentosCompra).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('al menos un archivo');
  });
  it('sube una vez, bloquea duplicados y recarga metadata al finalizar', async () => {
    const respuesta = new Subject<{ ok: boolean }>();
    api.uploadDocumentosCompra.mockReturnValue(respuesta);
    const file = new File(['x'], 'sustento.pdf');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    subir().click();
    await fixture.whenStable();
    expect(subir().disabled).toBe(true);
    subir().click();
    api.compra.mockReturnValue(of({ ...detalleCompraPrueba, documentos: [documento] }));
    respuesta.next({ ok: true });
    respuesta.complete();
    await fixture.whenStable();
    expect(api.uploadDocumentosCompra).toHaveBeenCalledExactlyOnceWith(9, [file]);
    expect(fixture.nativeElement.textContent).toContain('sustento.pdf');
  });
  it('descarga por el endpoint y nunca por RutaArchivo', async () => {
    fixture.destroy();
    api.compra.mockReturnValue(of({ ...detalleCompraPrueba, documentos: [documento] }));
    fixture = TestBed.createComponent(DetalleCompra);
    fixture.componentRef.setInput('idCompra', 9);
    fixture.detectChanges();
    await fixture.whenStable();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.action-btn');
    button.click();
    expect(api.documentoCompraDownloadUrl).toHaveBeenCalledWith(9, 2);
    expect(open).toHaveBeenCalledWith('/archivo', '_blank', 'noopener');
  });
  it('muestra fallos de consulta y permite reintentar', async () => {
    fixture.destroy();
    api.compra.mockReturnValue(throwError(() => ({ error: { message: 'No existe' } })));
    fixture = TestBed.createComponent(DetalleCompra);
    fixture.componentRef.setInput('idCompra', 9);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No existe');
    api.compra.mockReturnValue(of(detalleCompraPrueba));
    const reintentar: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-secondary');
    reintentar.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cemento');
  });
});
