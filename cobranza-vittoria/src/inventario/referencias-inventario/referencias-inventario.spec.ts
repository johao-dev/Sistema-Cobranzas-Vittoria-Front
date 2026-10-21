import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { ReferenciasInventario } from './referencias-inventario';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { materialesPrueba } from '../inventario.fixture';
import { proveedoresCatalogosPrueba } from '../pruebas/dom-inventario';

describe('ReferenciasInventario — fallos parciales y destrucción', () => {
  const api = { materiales: vi.fn<() => Observable<Material[]>>() };

  beforeEach(() => {
    api.materiales.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ...proveedoresCatalogosPrueba,
        ReferenciasInventario,
        { provide: CatalogoMateriales, useValue: api },
      ],
    });
  });

  it('informa el catálogo fallido, conserva los otros y permite reintentar', () => {
    api.materiales.mockReturnValue(throwError(() => new Error('No disponible')));

    const referencias = TestBed.inject(ReferenciasInventario);

    referencias.cargar('salida');

    expect(referencias.especialidades()).toHaveLength(2);
    expect(referencias.proyectos()).toHaveLength(1);
    expect(referencias.errores()).toEqual(['No se pudo cargar el catálogo de materiales.']);
    api.materiales.mockReturnValue(of(materialesPrueba));
    referencias.cargar('salida');

    expect(referencias.errores()).toEqual([]);
    expect(referencias.materiales()).toEqual(materialesPrueba);
    expect(referencias.pendientes()).toBe(0);
  });

  it('libera una lectura pendiente cuando se destruye su ámbito', () => {
    const respuesta = new Subject<Material[]>();

    api.materiales.mockReturnValue(respuesta);

    const referencias = TestBed.inject(ReferenciasInventario);

    referencias.cargar('compras');

    expect(referencias.pendientes()).toBe(1);
    TestBed.resetTestingModule();
    respuesta.next(materialesPrueba);

    expect(referencias.materiales()).toEqual([]);
    expect(referencias.pendientes()).toBe(0);
  });
});
