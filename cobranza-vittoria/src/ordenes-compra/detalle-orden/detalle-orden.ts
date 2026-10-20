import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import {
  SolicitudCambioEstadoOrden,
  DetalleOrdenCompra,
  EstadoOrdenDestino,
} from '../contratos-ordenes-compra';
import {
  accionesEstado,
  ETIQUETA_ESTADO,
  filtrarItemsOrden,
  proveedoresOrden,
  textoTotalOrden,
} from '../datos-orden';
import { exportarOrden, FormatoOrden } from '../documentos-orden/exportar-orden';

@Component({
  selector: 'detalle-orden',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './detalle-orden.html',
  styleUrl: '../presentacion-ordenes.css',
})
export class DetalleOrden {
  readonly detalle = input.required<DetalleOrdenCompra>();
  readonly cerrar = output<void>();
  readonly cambiarEstado = output<SolicitudCambioEstadoOrden>();

  protected readonly filtro = signal('TODOS');
  protected readonly proveedores = computed(() => proveedoresOrden(this.detalle()));
  protected readonly items = computed(() => filtrarItemsOrden(this.detalle(), this.filtro()));
  protected readonly mensaje = signal('');
  protected readonly acciones = accionesEstado;
  protected readonly etiquetas = ETIQUETA_ESTADO;
  protected readonly textoTotal = textoTotalOrden;

  protected solicitarEstado(destino: EstadoOrdenDestino): void {
    const orden = this.detalle().ordenCompra;

    if (!accionesEstado(orden).includes(destino)) return;

    this.cambiarEstado.emit({ orden, destino });
  }

  protected exportar(formato: FormatoOrden): void {
    const proveedor = this.filtro() === 'TODOS' ? null : this.filtro();
    const exportado = exportarOrden(this.detalle(), formato, this.items(), proveedor);

    this.mensaje.set(exportado ? '' : 'Permite abrir ventanas emergentes para imprimir la O.C.');
  }
}
