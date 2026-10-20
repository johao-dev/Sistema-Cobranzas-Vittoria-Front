import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of } from 'rxjs';
import { BandejaOrdenes } from './bandeja-ordenes';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { RegistroRequerimientos } from '../../requerimientos/registro-requerimientos';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { DetalleOrdenCompra, OrdenCompra } from '../contratos-ordenes-compra';
import { detallePrueba, ordenPrueba, requerimientoPrueba } from '../ordenes-compra.fixture';
import { FormularioOrden } from '../formulario-orden/formulario-orden';
import { NuevoProveedorOrden } from '../nuevo-proveedor-orden/nuevo-proveedor-orden';
import { DetalleOrden } from '../detalle-orden/detalle-orden';
import { CambioEstadoOrden } from '../cambio-estado-orden/cambio-estado-orden';
import { NotificationService } from '../../app/core/services/notification.service';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';

describe('BandejaOrdenes — coordinación y actualización sin Zone.js', () => {
  const registro = {
    listar: vi.fn<() => Observable<OrdenCompra[]>>(),
    obtener: vi.fn<() => Observable<DetalleOrdenCompra>>(),
    crear: vi.fn(() => of({ idOrdenCompra: 9, total: 0 })),
    cambiarEstado: vi.fn(() => of({ ok: true })),
  };
  const requerimientos = {
    listar: vi.fn(() => of([requerimientoPrueba.requerimiento])),
    obtener: vi.fn(() => of(requerimientoPrueba)),
  };
  let fixture: ComponentFixture<BandejaOrdenes>;

  beforeEach(() => {
    vi.resetAllMocks();
    // jsdom no implementa este límite nativo; el componente y su estado siguen siendo reales.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    registro.listar.mockReturnValue(of([ordenPrueba]));
    registro.obtener.mockReturnValue(of(detallePrueba));
    registro.crear.mockReturnValue(of({ idOrdenCompra: 9, total: 0 }));
    registro.cambiarEstado.mockReturnValue(of({ ok: true }));
    requerimientos.listar.mockReturnValue(of([requerimientoPrueba.requerimiento]));
    requerimientos.obtener.mockReturnValue(of(requerimientoPrueba));
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroOrdenesCompra, useValue: registro },
        { provide: RegistroRequerimientos, useValue: requerimientos },
        {
          provide: CatalogoProveedores,
          useValue: {
            proveedores: () =>
              of([
                { idProveedor: 30, razonSocial: 'Alfa', activo: true },
                { idProveedor: 40, razonSocial: 'Beta', activo: true },
              ]),
          },
        },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: SesionUsuario, useValue: { session: { idUsuario: 99 } } },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  function pulsar(texto: string): void {
    const raiz: HTMLElement = fixture.nativeElement;
    const boton = [...raiz.querySelectorAll('button')].find((boton) =>
      boton.textContent?.includes(texto),
    );
    if (!boton) throw new Error('Falta botón ' + texto);
    boton.click();
  }

  async function abrirDetalle(): Promise<void> {
    const raiz: HTMLElement = fixture.nativeElement;
    const select = raiz.querySelector<HTMLSelectElement>('select.actions-select');
    if (!select) throw new Error('Falta acción de orden');
    select.value = 'detalle';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('refleja listados asíncronos y usa proveedores de cabecera confirmados por API', async () => {
    const pendientes = new Subject<OrdenCompra[]>();
    registro.listar.mockReturnValue(pendientes);
    fixture = TestBed.createComponent(BandejaOrdenes);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cargando bandeja');
    pendientes.next([ordenPrueba]);
    pendientes.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Alfa, Beta');
    expect(fixture.nativeElement.textContent).toContain('$ 150.00');
    expect(fixture.nativeElement.textContent).not.toContain('Cargando bandeja');
  });

  it('asigna el proveedor creado solo a líneas sin selección y recarga al completar la orden', async () => {
    fixture = TestBed.createComponent(BandejaOrdenes);
    await fixture.whenStable();
    pulsar('Generar O.C.');
    await fixture.whenStable();
    const raiz: HTMLElement = fixture.nativeElement;
    const selects = raiz.querySelectorAll<HTMLSelectElement>('.provider-select');
    selects[1].selectedIndex = 2;
    selects[1].dispatchEvent(new Event('change'));
    pulsar('+ Nuevo proveedor');
    await fixture.whenStable();
    const nuevo: NuevoProveedorOrden = fixture.debugElement.query(
      By.directive(NuevoProveedorOrden),
    ).componentInstance;
    nuevo.guardado.emit({
      idProveedor: 30,
      proveedores: [
        { idProveedor: 30, razonSocial: 'Alfa', activo: true },
        { idProveedor: 40, razonSocial: 'Beta', activo: true },
      ],
    });
    await fixture.whenStable();
    expect(selects[0].value).toContain('30');
    expect(selects[1].value).toContain('40');
    const formulario: FormularioOrden = fixture.debugElement.query(
      By.directive(FormularioOrden),
    ).componentInstance;
    formulario.creada.emit();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.directive(FormularioOrden))).toBeNull();
    expect(registro.listar).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Orden creada correctamente');
  });

  it('filtra detalle manteniendo el total completo y refresca tras cambiar estado', async () => {
    fixture = TestBed.createComponent(BandejaOrdenes);
    await fixture.whenStable();
    await abrirDetalle();
    const raiz: HTMLElement = fixture.nativeElement;
    const filtro = raiz.querySelector<HTMLSelectElement>('#filtro-proveedor-orden');
    if (!filtro) throw new Error('Falta filtro');
    filtro.value = 'Beta';
    filtro.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const dialogo = raiz.querySelector('detalle-orden');
    expect(dialogo?.textContent).toContain('Material 0');
    expect(dialogo?.textContent).not.toContain('Material 1');
    expect(dialogo?.textContent).toContain('$ 150.00');
    const detalle: DetalleOrden = fixture.debugElement.query(
      By.directive(DetalleOrden),
    ).componentInstance;
    detalle.cambiarEstado.emit({ orden: ordenPrueba, destino: 'APROBADA' });
    await fixture.whenStable();
    const cambio: CambioEstadoOrden = fixture.debugElement.query(
      By.directive(CambioEstadoOrden),
    ).componentInstance;
    registro.obtener.mockReturnValue(
      of({ ...detallePrueba, ordenCompra: { ...ordenPrueba, estado: 'APROBADA' } }),
    );
    cambio.completada.emit(8);
    await fixture.whenStable();
    expect(registro.obtener).toHaveBeenCalledTimes(2);
    expect(registro.listar).toHaveBeenCalledTimes(2);
    expect(fixture.debugElement.query(By.directive(CambioEstadoOrden))).toBeNull();
    expect(raiz.querySelector('detalle-orden')?.textContent).toContain('APROBADA');
  });
});
