import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ImportModalComponent } from './import-modal.component';
import { ImportService } from '../../../core/services/import.service';
import { SesionUsuario } from '../../../../core/sesion/sesion-usuario';
import { NotificationService } from '../../../core/services/notification.service';
import { ImportModulo, ImportResultado } from '../../../models/import.models';

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

describe('ImportModalComponent compartido', () => {
  let fixture: ComponentFixture<ImportModalComponent>;
  let component: ImportModalComponent;
  let respuesta: Subject<ImportResultado>;
  let puedeOperar: boolean;
  const imports = { importar: vi.fn(), descargarPlantilla: vi.fn() };
  const notify = { show: vi.fn() };

  function abrir(modulo: ImportModulo = 'gastos-directos') {
    fixture = TestBed.createComponent(ImportModalComponent);
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
    respuesta = new Subject<ImportResultado>();
    puedeOperar = true;
    imports.importar.mockReset().mockReturnValue(respuesta);
    imports.descargarPlantilla.mockReset().mockReturnValue(of({ ok: true }));
    notify.show.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: ImportService, useValue: imports },
        {
          provide: SesionUsuario,
          useValue: { session: { usuarioLogin: 'operador' }, hasPermission: () => puedeOperar },
        },
        { provide: NotificationService, useValue: notify },
      ],
    });
    abrir();
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
      expect(component.archivo).toBeNull();
      expect(texto()).toContain('Extensión no permitida');
      expect(subir().disabled).toBe(true);
      component.subir();
      expect(imports.importar).not.toHaveBeenCalled();
    },
  );

  it('rechaza más de 10 MB y acepta exactamente el límite con extensión en mayúsculas', () => {
    elegir('grande.xlsx', 10 * 1024 * 1024 + 1);
    expect(texto()).toContain('tamaño máximo de 10 MB');
    expect(component.archivo).toBeNull();
    elegir('gastos.XLSX', 10 * 1024 * 1024);
    expect(component.archivo?.name).toBe('gastos.XLSX');
    expect(texto()).toContain('10.00 MB');
    expect(component.errorArchivo).toBe('');
  });

  it('permite reemplazar y quitar el archivo antes de enviarlo', () => {
    elegir();
    const nuevo = elegir('corregido.xlsx');
    expect(component.archivo).toBe(nuevo);
    expect(texto()).toContain('corregido.xlsx');
    const quitar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Quitar archivo'));
    quitar?.click();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(component.archivo).toBeNull();
    expect(subir().disabled).toBe(true);
  });

  it('evita doble envío, selección, descarga y cierre mientras procesa; emite éxito una sola vez', () => {
    const success = vi.fn();
    const close = vi.fn();
    component.onSuccess.subscribe(success);
    component.onClose.subscribe(close);
    const archivo = elegir();
    component.subir();
    component.subir();
    component.descargarPlantilla();
    component.cerrar();
    elegir('otro.xlsx');
    expect(component.archivo).toBe(archivo);
    expect(imports.importar).toHaveBeenCalledTimes(1);
    expect(imports.descargarPlantilla).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(subir().disabled).toBe(true);
    expect(texto()).toContain('Procesando…');
    expect(success).not.toHaveBeenCalled();
    respuesta.next(exito);
    expect(success).toHaveBeenCalledExactlyOnceWith(2);
    expect(texto()).toContain('2 gasto(s) insertado(s)');
    expect(texto()).toContain('Total de filas:');
    expect(component.loading).toBe(false);
    component.subir();
    expect(imports.importar).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('descarga mediante el servicio común y evita solicitudes concurrentes', () => {
    const descarga = new Subject<{ ok: boolean }>();
    imports.descargarPlantilla.mockReturnValue(descarga);
    component.descargarPlantilla();
    component.descargarPlantilla();
    elegir();
    component.subir();
    expect(imports.descargarPlantilla).toHaveBeenCalledExactlyOnceWith('gastos-directos', 'xlsx');
    expect(imports.importar).not.toHaveBeenCalled();
    descarga.next({ ok: true });
    expect(component.descargandoPlantilla).toBe(false);
  });

  it('muestra HTTP 422 por fila, conserva el archivo y limpia el rechazo al seleccionar uno corregido', () => {
    const success = vi.fn();
    component.onSuccess.subscribe(success);
    const file = elegir();
    component.subir();
    respuesta.next(rechazo);
    const cells = Array.from(
      fixture.nativeElement.querySelectorAll('tbody td') as NodeListOf<HTMLElement>,
    ).map((cell) => cell.textContent?.trim());
    expect(cells).toEqual(['7', 'Monto', 'FORMATO_INVALIDO', 'El monto no es válido.']);
    expect(texto()).toContain('Válidas:');
    expect(texto()).toContain('Inválidas:');
    expect(texto()).toContain('Insertadas:');
    expect(component.resumen?.filasInsertadas).toBe(0);
    expect(component.archivo).toBe(file);
    expect(notify.show).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(texto()).toContain('Reintentar');
    elegir('corregido.xlsx');
    expect(component.resultado).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(subir().disabled).toBe(false);
  });

  it.each<[number, string]>([
    [400, 'La hoja de la plantilla no existe.'],
    [413, 'El archivo supera el tamaño máximo permitido de 10 MB.'],
    [500, 'Ocurrió un error inesperado.'],
  ])('muestra HTTP %s y permite reintentar el archivo', (httpStatus, message) => {
    elegir();
    component.subir();
    respuesta.next({
      ok: false,
      httpStatus,
      error: { ok: false, error: 'UNHANDLED_ERROR', message },
    });
    expect(texto()).toContain(message);
    expect(subir().disabled).toBe(false);
    expect(texto()).toContain('Reintentar');
    component.subir();
    expect(imports.importar).toHaveBeenCalledTimes(2);
  });

  it('cerrar y reabrir limpia archivo, errores y resultado', () => {
    elegir();
    component.subir();
    respuesta.next(rechazo);
    const close = vi.fn();
    component.onClose.subscribe(close);
    component.cerrar();
    expect(close).toHaveBeenCalledTimes(1);
    expect(component.archivo).toBeNull();
    expect(component.resultado).toBeNull();
    fixture.destroy();
    abrir();
    expect(texto()).not.toContain('El monto no es válido');
    expect(subir().disabled).toBe(true);
    expect(component.loading).toBe(false);
  });

  it('bloquea las dos operaciones si se pierde el permiso', () => {
    elegir();
    puedeOperar = false;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    component.subir();
    component.descargarPlantilla();
    expect(subir().disabled).toBe(true);
    expect(imports.importar).not.toHaveBeenCalled();
    expect(imports.descargarPlantilla).not.toHaveBeenCalled();
  });

  it('conserva formatos, límite y errores detalles[] de Materiales', () => {
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
    expect(texto()).toContain('Unidad de medida desconocida.');
    expect(texto()).toContain('Revisa materiales.');
  });
});
