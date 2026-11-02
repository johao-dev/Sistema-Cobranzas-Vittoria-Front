import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../app/core/services/notification.service';
import { environment } from '../../../core/config/environment';
import { FormularioRol } from './formulario-rol';

const BASE = `${environment.apiUrl}/api/seguridad`;
const ROL = {
  idRol: 3,
  nombre: 'Residente',
  descripcion: 'Obras',
  activo: true,
  fechaCreacion: null,
  usuarioCreacion: null,
  fechaModificacion: null,
  usuarioModificacion: null,
};

describe('FormularioRol', () => {
  let fixture: ComponentFixture<FormularioRol>;
  let formulario: FormularioRol;
  let http: HttpTestingController;
  const notificaciones = { show: vi.fn() };
  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    await TestBed.configureTestingModule({
      imports: [FormularioRol],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notificaciones },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FormularioRol);
    formulario = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
    notificaciones.show.mockReset();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  it('valida nombre y crea con los campos del contrato', async () => {
    fixture.componentRef.setInput('valor', null);
    fixture.detectChanges();
    formulario['guardar']();
    http.expectNone((req) => req.method === 'POST');
    formulario['form'] = { nombreRol: ' Residente ', descripcion: ' Obras ', activo: false };
    formulario['guardar']();
    const req = http.expectOne(`${BASE}/roles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Residente', descripcion: 'Obras' });
    formulario['guardar']();
    http.expectNone(`${BASE}/roles`);
    req.flush(ROL, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(formulario['guardando']()).toBe(false);
  });

  it('espera el detalle antes de editar y conserva datos ante un rechazo', async () => {
    fixture.componentRef.setInput('valor', ROL);
    fixture.detectChanges();
    formulario['guardar']();
    http.expectNone((req) => req.method === 'PUT');
    http.expectOne(`${BASE}/roles/3/permisos`).flush({ ...ROL, permisos: [] });
    await fixture.whenStable();
    http.expectOne(`${BASE}/permisos?activo=true`).flush({ permisos: [] });
    formulario['form'] = { nombreRol: ' Supervisor ', descripcion: '', activo: false };
    formulario['guardar']();
    const req = http.expectOne(`${BASE}/roles/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Supervisor', descripcion: '', activo: false });
    req.flush({ message: 'Nombre duplicado.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(formulario['form'].nombreRol).toBe(' Supervisor ');
    expect(formulario['msg']()).toContain('Nombre duplicado.');
    expect(formulario['guardando']()).toBe(false);
  });

  it('cancela consultas de otro contexto y permite volver al alta', async () => {
    fixture.componentRef.setInput('valor', ROL);
    fixture.detectChanges();
    const req = http.expectOne(`${BASE}/roles/3/permisos`);
    fixture.componentRef.setInput('valor', null);
    fixture.detectChanges();
    expect(req.cancelled).toBe(true);
    await fixture.whenStable();
    expect(formulario['listo']()).toBe(true);
    expect(formulario['form'].nombreRol).toBe('');
    expect(fixture.nativeElement.querySelector('asignacion-permisos-rol')).toBeNull();
  });
});
