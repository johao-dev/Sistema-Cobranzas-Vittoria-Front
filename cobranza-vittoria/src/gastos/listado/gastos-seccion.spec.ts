import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { rutas } from '../../rutas';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { CatalogosPresupuestarios } from '../../presupuestos/catalogos-presupuestarios';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { RegistroImportacion } from '../../shared/importacion/registro-importacion';
import { ImportResultado } from '../../shared/importacion/contratos-importacion';
import { ModalImportacion } from '../../shared/importacion/modal-importacion/modal-importacion';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { GastoDirectoListado } from '../contratos-gastos-directos';
import { categoriasGastoPrueba, gastoPrueba } from '../gastos.fixture';
import { FormularioGasto } from '../formulario/formulario-gasto';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { GastosSeccion } from './gastos-seccion';

describe('GastosSeccion: módulo único y operaciones compartidas', () => {
  let fixture: ComponentFixture<GastosSeccion>;
  let permiso: boolean;
  const imports = { importar: vi.fn(), descargarPlantilla: vi.fn() };
  const registro = {
    categorias: vi.fn(),
    centrosCosto: vi.fn(),
    proveedores: vi.fn(),
    listar: vi.fn<() => Observable<GastoDirectoListado[]>>(),
    partidasDisponibles: vi.fn(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosGastos();
    permiso = true;
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba));
    registro.centrosCosto.mockReturnValue(
      of([{ idCentroCosto: 12, codigo: 'CC-12', nombre: 'Proyecto' }]),
    );
    registro.proveedores.mockReturnValue(of([]));
    registro.listar.mockReturnValue(of([]));
    registro.partidasDisponibles.mockReturnValue(of([]));
    imports.descargarPlantilla.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(rutas),
        { provide: RegistroGastosDirectos, useValue: registro },
        { provide: CatalogosPresupuestarios, useValue: { monedas: () => of([]) } },
        {
          provide: SesionUsuario,
          useValue: {
            hasPermission: () => permiso,
            isAuthenticated: () => true,
            canAccess: () => true,
            session: { usuarioLogin: 'operador' },
          },
        },
        { provide: Notificaciones, useValue: notificaciones },
        { provide: RegistroImportacion, useValue: imports },
      ],
    });
  });
  afterEach(restaurarDialogosGastos);

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(GastosSeccion);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('carga una única ruta protegida y consulta sin restringir categorías', async () => {
    const harness = await RouterTestingHarness.create('/gastos');
    expect(TestBed.inject(Router).url).toBe('/gastos');
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(GastosSeccion);
    const route = rutas.find((item) => item.path === 'gastos');
    expect(await route?.loadComponent?.()).toBe(GastosSeccion);
    expect(route?.canActivate).toHaveLength(1);
    expect(registro.listar).toHaveBeenCalledExactlyOnceWith({
      estado: null,
      idCentroCosto: null,
      desde: null,
      hasta: null,
    });
  });

  it('retira las cinco rutas anteriores y el alias de control presupuestario', () => {
    for (const path of [
      'gastos-administrativos',
      'terreno',
      'marketing-publicidad',
      'otros-gastos',
      'gastos-municipales-distritales',
    ]) {
      expect(rutas.some((route) => route.path === path)).toBe(false);
    }
    const control = rutas.find((route) => route.path === 'control-presupuestario');
    expect(control?.children?.some((route) => route.path === 'gastos-directos')).toBe(false);
  });

  it('oculta las acciones de escritura sin permiso', async () => {
    permiso = false;
    registro.listar.mockReturnValue(of([gastoPrueba]));
    await abrir();
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.textContent).not.toContain('Importar gastos');
    expect(raiz.textContent).not.toContain('+ Nuevo gasto');
    expect(raiz.querySelector('option[value="edit"]')).toBeNull();
    expect(raiz.querySelector('option[value="confirmar"]')).toBeNull();
    expect(raiz.querySelector('option[value="anular"]')).toBeNull();
    expect(raiz.querySelector('option[value="documentos"]')).not.toBeNull();
  });

  it('filtra por una categoría y vuelve a consultar todas al quitarla', async () => {
    await abrir();
    registro.listar.mockClear();
    await seleccionarGasto(fixture, '#gastos-filtro-categoria', 'MARKETING Y VENTAS');
    expect(registro.listar).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ idCategoriaGasto: [22] }),
    );
    registro.listar.mockClear();
    await seleccionarGasto(fixture, '#gastos-filtro-categoria', 'Todas');
    expect(registro.listar).toHaveBeenCalledExactlyOnceWith({
      estado: null,
      idCentroCosto: null,
      desde: null,
      hasta: null,
    });
  });

  it('muestra gastos de distintas categorías, sin categoría y con una categoría retirada', async () => {
    registro.listar.mockReturnValue(
      of([
        gastoPrueba,
        {
          ...gastoPrueba,
          idGastoDirecto: 91,
          idCategoriaGasto: 22,
          nombreCategoriaGasto: 'MARKETING Y VENTAS',
        },
        { ...gastoPrueba, idGastoDirecto: 92, idCategoriaGasto: null, nombreCategoriaGasto: null },
        {
          ...gastoPrueba,
          idGastoDirecto: 93,
          idCategoriaGasto: 999,
          nombreCategoriaGasto: 'Categoría retirada',
        },
      ]),
    );
    await abrir();
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(raiz.textContent).toContain('Categoría retirada');
    await seleccionarGasto(fixture, 'tbody tr:last-child .actions-select', 'Editar');
    expect(fixture.debugElement.query(By.directive(FormularioGasto))).not.toBeNull();
  });

  it('importa con el diálogo público, recarga una sola vez y conserva filtros y resumen', async () => {
    const respuesta = new Subject<ImportResultado>();
    imports.importar.mockReturnValue(respuesta);
    await abrir();
    await seleccionarGasto(fixture, '#gastos-filtro-categoria', 'TERRENO');
    await seleccionarGasto(fixture, '#gastos-seccion-campo-2', 'Registrado');
    await seleccionarGasto(fixture, '#gastos-seccion-campo-3', 'Proyecto');
    await escribirGasto(fixture, '#gastos-seccion-campo-4', '2026-10-01');
    await escribirGasto(fixture, '#gastos-seccion-campo-5', '2026-10-14');
    await escribirGasto(fixture, '#gastos-seccion-campo-1', 'Estudios');
    botonGasto(fixture, 'Importar gastos').click();
    await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(ModalImportacion))
      .componentInstance as ModalImportacion;
    modal.descargarPlantilla();
    expect(imports.descargarPlantilla).toHaveBeenCalledExactlyOnceWith('gastos-directos', 'xlsx');
    registro.listar.mockClear();
    modal.archivo.set(new File(['xlsx'], 'gastos.xlsx'));
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
      idCategoriaGasto: [13],
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
    const nuevo = fixture.debugElement.query(By.directive(ModalImportacion))
      .componentInstance as ModalImportacion;
    expect(nuevo.resultado()).toBeNull();
    expect(nuevo.archivo()).toBeNull();
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

  it('mantiene la consulta sin categorías y bloquea fechas invertidas', async () => {
    registro.categorias.mockReturnValue(of([]));
    await abrir();
    expect(registro.listar).toHaveBeenCalledTimes(1);
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

  it('reintentar referencias conserva el listado pendiente aunque falle el catálogo', async () => {
    const listado = new Subject<GastoDirectoListado[]>();
    registro.listar.mockReturnValue(listado);
    registro.proveedores.mockReturnValue(throwError(() => new Error('Sin conexión')));
    await abrir();

    registro.categorias.mockReturnValue(throwError(() => new Error('Sin categorías')));
    botonGasto(fixture, 'Reintentar referencias').click();
    await fixture.whenStable();

    expect(listado.observed).toBe(true);
    listado.next([gastoPrueba]);
    listado.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(gastoPrueba.concepto);
    expect(botonGasto(fixture, '+ Nuevo gasto').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('No hay gastos registrados');
  });

  it('mantiene retirado Resumen Total', () => {
    expect(rutas.some((route) => route.path === 'resumen-total')).toBe(false);
  });
});
