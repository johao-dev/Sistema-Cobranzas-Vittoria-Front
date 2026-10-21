import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of } from 'rxjs';

import { ListaSalidas } from './lista-salidas';
import { FormularioSalida } from './formulario-salida';
import { RegistroInventario } from '../registro-inventario';
import { KardexSalidaResponseDto } from '../contratos-inventario';
import { NotificationService } from '../../app/core/services/notification.service';
import { salidasPrueba } from '../inventario.fixture';
import {
  botonInventario,
  proveedoresCatalogosPrueba,
  simularDialogosInventario,
  restaurarDialogosInventario,
  seleccionarInventario,
  escribirInventario,
} from '../pruebas/dom-inventario';

describe('ListaSalidas — coordinación y búsqueda', () => {
  const api = {
    listarSalidas: vi.fn<() => Observable<KardexSalidaResponseDto[]>>(),
    eliminarSalida: vi.fn<() => Observable<{ ok: boolean }>>(),
  };
  const notify = { show: vi.fn() };
  let fixture: ComponentFixture<ListaSalidas>;

  beforeEach(() => {
    vi.resetAllMocks();
    simularDialogosInventario();
    api.listarSalidas.mockReturnValue(of(salidasPrueba));
    api.eliminarSalida.mockReturnValue(of({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        ...proveedoresCatalogosPrueba,
        { provide: RegistroInventario, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(ListaSalidas);
  });

  afterEach(restaurarDialogosInventario);

  it('refleja carga asíncrona y luego búsqueda sin tildes sin detección forzada', async () => {
    const respuesta = new Subject<KardexSalidaResponseDto[]>();

    api.listarSalidas.mockReturnValue(respuesta);
    fixture.detectChanges();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('Cargando salidas');
    expect(raiz.textContent).not.toContain('No hay salidas');
    respuesta.next(salidasPrueba);
    respuesta.complete();
    await fixture.whenStable();
    await escribirInventario(fixture, 'input[placeholder="Buscar salidas"]', 'electrica');

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('editar una fila filtrada reconstruye todos los ítems de la salida', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await escribirInventario(fixture, 'input[placeholder="Buscar salidas"]', 'Cable');

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(1);
    await seleccionarInventario(fixture, '.actions-select', 'Editar');

    const form = fixture.debugElement.query(By.directive(FormularioSalida))
      .componentInstance as FormularioSalida;

    expect(form.filas()).toEqual(salidasPrueba);
  });

  it('recupera todos los detalles antes de editar con filtro de especialidad activo', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    api.listarSalidas.mockReturnValueOnce(of([salidasPrueba[0]]));
    await seleccionarInventario(fixture, '#inventario-filtro-especialidad', 'Eléctrica');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const todasLasFilas = [
      salidasPrueba[0],
      {
        ...salidasPrueba[1],
        idMaterial: 12,
        nombre: 'Cemento',
        idEspecialidad: 5,
        especialidad: 'Civil',
      },
    ];

    api.listarSalidas.mockReturnValueOnce(of(todasLasFilas));
    await seleccionarInventario(fixture, '.actions-select', 'Editar');

    const form = fixture.debugElement.query(By.directive(FormularioSalida))
      .componentInstance as FormularioSalida;

    expect(api.listarSalidas).toHaveBeenLastCalledWith();
    expect(form.filas()).toEqual(todasLasFilas);
  });

  it('no abre edición parcial si falla la recuperación de la salida filtrada', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await seleccionarInventario(fixture, '#inventario-filtro-especialidad', 'Eléctrica');
    botonInventario(fixture, 'Filtrar').click();
    await fixture.whenStable();

    const pendiente = new Subject<KardexSalidaResponseDto[]>();

    api.listarSalidas.mockReturnValueOnce(pendiente);
    await seleccionarInventario(fixture, '.actions-select', 'Editar');

    expect(botonInventario(fixture, '+ Nuevo registro').disabled).toBe(true);
    pendiente.error({ error: { message: 'No se pudo cargar la salida.' } });
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.directive(FormularioSalida))).toBeNull();
    expect(botonInventario(fixture, '+ Nuevo registro').disabled).toBe(false);
    expect(notify.show).toHaveBeenCalledWith('No se pudo cargar la salida.', 'error');
  });

  it('confirma y elimina la salida completa por ID aun con búsqueda activa', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await escribirInventario(fixture, 'input[placeholder="Buscar salidas"]', 'Cable');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await seleccionarInventario(fixture, '.actions-select', 'Eliminar');

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('2 ítems'));
    expect(api.eliminarSalida).toHaveBeenCalledExactlyOnceWith(4);
    expect(api.listarSalidas).toHaveBeenCalledTimes(2);
  });

  it('muestra 422 al eliminar y conserva el listado para corregir/reintentar', async () => {
    const respuesta = new Subject<{ ok: boolean }>();

    api.eliminarSalida.mockReturnValue(respuesta);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await seleccionarInventario(fixture, '.actions-select', 'Eliminar');
    respuesta.error({ error: { message: 'No se puede eliminar' } });
    await fixture.whenStable();

    expect(notify.show).toHaveBeenCalledWith('No se puede eliminar', 'error');

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
