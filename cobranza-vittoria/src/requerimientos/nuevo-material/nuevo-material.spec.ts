import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { NuevoMaterial } from './nuevo-material';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { Material, MaterialUpsert } from '../../catalogos/materiales/contratos-materiales';
import { NotificationService } from '../../app/core/services/notification.service';
import { muestraMaterial, simularDialogosRequerimiento } from '../pruebas/muestras-requerimientos';

describe('NuevoMaterial desde un requerimiento', () => {
  let fixture: ComponentFixture<NuevoMaterial>;
  let restaurarDialogo: () => void;

  const api = {
    guardarMaterial: vi.fn<(dto: MaterialUpsert) => Observable<{ idMaterial: number }>>(),
    materiales: vi.fn<() => Observable<Material[]>>(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    restaurarDialogo = simularDialogosRequerimiento();

    api.guardarMaterial.mockReturnValue(of({ idMaterial: 93 }));
    api.materiales.mockReturnValue(of([muestraMaterial()]));
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogoMateriales, useValue: api },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(NuevoMaterial);

    fixture.componentRef.setInput('especialidades', [
      { idEspecialidad: 4, nombre: 'Estructuras', activo: true },
    ]);
    fixture.componentRef.setInput('unidades', [
      { idUnidadMedida: 1, codigo: 'BOL', nombre: 'Bolsa', activo: true },
    ]);
    fixture.componentRef.setInput('partidas', []);
    fixture.componentRef.setInput('especialidadInicial', 4);
    fixture.componentRef.setInput('partidaInicial', 10);
    await fixture.whenStable();
  });

  afterEach(() => restaurarDialogo());

  function raiz(): HTMLElement {
    return fixture.nativeElement;
  }
  function enviar(): void {
    raiz()
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  async function completar(): Promise<void> {
    const descripcion = raiz().querySelector<HTMLInputElement>('#nuevo-material-descripcion')!;

    descripcion.value = '  Cemento  ';

    descripcion.dispatchEvent(new Event('input'));

    const unidad = raiz().querySelector<HTMLSelectElement>('#nuevo-material-unidad')!;

    unidad.value = unidad.options[1].value;

    unidad.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('valida los campos antes de crear', async () => {
    enviar();
    await fixture.whenStable();

    expect(api.guardarMaterial).not.toHaveBeenCalled();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('especialidad');
  });

  it('normaliza el alta, conserva la partida y comunica el material por su ID', async () => {
    const guardado = vi.fn();
    const cerrar = vi.fn();

    fixture.componentInstance.guardado.subscribe(guardado);

    fixture.componentInstance.cerrar.subscribe(cerrar);

    await completar();
    enviar();

    expect(api.guardarMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        idMaterial: null,
        idEspecialidad: 4,
        descripcion: 'Cemento',
        unidadMedida: 'BOL',
        codigo: '',
        idCatalogoPartida: 10,
      }),
    );
    expect(guardado).toHaveBeenCalledWith({
      materiales: [muestraMaterial()],
      idMaterial: 93,
      idEspecialidad: 4,
    });
    expect(cerrar).toHaveBeenCalledOnce();
  });

  it('bloquea envíos y cierre durante el alta y recupera el formulario tras un error', async () => {
    const escritura = new Subject<{ idMaterial: number }>();

    api.guardarMaterial.mockReturnValue(escritura);

    const cerrar = vi.fn();

    fixture.componentInstance.cerrar.subscribe(cerrar);

    await completar();
    enviar();
    enviar();

    const cancelar = new Event('cancel', { cancelable: true });

    raiz().querySelector('dialog')!.dispatchEvent(cancelar);

    expect(cancelar.defaultPrevented).toBe(true);
    expect(cerrar).not.toHaveBeenCalled();
    expect(api.guardarMaterial).toHaveBeenCalledTimes(1);

    escritura.error(
      new HttpErrorResponse({ status: 422, error: { message: 'Revisa el material' } }),
    );
    await fixture.whenStable();

    expect(fixture.componentInstance.guardando()).toBe(false);
    expect(raiz().querySelector<HTMLInputElement>('#nuevo-material-descripcion')?.value).toBe(
      '  Cemento  ',
    );
    expect(raiz().textContent).toContain('Revisa el material');
  });

  it('si falla el catálogo tras crear, reintenta solo el GET y conserva el ID creado', async () => {
    api.materiales
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValueOnce(of([muestraMaterial()]));

    const guardado = vi.fn();

    fixture.componentInstance.guardado.subscribe(guardado);

    await completar();
    enviar();
    await fixture.whenStable();

    expect(raiz().textContent).toContain('Actualizar catálogo');
    expect(fixture.componentInstance.guardando()).toBe(false);

    enviar();

    expect(api.guardarMaterial).toHaveBeenCalledTimes(1);
    expect(api.materiales).toHaveBeenCalledTimes(2);
    expect(guardado).toHaveBeenCalledWith(expect.objectContaining({ idMaterial: 93 }));
  });

  it('libera las consultas cuando se destruye el diálogo', async () => {
    const escritura = new Subject<{ idMaterial: number }>();

    api.guardarMaterial.mockReturnValue(escritura);

    await completar();
    enviar();
    fixture.destroy();

    expect(escritura.observed).toBe(false);
  });
});
