import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { MovimientoPresupuestario } from '../contratos-presupuestos';

export interface ContextoMovimientos {
  idPresupuesto: number;
  idVersion: number;
  idDetalle: number;
  codigo: string | null;
  nombre: string | null;
}

@Component({
  selector: 'historial-presupuestario',
  imports: [CommonModule, DialogoModal],
  templateUrl: './historial-presupuestario.html',
  styleUrls: ['../dialogos-presupuesto.css'],
})
export class HistorialPresupuestario implements OnInit {
  private readonly registro = inject(RegistroPresupuestos);
  private readonly destroyRef = inject(DestroyRef);
  readonly contexto = input.required<ContextoMovimientos>();
  readonly cerrar = output<void>();
  protected readonly movimientos = signal<MovimientoPresupuestario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  ngOnInit(): void {
    this.cargar();
  }
  protected cargar(): void {
    const contexto = this.contexto();
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.registro
      .movimientos(contexto.idPresupuesto, contexto.idVersion, contexto.idDetalle)
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rows) => this.movimientos.set(rows),
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo cargar el historial.')),
      });
  }
}
