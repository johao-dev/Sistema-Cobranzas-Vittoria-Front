import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { RegistroImportacion } from '../../shared/importacion/registro-importacion';
import { CategoriaGastoReferencia } from './contratos-categorias-gasto';
import { CatalogoCategoriasGasto } from './catalogo-categorias-gasto';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { ListaCategoriasGasto } from './lista-categorias-gasto';

const row: CategoriaGastoReferencia = {
  idCategoriaGasto: 13,
  codigo: 'TERRENO',
  nombre: 'Terreno',
  activo: true,
};
describe('ListaCategoriasGasto: interacción y preservación de datos', () => {
  let fixture: ComponentFixture<ListaCategoriasGasto>;
  const api = { listar: vi.fn(), guardar: vi.fn(), desactivar: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    simularDialogosGastos();
    api.listar.mockReturnValue(of([row]));
    api.guardar.mockReturnValue(of({ idCategoriaGasto: 9 }));
    api.desactivar.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogoCategoriasGasto, useValue: api },
        { provide: Notificaciones, useValue: { show: vi.fn() } },
        { provide: RegistroImportacion, useValue: {} },
        { provide: CatalogoProveedores, useValue: { consultaRuc: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ListaCategoriasGasto);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(restaurarDialogosGastos);

  it('preserva filtro activo y contrato al editar', async () => {
    expect(api.listar).toHaveBeenCalledWith(true);
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    botonGasto(fixture, 'Guardar categoría').click();
    expect(api.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        idCategoriaGasto: 13,
        codigo: 'TERRENO',
        nombre: 'Terreno',
        activo: true,
      }),
    );
  });

  it('bloquea guardados duplicados y conserva borrador y errores del servidor', async () => {
    const respuesta = new Subject<{ idCategoriaGasto: number }>();
    api.guardar.mockReturnValue(respuesta);
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    await escribirGasto(fixture, '#categoria-gasto-nombre', 'Borrador');
    botonGasto(fixture, 'Guardar categoría').click();
    botonGasto(fixture, 'Guardar categoría').click();
    expect(api.guardar).toHaveBeenCalledTimes(1);
    respuesta.error({ error: { message: 'Registro rechazado' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Registro rechazado');
    expect(fixture.nativeElement.querySelector('#categoria-gasto-nombre').value).toBe('Borrador');
  });

  it('desactivar requiere confirmación y usa el ID específico', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await seleccionarGasto(fixture, '.actions-select', 'Desactivar');
    expect(api.desactivar).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    await seleccionarGasto(fixture, '.actions-select', 'Desactivar');
    expect(api.desactivar).toHaveBeenCalledExactlyOnceWith(row.idCategoriaGasto);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });
});
