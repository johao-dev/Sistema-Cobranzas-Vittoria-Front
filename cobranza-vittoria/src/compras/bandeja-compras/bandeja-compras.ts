import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { finalize, Subject, switchMap, catchError, of } from 'rxjs';
import { RegistroCompras } from '../registro-compras';
import { CompraFilaSql, CompraPendienteOcFilaSql } from '../contratos-compras';
import { FormularioCompra } from '../formulario-compra/formulario-compra';
import { DetalleCompra } from '../detalle-compra/detalle-compra';
import { AceptacionCompra, esCompraAceptable } from '../aceptacion-compra/aceptacion-compra';
import { siguienteNumeroCompra } from '../formulario-compra/datos-compra';
import { exportarComprasExcel, exportarComprasPdf } from '../documentos-compras/exportar-compras';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
@Component({
  selector: 'compras-bandeja',
  imports: [CommonModule, FormularioCompra, DetalleCompra, AceptacionCompra],
  templateUrl: './bandeja-compras.html',
  styleUrls: ['../presentacion-compras.css', './bandeja-compras.css'],
})
export class BandejaCompras implements OnInit {
  private readonly registro = inject(RegistroCompras);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargar = new Subject<void>();
  protected readonly pendientes = signal<CompraPendienteOcFilaSql[]>([]);
  protected readonly cerradas = signal<CompraFilaSql[]>([]);
  protected readonly cargandoPendientes = signal(false);
  protected readonly cargandoCompras = signal(false);
  protected readonly errorPendientes = signal('');
  protected readonly errorCompras = signal('');
  protected readonly msg = signal('');
  protected readonly ordenSeleccionada = signal<number | null>(null);
  protected readonly compraSeleccionada = signal<number | null>(null);
  protected readonly porAceptar = signal<CompraFilaSql | null>(null);
  protected readonly esAceptable = esCompraAceptable;
  protected readonly numeroSiguiente = siguienteNumeroCompra;
  ngOnInit(): void {
    this.recargar
      .pipe(
        switchMap(() => {
          this.cargandoPendientes.set(true);
          this.errorPendientes.set('');
          return this.registro.pendientesCompra().pipe(
            catchError((error: unknown) => {
              this.errorPendientes.set(
                extraerMensajeError(error, 'No se pudieron cargar las O.C. pendientes.'),
              );
              return of([]);
            }),
            finalize(() => this.cargandoPendientes.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.pendientes.set(rows));
    this.recargar
      .pipe(
        switchMap(() => {
          this.cargandoCompras.set(true);
          this.errorCompras.set('');
          return this.registro.compras().pipe(
            catchError((error: unknown) => {
              this.errorCompras.set(
                extraerMensajeError(error, 'No se pudieron cargar las compras.'),
              );
              return of([]);
            }),
            finalize(() => this.cargandoCompras.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.cerradas.set(rows));
    this.cargar();
  }

  protected cargar(): void {
    this.recargar.next();
  }

  protected accionPendiente(event: Event, row: CompraPendienteOcFilaSql): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const accion = event.target.value;
    event.target.value = '';
    if (accion === 'procesar') this.procesar(row);
  }

  protected procesar(row: CompraPendienteOcFilaSql): void {
    this.msg.set('');
    this.ordenSeleccionada.set(row.IdOrdenCompra);
  }

  protected registrada(mensaje: string): void {
    this.ordenSeleccionada.set(null);
    this.msg.set(mensaje);
    this.cargar();
  }

  protected aceptada(): void {
    this.porAceptar.set(null);
    this.cargar();
  }

  protected exportar(formato: 'excel' | 'pdf'): void {
    if (!this.cerradas().length) {
      this.msg.set('No hay compras cerradas para exportar.');
      return;
    }
    if (formato === 'excel') exportarComprasExcel(this.cerradas());
    else exportarComprasPdf(this.cerradas());
  }
}
