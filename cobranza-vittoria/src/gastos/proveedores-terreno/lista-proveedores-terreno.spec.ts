import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { NotificationService } from '../../app/core/services/notification.service';
import { ImportService } from '../../app/core/services/import.service';
import { ProveedorTerreno } from './contratos-proveedores-terreno';
import { RegistroProveedoresTerreno } from './registro-proveedores-terreno';
import {
  botonGasto,
  escribirGasto,
  seleccionarGasto,
  simularDialogosGastos,
  restaurarDialogosGastos,
} from '../pruebas/dom-gastos';
import { ListaProveedoresTerreno } from './lista-proveedores-terreno';

const row: ProveedorTerreno = {
  idProveedorTerreno: 9,
  razonSocial: 'Proveedor',
  ruc: '',
  contacto: 'Contacto',
  telefono: '',
  correo: '',
  activo: true,
  fechaCreacion: '2026-10-01',
};
describe('ListaProveedoresTerreno: interacción y preservación de datos', () => {
  let fixture: ComponentFixture<ListaProveedoresTerreno>;
  const api = { listar: vi.fn(), guardar: vi.fn(), desactivar: vi.fn() };
  beforeEach(async () => {
    vi.resetAllMocks();
    simularDialogosGastos();
    api.listar.mockReturnValue(of([row]));
    api.guardar.mockReturnValue(of({ idProveedorTerreno: 9 }));
    api.desactivar.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroProveedoresTerreno, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: ImportService, useValue: {} },
        { provide: CatalogoProveedores, useValue: { consultaRuc: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ListaProveedoresTerreno);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(restaurarDialogosGastos);

  it('preserva filtro activo y contrato al editar', async () => {
    expect(api.listar).toHaveBeenCalledWith(true);
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    botonGasto(fixture, 'Guardar proveedor').click();
    expect(api.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        idProveedorTerreno: 9,
        razonSocial: 'Proveedor',
        contacto: 'Contacto',
      }),
    );
  });

  it('bloquea guardados duplicados y conserva borrador y errores del servidor', async () => {
    const respuesta = new Subject<{ idProveedorTerreno: number }>();
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
    expect(api.desactivar).toHaveBeenCalledExactlyOnceWith(row.idProveedorTerreno);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('Limpiar durante edición inicia un alta con identificador nulo', async () => {
    await seleccionarGasto(fixture, '.actions-select', 'Editar');
    botonGasto(fixture, 'Limpiar').click();
    await fixture.whenStable();
    await escribirGasto(fixture, '#formulario-proveedor-especifico-campo-1', 'Nuevo proveedor');

    botonGasto(fixture, 'Guardar proveedor').click();
    expect(api.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ idProveedorTerreno: null, razonSocial: 'Nuevo proveedor' }),
    );
  });
});
