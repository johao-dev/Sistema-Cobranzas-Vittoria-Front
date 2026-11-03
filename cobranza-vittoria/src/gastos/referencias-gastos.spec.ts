import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosPresupuestarios } from '../presupuestos/catalogos-presupuestarios';
import { RegistroGastosDirectos } from './registro-gastos-directos';
import { CategoriaGasto } from './contratos-gastos-directos';
import { ReferenciasGastos } from './referencias-gastos';
import { categoriasGastoPrueba } from './gastos.fixture';

describe('Referencias locales de Gastos', () => {
  const registro = { categorias: vi.fn(), centrosCosto: vi.fn(), proveedores: vi.fn() };
  const presupuestos = { monedas: vi.fn() };
  let referencias: ReferenciasGastos;
  beforeEach(() => {
    vi.resetAllMocks();
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba));
    registro.centrosCosto.mockReturnValue(of([{ idCentroCosto: 12 }]));
    registro.proveedores.mockReturnValue(of([{ idProveedor: 7 }]));
    presupuestos.monedas.mockReturnValue(of([{ idMoneda: 1 }]));
    TestBed.configureTestingModule({
      providers: [
        ReferenciasGastos,
        { provide: RegistroGastosDirectos, useValue: registro },
        { provide: CatalogosPresupuestarios, useValue: presupuestos },
      ],
    });
    referencias = TestBed.inject(ReferenciasGastos);
  });
  it('usa el catálogo completo, incluidas categorías nuevas sin códigos predefinidos', () => {
    const categorias = [
      ...categoriasGastoPrueba,
      { idCategoriaGasto: 500, codigo: 'NUEVA', nombre: 'Nueva categoría' },
    ];
    registro.categorias.mockReturnValue(of(categorias));
    referencias.cargar();
    expect(referencias.categorias()).toEqual(categorias);
    expect(referencias.listas()).toBe(true);
    expect(presupuestos.monedas).toHaveBeenCalledTimes(1);
  });
  it('conserva referencias válidas y permite recuperar un fallo parcial', () => {
    referencias.cargar();
    registro.proveedores.mockReturnValue(throwError(() => new Error('Sin conexión')));
    referencias.cargar();
    expect(referencias.proveedores()).toEqual([{ idProveedor: 7 }]);
    expect(referencias.centrosCosto()).toEqual([{ idCentroCosto: 12 }]);
    expect(referencias.errores()).toEqual(['No se pudieron cargar proveedores.']);
    registro.proveedores.mockReturnValue(of([{ idProveedor: 8 }]));
    referencias.cargar();
    expect(referencias.proveedores()).toEqual([{ idProveedor: 8 }]);
    expect(referencias.errores()).toEqual([]);
  });
  it('deshabilita formularios con catálogo vacío o fallido y restablece el catálogo al reintentar', () => {
    registro.categorias.mockReturnValue(of([]));
    referencias.cargar();
    expect(referencias.listas()).toBe(false);
    expect(referencias.errorCategorias()).toContain('No hay categorías de gasto');
    registro.categorias.mockReturnValue(throwError(() => new Error('Sin conexión')));
    referencias.cargar();
    expect(referencias.cargando()).toBe(false);
    expect(referencias.listas()).toBe(false);
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba));
    referencias.cargar();
    expect(referencias.listas()).toBe(true);
    expect(referencias.errores()).toEqual([]);
  });
  it('cancela la carga anterior al reintentar y al destruir el ámbito', () => {
    const anterior = new Subject<CategoriaGasto[]>();
    const actual = new Subject<CategoriaGasto[]>();
    registro.categorias.mockReturnValueOnce(anterior).mockReturnValue(actual);
    referencias.cargar();
    referencias.cargar();
    expect(anterior.observed).toBe(false);
    actual.next(categoriasGastoPrueba);
    actual.complete();
    expect(referencias.categorias()).toEqual(categoriasGastoPrueba);
    const pendiente = new Subject<CategoriaGasto[]>();
    registro.categorias.mockReturnValue(pendiente);
    referencias.cargar();
    TestBed.resetTestingModule();
    expect(pendiente.observed).toBe(false);
  });
});
