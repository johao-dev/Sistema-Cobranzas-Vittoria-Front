import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ModalImportacion } from './modal-importacion';
import { RegistroImportacion } from '../registro-importacion';
import { SesionUsuario } from '../../../core/sesion/sesion-usuario';
import { Notificaciones } from '../../notificaciones/notificaciones';
import { ImportModulo, ImportResultado } from '../contratos-importacion';

const exito: ImportResultado = {
  ok: true,
  data: {
    modulo: 'gastos-directos',
    formato: 'xlsx',
    filasInsertadas: 2,
    totalFilas: 2,
    filasValidas: 2,
    filasInvalidas: 0,
    ok: true,
    resultado: 'IMPORTADO',
    errores: [],
  },
};
const rechazo: ImportResultado = {
  ok: false,
  httpStatus: 422,
  error: {
    ok: false,
    error: 'DATOS_INVALIDOS',
    message: 'No se registró ninguna fila.',
    totalFilas: 2,
    filasValidas: 1,
    filasInvalidas: 1,
    filasInsertadas: 0,
    resultado: 'RECHAZADO',
    errores: [
      {
        fila: 7,
        campo: 'Monto',
        codigoError: 'FORMATO_INVALIDO',
        mensaje: 'El monto no es válido.',
      },
    ],
  },
};

