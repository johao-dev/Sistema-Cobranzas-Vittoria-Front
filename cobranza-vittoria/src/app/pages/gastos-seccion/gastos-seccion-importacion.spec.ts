import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, of, Subject } from 'rxjs';
import { routes } from '../../app.routes';
import { SesionUsuario } from '../../../core/sesion/sesion-usuario';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import {
  GastosDirectosService,
  GastoDirectoDocumento,
} from '../../core/services/gastos-directos.service';
import { ImportService } from '../../core/services/import.service';
import { NotificationService } from '../../core/services/notification.service';
import { ImportResultado } from '../../models/import.models';
import { ImportModalComponent } from '../../shared/components/import-modal/import-modal.component';
import { GastoDirectoVistaConfig, GastosSeccionPage } from './gastos-seccion.page';

const paths = [
  'gastos-administrativos',
  'terreno',
  'marketing-publicidad',
  'otros-gastos',
  'gastos-municipales-distritales',
];
const documento: GastoDirectoDocumento = {
  idGastoDirectoDocumento: 5,
  idGastoDirecto: 90,
  tipoDocumento: 'Factura',
  nombreArchivo: 'F001-245',
  rutaArchivo: null,
  extension: null,
  fechaCreacion: '2026-10-14',
  numeroFactura: 'F001-245',
  tieneArchivo: false,
};

describe('integración compartida de importación en las cinco vistas de gastos', () => {
  let fixture: ComponentFixture<GastosSeccionPage>;
  let component: GastosSeccionPage;
  let permiso: boolean;
  let respuesta: Subject<ImportResultado>;
  const gastos = { listar: vi.fn(), descargarDocumento: vi.fn() };
  const imports = { importar: vi.fn(), descargarPlantilla: vi.fn() };

  function abrirVista(path = paths[0]) {
    fixture = TestBed.createComponent(GastosSeccionPage);
    component = fixture.componentInstance;
    component.config = routes.find((route) => route.path === path)?.data as GastoDirectoVistaConfig;
    component.categoriasVista = component.config.codigosCategoria.map((codigo, i) => ({
      codigo,
      nombre: codigo,
      idCategoriaGasto: 20 + i,
    }));
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  }
  const botonImportar = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Importar gastos'));

  beforeEach(() => {
    permiso = true;
    respuesta = new Subject<ImportResultado>();
    gastos.listar.mockReset().mockReturnValue(of([]));
    gastos.descargarDocumento.mockReset().mockReturnValue(EMPTY);
    imports.importar.mockReset().mockReturnValue(respuesta);
    imports.descargarPlantilla.mockReset().mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { data: EMPTY } },
        { provide: GastosDirectosService, useValue: gastos },
        { provide: ControlPresupuestarioService, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        {
          provide: SesionUsuario,
          useValue: {
            session: { usuarioLogin: 'operador' },
            hasPermission: (p: string) => p === 'gasto_directo.operar' && permiso,
          },
        },
        { provide: ImportService, useValue: imports },
      ],
    });
  });

  it.each(paths)(
    '%s oculta la acción sin gasto_directo.operar y usa el mismo diálogo cuando tiene permiso',
    (path) => {
      permiso = false;
      abrirVista(path);
      expect(routes.find((route) => route.path === path)?.component).toBe(GastosSeccionPage);
      expect(botonImportar()).toBeUndefined();
      component.abrirImportModal();
      expect(component.importOpen).toBe(false);
      permiso = true;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      botonImportar()?.click();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(ImportModalComponent))
        .componentInstance as ImportModalComponent;
      expect(modal.modulo).toBe('gastos-directos');
      modal.descargarPlantilla();
      expect(imports.descargarPlantilla).toHaveBeenCalledExactlyOnceWith('gastos-directos', 'xlsx');
    },
  );

  it('el éxito recarga una sola vez la vista actual, conserva todos los filtros y mantiene el resumen abierto', () => {
    abrirVista('terreno');
    component.filtroEstado = 'REGISTRADO';
    component.filtroCentroCosto = '12';
    component.filtroDesde = '2026-10-01';
    component.filtroHasta = '2026-10-14';
    component.filtroBusqueda = 'Estudios';
    botonImportar()?.click();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const modal = fixture.debugElement.query(By.directive(ImportModalComponent))
      .componentInstance as ImportModalComponent;
    modal.archivo = new File(['xlsx'], 'general.xlsx');
    modal.subir();
    expect(gastos.listar).not.toHaveBeenCalled();
    expect(imports.importar).toHaveBeenCalledExactlyOnceWith(
      'gastos-directos',
      modal.archivo,
      'operador',
    );
    respuesta.next({
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
    });
    expect(gastos.listar).toHaveBeenCalledExactlyOnceWith({
      idCategoriaGasto: [20, 21, 22],
      estado: 'REGISTRADO',
      idCentroCosto: 12,
      desde: '2026-10-01',
      hasta: '2026-10-14',
    });
    expect(component.filtroBusqueda).toBe('Estudios');
    expect(component.importOpen).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('2 gasto(s) insertado(s)');
    modal.cerrar();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(component.importOpen).toBe(false);
    expect(gastos.listar).toHaveBeenCalledTimes(1);
    botonImportar()?.click();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const nuevo = fixture.debugElement.query(By.directive(ImportModalComponent))
      .componentInstance as ImportModalComponent;
    expect(nuevo.archivo).toBeNull();
    expect(nuevo.resultado).toBeNull();
  });

  it('las facturas de referencia muestran su número sin ofrecer ni solicitar la descarga', () => {
    abrirVista();
    component.gastoSeleccionado = { idGastoDirecto: 90 } as NonNullable<
      typeof component.gastoSeleccionado
    >;
    component.documentos = [documento];
    component.modalDocumentos = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('F001-245');
    expect(fixture.nativeElement.textContent).toContain('Referencia de factura');
    const descargar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).filter((button) => button.textContent?.trim() === 'Descargar');
    expect(descargar).toHaveLength(0);
    component.descargar(documento);
    expect(gastos.descargarDocumento).not.toHaveBeenCalled();
  });

  it('las facturas con PDF conservan la acción y el endpoint de descarga autenticada', () => {
    abrirVista();
    component.gastoSeleccionado = { idGastoDirecto: 90 } as NonNullable<
      typeof component.gastoSeleccionado
    >;
    component.documentos = [
      {
        ...documento,
        nombreArchivo: 'factura.pdf',
        numeroFactura: null,
        tieneArchivo: true,
        rutaArchivo: 'factura.pdf',
        extension: '.pdf',
      },
    ];
    component.modalDocumentos = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('factura.pdf');
    const descargar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Descargar');
    expect(descargar).toBeDefined();
    descargar?.click();
    expect(gastos.descargarDocumento).toHaveBeenCalledExactlyOnceWith(90, 5);
  });
});
