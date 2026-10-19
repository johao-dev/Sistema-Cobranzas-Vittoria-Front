import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { CargarDashboard } from '../carga-dashboard/cargar-dashboard';
import {
  calcularTarjetas,
  construirFilas,
  formatearImporte,
} from '../indicadores/calculos-dashboard';
import { DatosDashboard, FilaGrafico } from '../contratos-dashboard';
import { GraficoMateriales } from '../grafico-materiales/grafico-materiales';

@Component({
  selector: 'resumen-compras',
  imports: [GraficoMateriales],
  templateUrl: './resumen-compras.html',
  styleUrl: './resumen-compras.css',
})
export class ResumenCompras implements OnInit {
  private readonly carga: CargarDashboard = inject(CargarDashboard);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly recargas: Subject<void> = new Subject<void>();

  protected readonly cargando: WritableSignal<boolean> = signal(true);
  protected readonly datos: WritableSignal<DatosDashboard> = signal({
    tarjetas: calcularTarjetas([], []),
    materiales: [],
    cargandoMateriales: false,
    errores: [],
  });
  protected readonly porCantidad: Signal<FilaGrafico[]> = computed(() =>
    construirFilas(this.datos().materiales, 'cantidad'),
  );
  protected readonly porMonto: Signal<FilaGrafico[]> = computed(() =>
    construirFilas(this.datos().materiales, 'monto'),
  );
  protected readonly porFrecuencia: Signal<FilaGrafico[]> = computed(() =>
    construirFilas(this.datos().materiales, 'frecuencia'),
  );
  protected readonly hayDatos: Signal<boolean> = computed(
    () =>
      this.datos().tarjetas.some((tarjeta) => tarjeta.value > 0) ||
      this.datos().materiales.some(
        (material) => material.cantidad > 0 || material.monto > 0 || material.frecuencia > 0,
      ),
  );
  protected readonly mensajeCarga: Signal<string> = computed(() =>
    this.hayDatos() ? 'Actualizando dashboard...' : 'Cargando dashboard...',
  );
  protected readonly formatearImporte = formatearImporte;

  ngOnInit(): void {
    this.recargas
      .pipe(
        startWith(undefined),
        tap(() => this.cargando.set(true)),
        switchMap(() =>
          this.carga.cargar().pipe(
            catchError(() =>
              of<DatosDashboard>({
                tarjetas: calcularTarjetas([], []),
                materiales: [],
                cargandoMateriales: false,
                errores: ['No se pudo cargar el dashboard. Intenta actualizarlo.'],
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos: DatosDashboard) => {
        this.datos.set(datos);
        this.cargando.set(false);
      });
  }

  protected actualizar(): void {
    this.recargas.next();
  }
}
