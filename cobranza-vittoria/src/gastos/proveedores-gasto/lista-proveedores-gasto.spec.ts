import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { NotificationService } from '../../app/core/services/notification.service';
import { ImportService } from '../../app/core/services/import.service';
import { ProveedorGasto } from './contratos-proveedores-gasto';
import { RegistroProveedoresGasto } from './registro-proveedores-gasto';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { ListaProveedoresGasto } from './lista-proveedores-gasto';
import { CatalogoCategoriasGasto } from '../categorias/catalogo-categorias-gasto';

const row: ProveedorGasto = {
  idProveedorGastoAdministrativo: 9,
  razonSocial: 'Proveedor',
  ruc: '',
  contacto: 'Contacto',
  telefono: '',
  correo: '',
  activo: true,
  fechaCreacion: '2026-10-01',
  idCategoriaGasto: 13,
  categoria: 'Terreno',
};
describe('ListaProveedoresGasto: interacción y preservación de datos', () => {
  let fixture: ComponentFixture<ListaProveedoresGasto>;
  const api = { listar: vi.fn(), guardar: vi.fn(), desactivar: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    simularDialogosGastos();
    api.listar.mockReturnValue(of([row]));
    api.guardar.mockReturnValue(of({ idProveedorGastoAdministrativo: 9 }));
    api.desactivar.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroProveedoresGasto, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: ImportService, useValue: {} },
        { provide: CatalogoProveedores, useValue: { consultaRuc: vi.fn() } },
        {
          provide: CatalogoCategoriasGasto,
          useValue: {
            listar: () =>
              of([{ idCategoriaGasto: 13, codigo: 'TERRENO', nombre: 'Terreno', activo: true }]),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ListaProveedoresGasto);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(restaurarDialogosGastos);

  it('preserva filtro activo y contrato al editar', async () => {
    expect(api.listar).toHaveBeenCalledWith(true, null);
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(api.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        idProveedorGastoAdministrativo: 9,
        razonSocial: 'Proveedor',
        contacto: 'Contacto',
        idCategoriaGasto: 13,
      }),
    );
  });

  it('bloquea guardados duplicados y conserva borrador y errores del servidor', async () => {
    const respuesta = new Subject<{ idProveedorGastoAdministrativo: number }>();
    api.guardar.mockReturnValue(respuesta);
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-1', 'Borrador');
    botonGasto(fixture, 'Guardar proveedor').click();
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(api.guardar).toHaveBeenCalledTimes(1);
    respuesta.error({ error: { message: 'Registro rechazado' } });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Registro rechazado');
    expect(
      fixture.nativeElement.querySelector('#formulario-proveedor-especifico-campo-1').value,
    ).toBe('Borrador');
  });

  it('desactivar requiere confirmación y usa el ID específico', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await seleccionarGasto(fixture, '.actions-select', 'Desactivar');
    expect(api.desactivar).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    await seleccionarGasto(fixture, '.actions-select', 'Desactivar');
    expect(api.desactivar).toHaveBeenCalledExactlyOnceWith(row.idProveedorGastoAdministrativo);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('Limpiar durante edición inicia un alta con identificador nulo', async () => {
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    botonGasto(fixture, 'Limpiar').click();
    await fixture.whenStable();
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-1', 'Nuevo proveedor');
    await seleccionarGasto(fixture, '#proveedor-especifico-categoria', 'Terreno');
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(api.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        idProveedorGastoAdministrativo: null,
        razonSocial: 'Nuevo proveedor',
      }),
    );
  });
});
