import { TestBed } from '@angular/core/testing';
import { Subject, finalize, of, throwError } from 'rxjs';

import { ConsultaInventario } from './consulta-inventario';

describe('ConsultaInventario — concurrencia y errores', () => {
  it('cancela la consulta anterior y evita que una respuesta tardía reemplace la actual', () => {
    const consulta = TestBed.runInInjectionContext(() => new ConsultaInventario<number>());
    const primera = new Subject<number[]>();
    const cancelada = vi.fn();

    consulta.cargar(primera.pipe(finalize(cancelada)));
    consulta.cargar(of([2]));
    primera.next([1]);

    expect(cancelada).toHaveBeenCalledOnce();
    expect(consulta.filas()).toEqual([2]);
    expect(consulta.cargando()).toBe(false);
  });

  it('distingue error de vacío y permite reintentar', () => {
    const consulta = TestBed.runInInjectionContext(() => new ConsultaInventario<number>());

    consulta.cargar(throwError(() => ({ error: { message: 'Sin conexión' } })));

    expect(consulta.error()).toBe('Sin conexión');
    expect(consulta.cargando()).toBe(false);
    consulta.cargar(of([]));

    expect(consulta.error()).toBe('');
    expect(consulta.filas()).toEqual([]);
  });

  it('libera lecturas al destruir el ámbito de inyección', () => {
    const cancelada = vi.fn();
    const consulta = TestBed.runInInjectionContext(() => new ConsultaInventario<number>());

    consulta.cargar(new Subject<number[]>().pipe(finalize(cancelada)));
    TestBed.resetTestingModule();

    expect(cancelada).toHaveBeenCalledOnce();
  });
});
