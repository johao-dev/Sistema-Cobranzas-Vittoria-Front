import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { BandejaCompras } from './bandeja-compras';
import { RegistroCompras } from '../registro-compras';
import { compraPrueba, pendientePrueba } from '../compras.fixture';
import { CompraFilaSql } from '../contratos-compras';
import { AceptacionCompra } from '../aceptacion-compra/aceptacion-compra';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
describe('BandejaCompras — carga y coordinación sin Zone.js', () => {
  const api = {
    compras: vi.fn<() => Observable<CompraFilaSql[]>>(),
    pendientesCompra: vi.fn(() => of([pendientePrueba])),
  };
  let fixture: ComponentFixture<BandejaCompras>;
  beforeEach(() => {
    vi.resetAllMocks();
    api.compras.mockReturnValue(of([compraPrueba]));
    api.pendientesCompra.mockReturnValue(of([pendientePrueba]));
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: RegistroCompras, useValue: api },
        { provide: SesionUsuario, useValue: { session: { idUsuario: 99 } } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(BandejaCompras);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });
  it('muestra carga y luego proveedores plurales sin forzar detección manual', async () => {
    const respuesta = new Subject<CompraFilaSql[]>();
    api.compras.mockReturnValue(respuesta);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando compras');
    expect(fixture.nativeElement.textContent).not.toContain('No hay compras cerradas.');
    respuesta.next([compraPrueba]);
    respuesta.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('CP-009');
    expect(fixture.nativeElement.textContent).toContain('Alfa, Beta');
  });
  it('distingue fallo y vacío y ofrece reintento', async () => {
    api.compras.mockReturnValue(
      throwError(() => ({ error: { message: 'Servidor no disponible' } })),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Servidor no disponible');
    expect(fixture.nativeElement.textContent).not.toContain('No hay compras cerradas.');
    api.compras.mockReturnValue(of([]));
    const botones: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    Array.from(botones)
      .find((x) => x.textContent?.includes('Reintentar'))
      ?.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No hay compras cerradas.');
  });
  it('abre aceptación solo para la fila registrada y recarga al completarla', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-success');
    button.click();
    await fixture.whenStable();
    const child = fixture.debugElement.query(By.directive(AceptacionCompra))
      .componentInstance as AceptacionCompra;
    expect(child.compra()).toEqual(compraPrueba);
    child.aceptada.emit();
    await fixture.whenStable();
    expect(api.compras).toHaveBeenCalledTimes(2);
    expect(fixture.debugElement.query(By.directive(AceptacionCompra))).toBeNull();
  });
});
