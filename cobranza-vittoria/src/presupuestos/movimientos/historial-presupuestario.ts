import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Observable, Subscription, finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { MovimientoPresupuestario } from '../contratos-presupuestos';
import { ConsultasPresupuestarias } from '../consultas/consultas-presupuestarias';
import { MovimientoConsolidado } from '../consultas/contratos-consultas-presupuestarias';
import { mensajeErrorConsultaPresupuestaria } from '../consultas/mensajes-consultas-presupuestarias';

type IdentificacionPartida = {
  idPresupuesto: number;
  codigo: string | null;
  nombre: string | null;
};

export type ContextoMovimientos = IdentificacionPartida &
  (
    | { modo: 'individual'; idVersion: number; idDetalle: number }
    | { modo: 'consolidado'; idCatalogoPartida: number }
  );

function esConsolidado(movimiento: MovimientoPresupuestario): movimiento is MovimientoConsolidado {
  return 'efectoComprometido' in movimiento && 'efectoEjecutado' in movimiento;
}

@Component({
  selector: 'historial-presupuestario',
  imports: [CommonModule, DialogoModal],
  templateUrl: './historial-presupuestario.html',
  styleUrls: ['../dialogos-presupuesto.css'],
})
export class HistorialPresupuestario {
  private readonly registro = inject(RegistroPresupuestos);
  private readonly consultas = inject(ConsultasPresupuestarias);
  private readonly recarga = signal(0);
  private consulta?: Subscription;
  readonly contexto = input.required<ContextoMovimientos>();
  readonly cerrar = output<void>();
  protected readonly movimientos = signal<MovimientoPresupuestario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly consolidado = computed(() => this.contexto().modo === 'consolidado');
  protected readonly totales = computed(() =>
    this.movimientos()
      .filter(esConsolidado)
      .reduce(
        (total, movimiento) => ({
          comprometido: total.comprometido + movimiento.efectoComprometido,
          ejecutado: total.ejecutado + movimiento.efectoEjecutado,
        }),
        { comprometido: 0, ejecutado: 0 },
      ),
  );

  constructor() {
    effect((onCleanup) => {
      const contexto = this.contexto();
      this.recarga();
      this.cargar(contexto);
      onCleanup(() => this.consulta?.unsubscribe());
    });
  }

  protected reintentar(): void {
    this.recarga.update((valor) => valor + 1);
  }

  protected solicitarCierre(): void {
    this.consulta?.unsubscribe();
    this.movimientos.set([]);
    this.cerrar.emit();
  }

  protected efectoComprometido(movimiento: MovimientoPresupuestario): number {
    return esConsolidado(movimiento) ? movimiento.efectoComprometido : 0;
  }

  protected efectoEjecutado(movimiento: MovimientoPresupuestario): number {
    return esConsolidado(movimiento) ? movimiento.efectoEjecutado : 0;
  }

  private cargar(contexto: ContextoMovimientos): void {
    this.movimientos.set([]);
    this.cargando.set(true);
    this.error.set('');

    const peticion: Observable<MovimientoPresupuestario[]> =
      contexto.modo === 'consolidado'
        ? this.consultas.movimientosConsolidados(contexto.idPresupuesto, contexto.idCatalogoPartida)
        : this.registro.movimientos(contexto.idPresupuesto, contexto.idVersion, contexto.idDetalle);

    this.consulta = peticion.pipe(finalize(() => this.cargando.set(false))).subscribe({
      // El backend entrega el orden cronológico, con desempate por ID.
      next: (rows) => this.movimientos.set(rows),
      error: (error: unknown) =>
        this.error.set(
          mensajeErrorConsultaPresupuestaria(error, 'No se pudo cargar el historial.'),
        ),
    });
  }
}
