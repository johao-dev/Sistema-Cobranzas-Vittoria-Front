import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { RegistroKardexCompras } from './registro-kardex-compras';
import { CompraParaSalida, SalidaCompraRequest } from './contratos-kardex-compras';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { hoyInventario } from '../presentacion-inventario/datos-presentacion-inventario';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';

@Component({
  selector: 'inventario-salida-desde-compra',
  imports: [FormsModule],
  templateUrl: './salida-desde-compra.html',
  styleUrl: './kardex-compras.css',
})
export class SalidaDesdeCompra {
  private readonly registro = inject(RegistroKardexCompras);
  private readonly destroyRef = inject(DestroyRef);

  readonly compras = input.required<readonly CompraParaSalida[]>();
  readonly especialidades = input.required<readonly Especialidad[]>();

  readonly registrada = output<string>();

  protected readonly compraKey = signal('');
  protected readonly compra = signal<CompraParaSalida | null>(null);
  protected readonly idEspecialidad = signal<number | null>(null);
  protected readonly idMaterial = signal<number | null>(null);
  protected readonly fecha = signal(hoyInventario());
  protected readonly cantidad = signal<number | null>(1);
  protected readonly observacion = signal('');
  protected readonly guardando = signal(false);
  protected readonly msg = signal('');

  protected seleccionar(clave: string): void {
    this.compraKey.set(clave);

    const compra = this.compras().find((row) => row.compraKey === clave) ?? null;

    this.compra.set(compra);
    this.idMaterial.set(compra?.idMaterial ?? null);
    this.idEspecialidad.set(compra?.idEspecialidad ?? null);
    this.observacion.set(
      compra?.numeroRequerimiento && compra.numeroRequerimiento !== '-'
        ? `Ingresado por Requerimiento ${compra.numeroRequerimiento}`
        : '',
    );
  }

  protected guardar(): void {
    if (this.guardando()) return;

    const compra = this.compra();
    const cantidad = this.cantidad();
    if (
      !compra ||
      this.idMaterial() !== compra.idMaterial ||
      !this.idEspecialidad() ||
      !this.fecha() ||
      cantidad === null ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0
    ) {
      this.msg.set('Selecciona compra, especialidad, fecha y una cantidad de salida positiva.');
      return;
    }

    const dto: SalidaCompraRequest = {
      idCompra: compra.idCompra,
      idMaterial: compra.idMaterial,
      idEspecialidad: this.idEspecialidad(),
      fechaMovimiento: this.fecha(),
      cantidadSalida: cantidad,
      observacion: this.observacion().trim() || null,
    };

    this.guardando.set(true);
    this.msg.set('');

    this.registro
      .registrarSalida(dto)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.ok) {
            this.msg.set(res.mensaje || 'No se pudo registrar la salida.');
            return;
          }

          this.seleccionar('');
          this.fecha.set(hoyInventario());
          this.cantidad.set(1);
          this.registrada.emit(res.mensaje || 'Salida registrada correctamente.');
        },
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudo registrar la salida.')),
      });
  }
}
