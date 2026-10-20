import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { BorradorRequerimiento } from './borrador-requerimiento';
import { ConsultaRequerimientos } from '../consulta-requerimientos/consulta-requerimientos';
import { RegistroRequerimientos } from '../registro-requerimientos';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { NotificationService } from '../../app/core/services/notification.service';
import { RequerimientoActionResponse } from '../contratos-requerimientos';
import { muestraRequerimiento } from '../pruebas/muestras-requerimientos';

describe('BorradorRequerimiento sin coordinador ni componentes', () => {
  let borrador: BorradorRequerimiento;
  let respuesta: Subject<RequerimientoActionResponse>;
  const actualizar = vi.fn();

  beforeEach(() => {
    actualizar.mockReset();

    respuesta = new Subject<RequerimientoActionResponse>();

    actualizar.mockReturnValue(respuesta);
    TestBed.configureTestingModule({
      providers: [
        BorradorRequerimiento,
        ConsultaRequerimientos,
        { provide: RegistroRequerimientos, useValue: { actualizar, listar: () => of([]) } },
        { provide: SesionUsuario, useValue: { hasPermission: () => true } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    });

    borrador = TestBed.inject(BorradorRequerimiento);

    const detalle = muestraRequerimiento();

    detalle.requerimiento.fechaEntrega = '2026-10-23';

    borrador.preparar(detalle);
  });

  it('guarda una vez y anuncia el contexto para que el coordinador decida la navegación', () => {
    const guardado = vi.fn();

    borrador.guardado.subscribe(guardado);

    borrador.guardar();

    borrador.guardar();

    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(borrador.saving()).toBe(true);

    respuesta.next({ ok: true });

    respuesta.complete();

    expect(guardado).toHaveBeenCalledWith({ id: 45, editando: true });
    expect(borrador.saving()).toBe(false);
    expect(borrador.form().items).toHaveLength(1);
  });

  it('cancela su escritura al destruir su ámbito aunque no exista la pantalla', () => {
    borrador.guardar();

    expect(respuesta.observed).toBe(true);

    TestBed.resetTestingModule();

    expect(respuesta.observed).toBe(false);
  });
});