describe('ModalImportacion compartido', () => {
  let fixture: ComponentFixture<ModalImportacion>;
  let component: ModalImportacion;
  let respuesta: Subject<ImportResultado>;
  const puedeOperar = signal(true);
  const imports = { importar: vi.fn(), descargarPlantilla: vi.fn() };
  const notify = { show: vi.fn() };

  function abrir(modulo: ImportModulo = 'gastos-directos') {
    fixture = TestBed.createComponent(ModalImportacion);
    fixture.componentRef.setInput('modulo', modulo);
    component = fixture.componentInstance;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  }
  function elegir(nombre = 'gastos.xlsx', size = 1024) {
    const file = new File(['xlsx'], nombre);
    Object.defineProperty(file, 'size', { value: size });
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    return file;
  }
  const texto = () => fixture.nativeElement.textContent as string;
  const subir = () =>
    fixture.nativeElement.querySelector('button.btn-primary') as HTMLButtonElement;

  beforeEach(() => {
    // jsdom no implementa showModal; el navegador administra foco y teclado.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    respuesta = new Subject<ImportResultado>();
    puedeOperar.set(true);
    imports.importar.mockReset().mockReturnValue(respuesta);
    imports.descargarPlantilla.mockReset().mockReturnValue(of({ ok: true }));
    notify.show.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroImportacion, useValue: imports },
        {
          provide: SesionUsuario,
          useValue: { session: { usuarioLogin: 'operador' }, hasPermission: () => puedeOperar() },
        },
        { provide: Notificaciones, useValue: notify },
      ],
    });
    abrir();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  it('permite solicitar cierre con Escape y lo bloquea durante una importación', async () => {
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);
    const dialogo: unknown = fixture.nativeElement.querySelector('dialog');
    if (!(dialogo instanceof HTMLDialogElement)) throw new Error('Falta el diálogo');

    elegir();
    component.subir();
    const ocupado = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(ocupado);
    expect(ocupado.defaultPrevented).toBe(true);
    expect(cerrado).not.toHaveBeenCalled();

    respuesta.next(rechazo);
    await fixture.whenStable();
    const disponible = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(disponible);
    expect(disponible.defaultPrevented).toBe(true);
    expect(cerrado).toHaveBeenCalledOnce();
  });

  it('conserva el diálogo al interactuar dentro y permite cerrar desde su fondo', () => {
    const cerrado = vi.fn();
    component.cerrado.subscribe(cerrado);
    const dialogo: unknown = fixture.nativeElement.querySelector('dialog');
    if (!(dialogo instanceof HTMLDialogElement)) throw new Error('Falta el diálogo');

    const archivo = dialogo.querySelector('input');
    archivo?.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: -1, clientY: -1 }),
    );
    expect(cerrado).not.toHaveBeenCalled();
    dialogo.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: -1, clientY: -1 }),
    );
    expect(cerrado).toHaveBeenCalledOnce();
  });

  it('empieza sin archivo y muestra las instrucciones y el límite de gastos', () => {
    expect(subir().disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('input').accept).toBe('.xlsx');
    expect(texto()).toContain('10 MB');
    expect(texto()).toContain('200 registros no vacíos');
    expect(texto()).toContain('diferentes módulos');
    expect(texto()).toContain('no se registra ninguna fila');
    expect(texto()).toContain('plantilla descargada desde el sistema');
  });

  it.each(['gastos.csv', 'gastos.xls', 'gastos.pdf', 'gastos.xlsx.exe'])(
    'rechaza %s antes de enviar',
    (nombre) => {
      elegir(nombre);
      expect(component.archivo()).toBeNull();
      expect(texto()).toContain('Extensión no permitida');
      expect(subir().disabled).toBe(true);
      component.subir();
      expect(imports.importar).not.toHaveBeenCalled();
    },
  );

  it('rechaza más de 10 MB y acepta exactamente el límite con extensión en mayúsculas', () => {
    elegir('grande.xlsx', 10 * 1024 * 1024 + 1);
    expect(texto()).toContain('tamaño máximo de 10 MB');
    expect(component.archivo()).toBeNull();
    elegir('gastos.XLSX', 10 * 1024 * 1024);
    expect(component.archivo()?.name).toBe('gastos.XLSX');
    expect(texto()).toContain('10.00 MB');
    expect(component.errorArchivo()).toBe('');
  });

  it('permite reemplazar y quitar el archivo antes de enviarlo', () => {
    elegir();
    const nuevo = elegir('corregido.xlsx');
    expect(component.archivo()).toBe(nuevo);
    expect(texto()).toContain('corregido.xlsx');
    const quitar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Quitar archivo'));
    quitar?.click();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(component.archivo()).toBeNull();
    expect(subir().disabled).toBe(true);
  });

  it('evita doble envío, selección, descarga y cierre mientras procesa; emite éxito una sola vez', async () => {
    const success = vi.fn();
    const close = vi.fn();
    component.importacionCompletada.subscribe(success);
    component.cerrado.subscribe(close);
    const archivo = elegir();
    component.subir();
    component.subir();
    component.descargarPlantilla();
    component.cerrar();
    elegir('otro.xlsx');
    expect(component.archivo()).toBe(archivo);
    expect(imports.importar).toHaveBeenCalledTimes(1);
    expect(imports.descargarPlantilla).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(subir().disabled).toBe(true);
    expect(texto()).toContain('Procesando…');
    expect(success).not.toHaveBeenCalled();
    respuesta.next(exito);
    await fixture.whenStable();
    expect(success).toHaveBeenCalledExactlyOnceWith(2);
    expect(texto()).toContain('2 gasto(s) insertado(s)');
    expect(texto()).toContain('Total de filas:');
    expect(component.loading()).toBe(false);
    component.subir();
    expect(imports.importar).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('descarga mediante el servicio común y evita solicitudes concurrentes', async () => {
    const descarga = new Subject<{ ok: boolean }>();
    imports.descargarPlantilla.mockReturnValue(descarga);
    component.descargarPlantilla();
    component.descargarPlantilla();
    elegir();
    component.subir();
    expect(imports.descargarPlantilla).toHaveBeenCalledExactlyOnceWith('gastos-directos', 'xlsx');
    expect(imports.importar).not.toHaveBeenCalled();
    descarga.next({ ok: true });
    await fixture.whenStable();
    expect(component.descargandoPlantilla()).toBe(false);
  });

  it('muestra HTTP 422 por fila, conserva el archivo y limpia el rechazo al seleccionar uno corregido', async () => {
    const success = vi.fn();
    component.importacionCompletada.subscribe(success);
    const file = elegir();
    component.subir();
    respuesta.next(rechazo);
    await fixture.whenStable();
    const cells = Array.from(
      fixture.nativeElement.querySelectorAll('tbody td') as NodeListOf<HTMLElement>,
    ).map((cell) => cell.textContent?.trim());
    expect(cells).toEqual(['7', 'Monto', 'FORMATO_INVALIDO', 'El monto no es válido.']);
    expect(texto()).toContain('Válidas:');
    expect(texto()).toContain('Inválidas:');
    expect(texto()).toContain('Insertadas:');
    expect(component.resumen()?.filasInsertadas).toBe(0);
    expect(component.archivo()).toBe(file);
    expect(notify.show).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(texto()).toContain('Reintentar');
    elegir('corregido.xlsx');
    expect(component.resultado()).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(subir().disabled).toBe(false);
  });

  it.each<[number, string]>([
    [400, 'La hoja de la plantilla no existe.'],
    [413, 'El archivo supera el tamaño máximo permitido de 10 MB.'],
    [500, 'Ocurrió un error inesperado.'],
  ])('muestra HTTP %s y permite reintentar el archivo', async (httpStatus, message) => {
    elegir();
    component.subir();
    respuesta.next({
      ok: false,
      httpStatus,
      error: { ok: false, error: 'UNHANDLED_ERROR', message },
    });
    await fixture.whenStable();
    expect(texto()).toContain(message);
    expect(subir().disabled).toBe(false);
    expect(texto()).toContain('Reintentar');
    component.subir();
    expect(imports.importar).toHaveBeenCalledTimes(2);
  });

  it('cerrar y reabrir limpia archivo, errores y resultado', async () => {
    elegir();
    component.subir();
    respuesta.next(rechazo);
    await fixture.whenStable();
    const close = vi.fn();
    component.cerrado.subscribe(close);
    component.cerrar();
    expect(close).toHaveBeenCalledTimes(1);
    expect(component.archivo()).toBeNull();
    expect(component.resultado()).toBeNull();
    fixture.destroy();
    abrir();
    expect(texto()).not.toContain('El monto no es válido');
    expect(subir().disabled).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('bloquea las dos operaciones si se pierde el permiso', () => {
    elegir();
    puedeOperar.set(false);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    component.subir();
    component.descargarPlantilla();
    expect(subir().disabled).toBe(true);
    expect(imports.importar).not.toHaveBeenCalled();
    expect(imports.descargarPlantilla).not.toHaveBeenCalled();
  });

  it('conserva formatos, límite y errores detalles[] de Materiales', async () => {
    fixture.destroy();
    abrir('material');
    expect(fixture.nativeElement.querySelector('input').accept).toBe('.csv,.xlsx,.xls');
    expect(texto()).toContain('5 MB');
    elegir('materiales.csv');
    component.subir();
    respuesta.next({
      ok: false,
      httpStatus: 422,
      error: {
        ok: false,
        error: 'DATOS_INVALIDOS',
        message: 'Revisa materiales.',
        detalles: [{ _fila: 3, mensaje: 'Unidad de medida desconocida.' }],
      },
    });
    await fixture.whenStable();
    expect(texto()).toContain('Unidad de medida desconocida.');
    expect(texto()).toContain('Revisa materiales.');
  });

  it('restaura el guardado ante un error inesperado y permite reintentar el mismo archivo', async () => {
    const archivo = elegir();
    component.subir();
    respuesta.error(new Error('Error inesperado del registro'));
    await fixture.whenStable();
    expect(component.loading()).toBe(false);
    expect(component.archivo()).toBe(archivo);
    expect(subir().disabled).toBe(false);
    expect(notify.show).toHaveBeenCalledWith('No se pudo importar el archivo.', 'error');

    imports.importar.mockReturnValue(of(exito));
    component.subir();
    await fixture.whenStable();
    expect(imports.importar).toHaveBeenCalledTimes(2);
    expect(texto()).toContain('2 gasto(s) insertado(s)');
  });

  it('restaura la descarga después de un error inesperado', async () => {
    const descarga = new Subject<{ ok: boolean }>();
    imports.descargarPlantilla.mockReturnValue(descarga);
    component.descargarPlantilla();
    descarga.error(new Error('Error inesperado del registro'));
    await fixture.whenStable();

    expect(component.descargandoPlantilla()).toBe(false);
    expect(notify.show).toHaveBeenCalledWith('No se pudo descargar la plantilla.', 'error');
    imports.descargarPlantilla.mockReturnValue(of({ ok: true }));
    component.descargarPlantilla();
    expect(imports.descargarPlantilla).toHaveBeenCalledTimes(2);
  });

  it('libera la suscripción al destruirse e ignora una respuesta posterior', () => {
    const completada = vi.fn();
    component.importacionCompletada.subscribe(completada);
    elegir();
    component.subir();
    expect(respuesta.observed).toBe(true);

    fixture.destroy();
    expect(respuesta.observed).toBe(false);
    expect(component.loading()).toBe(false);
    respuesta.next(exito);
    expect(completada).not.toHaveBeenCalled();
    expect(notify.show).not.toHaveBeenCalled();
  });

  it('actualiza las instrucciones cuando cambia el módulo de entrada', async () => {
    fixture.componentRef.setInput('modulo', 'material');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').accept).toBe('.csv,.xlsx,.xls');
    expect(texto()).toContain('5 MB');
    expect(texto()).not.toContain('200 registros no vacíos');
  });
});
