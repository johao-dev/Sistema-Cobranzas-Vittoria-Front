import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../app/core/services/notification.service';
import { environment } from '../../../core/config/environment';
import { ListaUsuarios } from './lista-usuarios';

const RUTA = `${environment.apiUrl}/api/seguridad/usuarios`;
const FILA = {
  idUsuario: 12,
  nombres: 'José',
  apellidos: 'Pérez',
  correo: 'jose@correo.com',
  usuarioLogin: 'jperez',
  activo: true,
};

describe('ListaUsuarios sin Zone.js', () => {
  let fixture: ComponentFixture<ListaUsuarios>;
  let lista: ListaUsuarios;
  let http: HttpTestingController;
  const notificaciones = { show: vi.fn() };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaUsuarios],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificaciones },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ListaUsuarios);
    lista = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    notificaciones.show.mockReset();
  });

  it('conserva la omisión inicial de activo y busca sin tildes ni distinción de mayúsculas', async () => {
    http.expectOne(RUTA).flush({ usuarios: [FILA] });
    lista['filtroBusqueda'].set('JOSE');
    await fixture.whenStable();
    expect(lista['rowsFiltradas']()).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    lista['filtroBusqueda'].set('inexistente');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('cancela consultas reemplazadas, conserva búsqueda y envía activo=false', async () => {
    const anterior = http.expectOne(RUTA);
    lista['filtroBusqueda'].set('JOSE');
    lista['filtroActivo'].set(false);
    lista['load']();
    expect(anterior.cancelled).toBe(true);
    http.expectOne(`${RUTA}?activo=false`).flush({ usuarios: [{ ...FILA, activo: false }] });
    await fixture.whenStable();
    expect(lista['cargando']()).toBe(false);
    expect(lista['filtroBusqueda']()).toBe('JOSE');
    expect(lista['rowsFiltradas']()).toHaveLength(1);
  });

  it('distingue errores de listas vacías y recupera datos al reintentar', async () => {
    http
      .expectOne(RUTA)
      .flush({ message: 'Consulta rechazada' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Consulta rechazada');
    expect(lista['errorListado']()).not.toBe('');
    lista['load']();
    http.expectOne(RUTA).flush({ usuarios: [] });
    await fixture.whenStable();
    expect(lista['errorListado']()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No hay');
  });

  it('cancela la consulta al destruir la vista', () => {
    const req = http.expectOne(RUTA);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });
});
