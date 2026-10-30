import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { DocumentosGastoAdjuntados } from '../contratos-gastos-directos';
import { documentoGastoPrueba, gastoPrueba } from '../gastos.fixture';
import { botonGasto, simularDialogosGastos, restaurarDialogosGastos } from '../pruebas/dom-gastos';
import { DocumentosGasto } from './documentos-gasto';

describe('DocumentosGasto', () => {
  let fixture: ComponentFixture<DocumentosGasto>;
  const api = { documentos: vi.fn(), subirDocumentos: vi.fn(), descargarDocumento: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosGastos();
    api.documentos.mockReturnValue(of([documentoGastoPrueba]));
    api.descargarDocumento.mockReturnValue(EMPTY);
    api.subirDocumentos.mockReturnValue(of({ ok: true, cantidad: 1 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroGastosDirectos, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: SesionUsuario, useValue: { hasPermission: () => true } },
      ],
    });
  });
  afterEach(restaurarDialogosGastos);
  async function abrir(puedeOperar = true): Promise<void> {
    fixture = TestBed.createComponent(DocumentosGasto);
    fixture.componentRef.setInput('gasto', gastoPrueba);
    fixture.componentRef.setInput('puedeOperar', puedeOperar);
    fixture.detectChanges();
    await fixture.whenStable();
  }
  async function archivo(nombre: string): Promise<void> {
    const raiz: HTMLElement = fixture.nativeElement;
    const input = raiz.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) throw new Error('Falta el selector de archivos');
    Object.defineProperty(input, 'files', {
      value: [new File(['pdf'], nombre)],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }
  it('muestra factura de referencia sin ofrecer descarga ni exigir permiso de operar', async () => {
    await abrir(false);
    expect(fixture.nativeElement.textContent).toContain('F001-245');
    expect(fixture.nativeElement.textContent).toContain('Referencia de factura');
    expect(fixture.nativeElement.querySelector('input[type=file]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Descargar');
  });
  it('descarga únicamente referencias con archivo por el registro autenticado', async () => {
    api.documentos.mockReturnValue(
      of([{ ...documentoGastoPrueba, tieneArchivo: true, nombreArchivo: 'factura.pdf' }]),
    );
    await abrir();
    botonGasto(fixture, 'Descargar').click();
    expect(api.descargarDocumento).toHaveBeenCalledExactlyOnceWith(90, 5);
  });
  it('rechaza archivos que no sean PDF', async () => {
    await abrir();
    await archivo('factura.png');
    botonGasto(fixture, 'Adjuntar').click();
    await fixture.whenStable();
    expect(api.subirDocumentos).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Solo se permiten archivos PDF');
  });
  it('no duplica cargas y actualiza listado/documentos una sola vez tras éxito', async () => {
    const respuesta = new Subject<DocumentosGastoAdjuntados>();
    api.subirDocumentos.mockReturnValue(respuesta);
    await abrir();
    const actualizado = vi.fn();
    fixture.componentInstance.actualizado.subscribe(actualizado);
    await archivo('factura.PDF');
    botonGasto(fixture, 'Adjuntar').click();
    // El botón aún no ha sido actualizado por Angular; la guarda protege también este intervalo.
    botonGasto(fixture, 'Adjuntar').click();
    expect(api.subirDocumentos).toHaveBeenCalledTimes(1);
    respuesta.next({ ok: true, cantidad: 1 });
    respuesta.complete();
    await fixture.whenStable();
    expect(actualizado).toHaveBeenCalledTimes(1);
    expect(api.documentos).toHaveBeenCalledTimes(2);
    expect(botonGasto(fixture, 'Adjuntar').disabled).toBe(true);
  });
  it('distingue error de lectura de vacío y conserva los archivos para reintentar un rechazo', async () => {
    api.documentos.mockReturnValue(throwError(() => ({ error: { message: 'Lectura rechazada' } })));
    const respuesta = new Subject<DocumentosGastoAdjuntados>();
    api.subirDocumentos.mockReturnValue(respuesta);
    await abrir();
    expect(fixture.nativeElement.textContent).toContain('Lectura rechazada');
    expect(fixture.nativeElement.textContent).not.toContain('Este gasto no tiene documentos');
    await archivo('factura.pdf');
    botonGasto(fixture, 'Adjuntar').click();
    respuesta.error({ error: { message: 'Carga rechazada' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Carga rechazada');
    expect(botonGasto(fixture, 'Adjuntar').disabled).toBe(false);
    api.documentos.mockReturnValue(of([]));
    botonGasto(fixture, 'Reintentar').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Este gasto no tiene documentos');
  });
});
