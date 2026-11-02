import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Data } from '@angular/router';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { routes } from '../../app/app.routes';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { CatalogosPresupuestarios } from '../../presupuestos/catalogos-presupuestarios';
import { NotificationService } from '../../app/core/services/notification.service';
import { ImportService } from '../../app/core/services/import.service';
import { ImportResultado } from '../../app/models/import.models';
import { ImportModalComponent } from '../../app/shared/components/import-modal/import-modal.component';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { GastoDirectoListado } from '../contratos-gastos-directos';
import { categoriasGastoPrueba, gastoPrueba } from '../gastos.fixture';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { GastosSeccion } from './gastos-seccion';

const paths = [
  'gastos-administrativos',
  'terreno',
  'marketing-publicidad',
  'otros-gastos',
  'gastos-municipales-distritales',
];
function datosRuta(path: string): Data {
  const data = routes.find((route) => route.path === path)?.data;
  if (!data) throw new Error('Falta configuración de ruta');
  return data;
}

describe('GastosSeccion: cinco vistas y operaciones compartidas', () => {
  let fixture: ComponentFixture<GastosSeccion>;
  let ruta: BehaviorSubject<Data>;
  let permiso: boolean;
  const imports = { importar: vi.fn(), descargarPlantilla: vi.fn() };
  const registro = {
    categorias: vi.fn(),
    centrosCosto: vi.fn(),
    proveedores: vi.fn(),
    listar: vi.fn<() => Observable<GastoDirectoListado[]>>(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosGastos();
    permiso = true;
    ruta = new BehaviorSubject(datosRuta('terreno'));
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba));
    registro.centrosCosto.mockReturnValue(
      of([{ idCentroCosto: 12, codigo: 'CC-12', nombre: 'Proyecto' }]),
    );
    registro.proveedores.mockReturnValue(of([]));
    registro.listar.mockReturnValue(of([]));
    imports.descargarPlantilla.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { data: ruta } },
        { provide: RegistroGastosDirectos, useValue: registro },
        { provide: CatalogosPresupuestarios, useValue: { monedas: () => of([]) } },
        {
          provide: SesionUsuario,
          useValue: { hasPermission: () => permiso, session: { usuarioLogin: 'operador' } },
        },
        { provide: NotificationService, useValue: notificaciones },
        { provide: ImportService, useValue: imports },
      ],
    });
  });
  afterEach(restaurarDialogosGastos);

  async function abrir(path = 'terreno'): Promise<void> {
    ruta.next(datosRuta(path));
    fixture = TestBed.createComponent(GastosSeccion);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it.each(paths)('%s mantiene URL, protección y categorías por código', async (path) => {
    await abrir(path);
    const route = routes.find((item) => item.path === path);
    expect(await route?.loadComponent?.()).toBe(GastosSeccion);
    expect(route?.canActivate).toHaveLength(1);
    const codigos: string[] = datosRuta(path)['codigosCategoria'];
    const esperadas = codigos.map(
      (codigo) =>
        categoriasGastoPrueba.find((categoria) => categoria.codigo === codigo)?.idCategoriaGasto,
    );
    expect(registro.listar).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ idCategoriaGasto: esperadas }),
    );
  });

  it.each(paths)('%s oculta las acciones de escritura sin permiso', async (path) => {
    permiso = false;
    await abrir(path);
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.textContent).not.toContain('Importar gastos');
    expect(raiz.textContent).not.toContain('+ Nuevo gasto');
  });

  it('importa con el diálogo público, recarga una sola vez y conserva filtros y resumen', async () => {
    const respuesta = new Subject<ImportResultado>();
    imports.importar.mockReturnValue(respuesta);
    await abrir();
    await seleccionarGasto(fixture, '#gastos-seccion-campo-2', 'Registrado');
    await seleccionarGasto(fixture, '#gastos-seccion-campo-3', 'Proyecto');
    await escribirGasto(fixture, '#gastos-seccion-campo-4', '2026-10-01');
    await escribirGasto(fixture, '#gastos-seccion-campo-5', '2026-10-14');
    await escribirGasto(fixture, '#gastos-seccion-campo-1', 'Estudios');
    botonGasto(fixture, 'Importar gastos').click();
    await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(ImportModalComponent))
      .componentInstance as ImportModalComponent;
    modal.descargarPlantilla();
    expect(imports.descargarPlantilla).toHaveBeenCalledExactlyOnceWith('gastos-directos', 'xlsx');
    registro.listar.mockClear();
    modal.archivo = new File(['xlsx'], 'gastos.xlsx');
    modal.subir();
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
    await fixture.whenStable();
    expect(registro.listar).toHaveBeenCalledExactlyOnceWith({
      idCategoriaGasto: [13, 14, 15],
      estado: 'REGISTRADO',
      idCentroCosto: 12,
      desde: '2026-10-01',
      hasta: '2026-10-14',
    });
    expect(fixture.nativeElement.textContent).toContain('2 gasto(s) insertado(s)');
    expect(fixture.nativeElement.querySelector('#gastos-seccion-campo-1').value).toBe('Estudios');
    modal.cerrar();
    await fixture.whenStable();
    botonGasto(fixture, 'Importar gastos').click();
    await fixture.whenStable();
    const nuevo = fixture.debugElement.query(By.directive(ImportModalComponent))
      .componentInstance as ImportModalComponent;
    expect(nuevo.resultado).toBeNull();
    expect(nuevo.archivo).toBeNull();
  });

  it('totaliza por moneda sin anulados ni importes de referencia y busca sin tildes', async () => {
    registro.listar.mockReturnValue(
      of([
        gastoPrueba,
        { ...gastoPrueba, idGastoDirecto: 91, monto: 40, moneda: 'USD' },
        { ...gastoPrueba, idGastoDirecto: 92, monto: 500, estado: 'ANULADO' },
      ]),
    );
    await abrir();
    await escribirGasto(fixture, '#gastos-seccion-campo-1', 'tecnico');
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(raiz.textContent).toContain('2 gasto(s) sin anular');
    expect(raiz.querySelector('tfoot')?.textContent).toContain('100.00');
    expect(raiz.querySelector('tfoot')?.textContent).toContain('40.00');
    expect(raiz.querySelector('.monto-referencia')?.textContent).toContain('25.00');
  });

  it('distingue error de vacío y permite reintentar', async () => {
    registro.listar.mockReturnValue(
      throwError(() => ({ error: { message: 'Consulta rechazada' } })),
    );
    await abrir();
    expect(fixture.nativeElement.textContent).toContain('Consulta rechazada');
    expect(fixture.nativeElement.textContent).not.toContain('No hay gastos registrados');
    registro.listar.mockReturnValue(of([gastoPrueba]));
    botonGasto(fixture, 'Reintentar').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Estudio técnico');
  });

  it('cancela listados anteriores al cambiar filtros y al destruir la vista', async () => {
    const anterior = new Subject<GastoDirectoListado[]>();
    const actual = new Subject<GastoDirectoListado[]>();
    registro.listar.mockReturnValueOnce(anterior).mockReturnValue(actual);
    await abrir();
    await seleccionarGasto(fixture, '#gastos-seccion-campo-2', 'Confirmado');
    expect(anterior.observed).toBe(false);
    actual.next([{ ...gastoPrueba, concepto: 'Actual' }]);
    actual.complete();
    anterior.next([gastoPrueba]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Actual');
    expect(fixture.nativeElement.textContent).not.toContain('Estudio técnico');
    const pendiente = new Subject<GastoDirectoListado[]>();
    registro.listar.mockReturnValue(pendiente);
    await seleccionarGasto(fixture, '#gastos-seccion-campo-2', 'Registrado');
    fixture.destroy();
    expect(pendiente.observed).toBe(false);
  });

  it('bloquea categorías faltantes y fechas invertidas antes de consultar', async () => {
    registro.categorias.mockReturnValue(of([]));
    await abrir();
    expect(registro.listar).not.toHaveBeenCalled();
    expect(botonGasto(fixture, '+ Nuevo gasto').disabled).toBe(true);
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba));
    botonGasto(fixture, 'Reintentar').click();
    await fixture.whenStable();
    await escribirGasto(fixture, '#gastos-seccion-campo-4', '2026-10-30');
    registro.listar.mockClear();
    await escribirGasto(fixture, '#gastos-seccion-campo-5', '2026-10-01');
    expect(registro.listar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('La fecha desde no puede ser posterior');
  });

  it('reintentar referencias cancela el listado si después falla el catálogo', async () => {
    const listado = new Subject<GastoDirectoListado[]>();
    registro.listar.mockReturnValue(listado);
    registro.proveedores.mockReturnValue(throwError(() => new Error('Sin conexión')));
    await abrir();

    registro.categorias.mockReturnValue(throwError(() => new Error('Sin categorías')));
    botonGasto(fixture, 'Reintentar referencias').click();
    await fixture.whenStable();

    expect(listado.observed).toBe(false);
    expect(botonGasto(fixture, '+ Nuevo gasto').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('No hay gastos registrados');
  });

  it('mantiene retirado Resumen Total y el alias de gastos directos', () => {
    expect(routes.some((route) => route.path === 'resumen-total')).toBe(false);
    const control = routes.find((route) => route.path === 'control-presupuestario');
    expect(control?.children?.find((route) => route.path === 'gastos-directos')?.redirectTo).toBe(
      '/gastos-administrativos',
    );
  });
});
