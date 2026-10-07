import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { CategoriaGasto, GastoDirectoListado } from '../../core/services/gastos-directos.service';
import {
  GastoDirectoVistaConfig,
  GastosSeccionPage,
  resolverCategoriasPorCodigo
} from './gastos-seccion.page';

describe('configuración de las vistas de Gasto Directo', () => {
  const catalogo: CategoriaGasto[] = [
    { idCategoriaGasto: 61, codigo: 'ADMINISTRATIVO', nombre: 'GASTOS ADMINISTRATIVOS' },
    { idCategoriaGasto: 22, codigo: 'MARKETING_VENTAS', nombre: 'MARKETING Y VENTAS' },
    { idCategoriaGasto: 35, codigo: 'OTROS', nombre: 'OTROS GASTOS' },
    { idCategoriaGasto: 47, codigo: 'MUNICIPAL', nombre: 'GASTOS MUNICIPALES' },
    { idCategoriaGasto: 13, codigo: 'TERRENO', nombre: 'TERRENO' },
    { idCategoriaGasto: 14, codigo: 'ANTEPROYECTO', nombre: 'ANTEPROYECTO' },
    { idCategoriaGasto: 15, codigo: 'PROYECTO', nombre: 'PROYECTO' }
  ];

  const config = (path: string) => routes.find(route => route.path === path)?.data as GastoDirectoVistaConfig;

  function crearComponente() {
    const gastos = {
      listar: vi.fn(() => of([])),
      crear: vi.fn(() => of({})),
      actualizar: vi.fn(() => of({})),
      confirmar: vi.fn(() => of({})),
      anular: vi.fn(() => of({}))
    };
    const notifications = { show: vi.fn() };
    const component = new GastosSeccionPage(
      {} as any,
      gastos as any,
      {} as any,
      notifications as any,
      { hasPermission: () => true } as any,
      { detectChanges: vi.fn() } as any
    );
    return { component, gastos, notifications };
  }

  it.each([
    ['gastos-administrativos', ['ADMINISTRATIVO']],
    ['marketing-publicidad', ['MARKETING_VENTAS']],
    ['otros-gastos', ['OTROS']],
    ['gastos-municipales-distritales', ['MUNICIPAL']]
  ])('%s declara y resuelve su categoría automática', (path, codigos) => {
    const vista = config(path as string);
    expect(vista.codigosCategoria).toEqual(codigos);
    expect(vista.permiteSeleccionCategoria).toBe(false);

    const resultado = resolverCategoriasPorCodigo(catalogo, vista.codigosCategoria);
    expect(resultado.faltantes).toEqual([]);
    expect(resultado.categorias).toHaveLength(1);

    const { component } = crearComponente();
    component.config = vista;
    component.categoriasVista = resultado.categorias;
    expect(component.formVacio().idCategoriaGasto).toBe(resultado.categorias[0].idCategoriaGasto);
  });

  it('no conserva la ruta del módulo obsoleto Resumen Total', () => {
    expect(routes.some(route => route.path === 'resumen-total')).toBe(false);
  });

  it('Terreno resuelve exactamente TERRENO, ANTEPROYECTO y PROYECTO con IDs del catálogo', () => {
    const vista = config('terreno');
    expect(vista.codigosCategoria).toEqual(['TERRENO', 'ANTEPROYECTO', 'PROYECTO']);
    expect(vista.permiteSeleccionCategoria).toBe(true);

    const resultado = resolverCategoriasPorCodigo(catalogo, vista.codigosCategoria);
    expect(resultado.categorias.map(categoria => categoria.idCategoriaGasto)).toEqual([13, 14, 15]);
    expect(resultado.faltantes).toEqual([]);
  });

  it('Terreno empieza sin categoría y exige una opción permitida antes de guardar', () => {
    const { component, gastos, notifications } = crearComponente();
    component.config = config('terreno');
    component.categoriasVista = resolverCategoriasPorCodigo(catalogo, component.config.codigosCategoria).categorias;
    component.form = component.formVacio();

    expect(component.form.idCategoriaGasto).toBe('');
    component.guardar();

    expect(notifications.show).toHaveBeenCalledWith('Selecciona una categoría válida para esta vista.', 'info');
    expect(gastos.crear).not.toHaveBeenCalled();
  });

  it('load y las recargas posteriores a confirmar/anular conservan el filtro de categorías', () => {
    const { component, gastos } = crearComponente();
    component.config = config('terreno');
    component.categoriasVista = resolverCategoriasPorCodigo(catalogo, component.config.codigosCategoria).categorias;
    component.load();

    const esperado = [13, 14, 15];
    expect(gastos.listar).toHaveBeenLastCalledWith(expect.objectContaining({ idCategoriaGasto: esperado }));

    const row: GastoDirectoListado = {
      idGastoDirecto: 90,
      idPresupuestoDetalle: 1,
      idCentroCosto: 2,
      idCatalogoPartida: 3,
      idCategoriaGasto: 13,
      codigoCategoriaGasto: 'TERRENO',
      nombreCategoriaGasto: 'TERRENO',
      idProveedor: null,
      idMoneda: 1,
      fecha: '2026-10-07',
      concepto: 'Compra',
      descripcion: null,
      monto: 100,
      estado: 'REGISTRADO'
    };
    component.pedirConfirmacion('confirmar', row);
    component.ejecutarConfirmacion();

    expect(gastos.confirmar).toHaveBeenCalledWith(90);
    expect(gastos.listar).toHaveBeenLastCalledWith(expect.objectContaining({ idCategoriaGasto: esperado }));

    component.pedirConfirmacion('anular', row);
    component.ejecutarConfirmacion();

    expect(gastos.anular).toHaveBeenCalledWith(90);
    expect(gastos.listar).toHaveBeenLastCalledWith(expect.objectContaining({ idCategoriaGasto: esperado }));
  });
});
