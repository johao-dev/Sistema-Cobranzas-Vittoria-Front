import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumenCompras } from './resumen-compras';
import { CargarDashboard } from '../carga-dashboard/cargar-dashboard';
import { DatosDashboard } from '../contratos-dashboard';
import { calcularTarjetas } from '../indicadores/calculos-dashboard';

function crearDatos(value: number = 100): DatosDashboard {
  return {
    tarjetas: [{ key: 'compras', label: 'Compras registradas', value }],
    materiales: [{ material: 'Cemento', cantidad: 3, monto: 40, frecuencia: 2 }],
    cargandoMateriales: false,
    errores: [],
  };
}

describe('ResumenCompras sin Zone.js', () => {
  let fixture: ComponentFixture<ResumenCompras>;
  let respuesta: Subject<DatosDashboard>;
  let carga: Pick<CargarDashboard, 'cargar'>;

  async function crear(): Promise<void> {
    respuesta = new Subject<DatosDashboard>();
    carga = { cargar: vi.fn<CargarDashboard['cargar']>().mockReturnValue(respuesta) };
    await TestBed.configureTestingModule({
      imports: [ResumenCompras],
      providers: [provideZonelessChangeDetection(), { provide: CargarDashboard, useValue: carga }],
    }).compileComponents();
    fixture = TestBed.createComponent(ResumenCompras);
    await fixture.whenStable();
  }

  function raiz(): HTMLElement {
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('No se creó el dashboard.');
    return elemento;
  }

  function actualizar(): void {
    const boton: HTMLButtonElement | null = raiz().querySelector('button');
    if (!boton) throw new Error('No se encontró el botón de actualización.');
    boton.click();
  }

  afterEach(() => respuesta?.complete());

  it('carga una sola vez al entrar y muestra el estado inicial', async () => {
    await crear();
    expect(carga.cargar).toHaveBeenCalledOnce();
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain('Cargando dashboard...');
  });

  it('actualiza tarjetas y tres gráficos tras la respuesta sin detectChanges manual', async () => {
    await crear();
    respuesta.next(crearDatos());
    await fixture.whenStable();
    expect(raiz().querySelector('.kpi-card__value')?.textContent).toBe('PEN 100.00');
    expect(raiz().querySelectorAll('grafico-materiales')).toHaveLength(3);
    expect(
      raiz()
        .querySelector('grafico-materiales[metrica="monto"] .chart-row__value')
        ?.textContent?.trim(),
    ).toBe('PEN 40.00');
    expect(
      raiz()
        .querySelector('grafico-materiales[metrica="frecuencia"] .chart-row__value')
        ?.textContent?.trim(),
    ).toBe('2');
    expect(raiz().querySelector('[role="status"]')).toBeNull();
  });

  it('muestra indicadores mientras espera materiales y retira ese estado al completar', async () => {
    await crear();
    respuesta.next({ ...crearDatos(), materiales: [], cargandoMateriales: true });
    await fixture.whenStable();
    expect(raiz().querySelector('.kpi-card__value')?.textContent).toBe('PEN 100.00');
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain(
      'Cargando materiales...',
    );
    respuesta.next(crearDatos());
    await fixture.whenStable();
    expect(raiz().querySelector('section[aria-busy]')?.getAttribute('aria-busy')).toBe('false');
    expect(raiz().querySelectorAll('grafico-materiales')).toHaveLength(3);
  });

  it('cancela la carga anterior al actualizar e ignora sus respuestas tardías', async () => {
    await crear();
    const siguiente = new Subject<DatosDashboard>();
    vi.mocked(carga.cargar).mockReturnValue(siguiente);
    actualizar();
    expect(respuesta.observed).toBe(false);
    respuesta.next(crearDatos(999));
    siguiente.next(crearDatos(200));
    await fixture.whenStable();
    expect(raiz().querySelector('.kpi-card__value')?.textContent).toBe('PEN 200.00');
    siguiente.complete();
  });

  it('mantiene un mensaje de actualización cuando ya había datos', async () => {
    await crear();
    respuesta.next(crearDatos());
    await fixture.whenStable();
    vi.mocked(carga.cargar).mockReturnValue(new Subject<DatosDashboard>());
    actualizar();
    await fixture.whenStable();
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain(
      'Actualizando dashboard...',
    );
  });

  it('distingue datos vacíos de datos incompletos por un error', async () => {
    await crear();
    respuesta.next({
      tarjetas: calcularTarjetas([], []),
      materiales: [],
      cargandoMateriales: false,
      errores: [],
    });
    await fixture.whenStable();
    expect(raiz().querySelectorAll('.empty-state')).toHaveLength(2);
    respuesta.next({ ...crearDatos(), errores: ['No se pudieron cargar las valorizaciones.'] });
    await fixture.whenStable();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain(
      'pueden estar incompletos',
    );
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('valorizaciones');
    expect(raiz().querySelectorAll('.empty-state')).toHaveLength(0);
  });

  it('restaura la vista tras un fallo inesperado y permite reintentar', async () => {
    await crear();
    respuesta.error(new Error('fallo de prueba'));
    await fixture.whenStable();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('Intenta actualizarlo');
    const siguiente = new Subject<DatosDashboard>();
    vi.mocked(carga.cargar).mockReturnValue(siguiente);
    actualizar();
    siguiente.next(crearDatos());
    await fixture.whenStable();
    expect(raiz().querySelector('[role="alert"]')).toBeNull();
    siguiente.complete();
  });

  it('libera la carga al abandonar la vista', async () => {
    await crear();
    expect(respuesta.observed).toBe(true);
    fixture.destroy();
    expect(respuesta.observed).toBe(false);
  });
});
