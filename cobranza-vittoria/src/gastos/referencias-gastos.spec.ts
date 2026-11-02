import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosPresupuestarios } from '../presupuestos/catalogos-presupuestarios';
import { RegistroGastosDirectos } from './registro-gastos-directos';
import { CategoriaGasto } from './contratos-gastos-directos';
import { ReferenciasGastos } from './referencias-gastos';
import { categoriasGastoPrueba, configGastoPrueba } from './gastos.fixture';

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
  it('resuelve solo categorías de la vista y no consulta catálogos presupuestarios ajenos', () => {
    referencias.cargar(configGastoPrueba);
    expect(referencias.categorias().map((categoria) => categoria.idCategoriaGasto)).toEqual([
      13, 14, 15,
    ]);
    expect(referencias.listas()).toBe(true);
    expect(presupuestos.monedas).toHaveBeenCalledTimes(1);
  });
  it('conserva referencias válidas y permite recuperar un fallo parcial', () => {
    referencias.cargar(configGastoPrueba);
    registro.proveedores.mockReturnValue(throwError(() => new Error('Sin conexión')));
    referencias.cargar(configGastoPrueba);
    expect(referencias.proveedores()).toEqual([{ idProveedor: 7 }]);
    expect(referencias.centrosCosto()).toEqual([{ idCentroCosto: 12 }]);
    expect(referencias.errores()).toEqual(['No se pudieron cargar proveedores.']);
    registro.proveedores.mockReturnValue(of([{ idProveedor: 8 }]));
    referencias.cargar(configGastoPrueba);
    expect(referencias.proveedores()).toEqual([{ idProveedor: 8 }]);
    expect(referencias.errores()).toEqual([]);
  });
  it('bloquea el listado si falla el catálogo o falta una categoría configurada', () => {
    registro.categorias.mockReturnValue(of(categoriasGastoPrueba.slice(0, 5)));
    referencias.cargar(configGastoPrueba);
    expect(referencias.listas()).toBe(false);
    expect(referencias.errorCategorias()).toContain('ANTEPROYECTO, PROYECTO');
    registro.categorias.mockReturnValue(throwError(() => new Error('Sin conexión')));
    referencias.cargar(configGastoPrueba);
    expect(referencias.cargando()).toBe(false);
    expect(referencias.listas()).toBe(false);
  });
  it('cancela la categoría anterior al cambiar de vista y al destruir el ámbito', () => {
    const anterior = new Subject<CategoriaGasto[]>();
    const actual = new Subject<CategoriaGasto[]>();
    registro.categorias.mockReturnValueOnce(anterior).mockReturnValue(actual);
    referencias.cargar(configGastoPrueba);
    referencias.cargar({ ...configGastoPrueba, codigosCategoria: ['OTROS'] });
    expect(anterior.observed).toBe(false);
    actual.next(categoriasGastoPrueba);
    actual.complete();
    expect(referencias.categorias().map((categoria) => categoria.codigo)).toEqual(['OTROS']);
    const pendiente = new Subject<CategoriaGasto[]>();
    registro.categorias.mockReturnValue(pendiente);
    referencias.cargar(configGastoPrueba);
    TestBed.resetTestingModule();
    expect(pendiente.observed).toBe(false);
  });
});
