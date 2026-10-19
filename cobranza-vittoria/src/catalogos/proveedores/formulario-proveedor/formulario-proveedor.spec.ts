import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioProveedor } from './formulario-proveedor';
import { CatalogoProveedores } from '../catalogo-proveedores';
import { ConsultaRuc, ProveedorUpsert } from '../contratos-proveedores';
import {
  PROVEEDOR,
  enviar,
  escribir,
  obtenerElemento,
  obtenerRaiz,
} from '../../pruebas/muestras-catalogos';

describe('FormularioProveedor', () => {
  let fixture: ComponentFixture<FormularioProveedor>;
  let respuesta: Subject<ConsultaRuc>;
  let api: Pick<CatalogoProveedores, 'consultaRuc'>;
  async function crear(): Promise<HTMLElement> {
    respuesta = new Subject<ConsultaRuc>();
    api = { consultaRuc: vi.fn<CatalogoProveedores['consultaRuc']>().mockReturnValue(respuesta) };
    await TestBed.configureTestingModule({
      imports: [FormularioProveedor],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CatalogoProveedores, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FormularioProveedor);
    fixture.componentRef.setInput('valor', PROVEEDOR);
    await fixture.whenStable();
    return obtenerRaiz(fixture.nativeElement);
  }
  afterEach(() => respuesta?.complete());
  it('envía los campos bancarios, de contacto y el identificador al editar', async () => {
    const raiz = await crear();
    const recibido = vi.fn<(dto: ProveedorUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    escribir(raiz, '#proveedor-cuentaCorriente', '123456');
    escribir(raiz, '#proveedor-observacion', 'Contacto comercial');
    enviar(raiz);
    expect(recibido).toHaveBeenCalledWith(
      expect.objectContaining({
        idProveedor: 1,
        ruc: '20123456789',
        cuentaCorriente: '123456',
        observacion: 'Contacto comercial',
      }),
    );
  });
  it('valida RUC y correo antes de emitir el guardado', async () => {
    const raiz = await crear();
    const recibido = vi.fn<(dto: ProveedorUpsert) => void>();
    fixture.componentInstance.guardar.subscribe(recibido);
    escribir(raiz, '#proveedor-ruc', '123');
    escribir(raiz, '#proveedor-correo', 'invalido');
    enviar(raiz);
    await fixture.whenStable();
    expect(recibido).not.toHaveBeenCalled();
    expect(raiz.textContent).toContain('11 dígitos');
  });
  it('aplica SUNAT asincrónicamente y actualiza el formulario sin detectChanges', async () => {
    const raiz = await crear();
    obtenerElemento<HTMLInputElement>(raiz, '#proveedor-ruc').dispatchEvent(new Event('blur'));
    expect(api.consultaRuc).toHaveBeenCalledWith('20123456789');
    respuesta.next({
      numero_documento: '20123456789',
      razon_social: 'Empresa SUNAT',
      direccion: '-',
      estado: 'ACTIVO',
    });
    respuesta.complete();
    await fixture.whenStable();
    expect(obtenerElemento<HTMLInputElement>(raiz, '#proveedor-razonSocial').value).toBe(
      'Empresa SUNAT',
    );
    expect(obtenerElemento<HTMLInputElement>(raiz, '#proveedor-direccion').value).toBe('');
  });
  it('ignora una respuesta de otro RUC después de cambiarlo', async () => {
    const raiz = await crear();
    obtenerElemento<HTMLInputElement>(raiz, '#proveedor-ruc').dispatchEvent(new Event('blur'));
    escribir(raiz, '#proveedor-ruc', '20987654321');
    respuesta.next({
      numero_documento: '20123456789',
      razon_social: 'Dato anterior',
      direccion: '',
      estado: 'ACTIVO',
    });
    await fixture.whenStable();
    expect(obtenerElemento<HTMLInputElement>(raiz, '#proveedor-razonSocial').value).toBe(
      'Proveedor',
    );
  });
  it('muestra el error de consulta y permite reintentar', async () => {
    const raiz = await crear();
    const campo: HTMLInputElement = obtenerElemento(raiz, '#proveedor-ruc');
    campo.dispatchEvent(new Event('blur'));
    respuesta.error(
      new HttpErrorResponse({ status: 404, error: 'No se encontraron datos para el RUC.' }),
    );
    await fixture.whenStable();
    expect(raiz.textContent).toContain('No se encontraron datos');
    respuesta = new Subject<ConsultaRuc>();
    vi.mocked(api.consultaRuc).mockReturnValue(respuesta);
    campo.dispatchEvent(new Event('blur'));
    expect(api.consultaRuc).toHaveBeenCalledTimes(2);
  });
  it('libera la consulta al destruir el formulario', async () => {
    const raiz = await crear();
    obtenerElemento<HTMLInputElement>(raiz, '#proveedor-ruc').dispatchEvent(new Event('blur'));
    fixture.destroy();
    expect(respuesta.observed).toBe(false);
  });
});
