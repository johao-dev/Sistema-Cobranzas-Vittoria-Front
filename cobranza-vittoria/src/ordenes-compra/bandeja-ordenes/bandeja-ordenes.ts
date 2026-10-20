import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { normalizarNombreSolicitante } from '../../shared/presentacion/nombre-solicitante';
import { ConsultaOrdenes } from '../consulta-ordenes/consulta-ordenes';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { SolicitudCambioEstadoOrden, OrdenCompra } from '../contratos-ordenes-compra';
import {
  accionesEstado,
  ETIQUETA_ESTADO,
  estadoOrden,
  siguienteNumeroOrden,
  textoTotalOrden,
} from '../datos-orden';
import { FormularioOrden } from '../formulario-orden/formulario-orden';
import { DetalleOrden } from '../detalle-orden/detalle-orden';
import { CambioEstadoOrden } from '../cambio-estado-orden/cambio-estado-orden';
import { exportarOrden, FormatoOrden } from '../documentos-orden/exportar-orden';
import { mensajeOrden } from '../mensaje-orden';

@Component({
  selector: 'bandeja-ordenes',
  imports: [CommonModule, FormularioOrden, DetalleOrden, CambioEstadoOrden],
  providers: [ConsultaOrdenes],
  templateUrl: './bandeja-ordenes.html',
  styleUrl: '../presentacion-ordenes.css',
})
export class BandejaOrdenes {
  protected readonly consulta = inject(ConsultaOrdenes);
  private readonly registro = inject(RegistroOrdenesCompra);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cambio = signal<SolicitudCambioEstadoOrden | null>(null);
  protected readonly exportando = signal(false);
  protected readonly numeroSugerido = computed(() => siguienteNumeroOrden(this.consulta.ordenes()));
  protected readonly nombreSolicitante = normalizarNombreSolicitante;
  protected readonly textoTotal = textoTotalOrden;
  protected readonly estado = estadoOrden;
  protected readonly acciones = accionesEstado;
  protected readonly etiquetas = ETIQUETA_ESTADO;

  protected accionOrden(event: Event, orden: OrdenCompra): void {
    const control = event.target;

    if (!(control instanceof HTMLSelectElement)) return;

    const accion = control.value;

    control.value = '';

    if (accion === 'detalle') this.consulta.abrirOrden(orden.idOrdenCompra);

    if (accion === 'APROBADA' || accion === 'ANULADA' || accion === 'CERRADA')
      this.solicitarCambio({ orden, destino: accion });

    if (accion === 'pdf' || accion === 'excel') this.exportar(orden, accion);
  }

  protected solicitarCambio(cambio: SolicitudCambioEstadoOrden): void {
    if (!accionesEstado(cambio.orden).includes(cambio.destino)) return;

    this.cambio.set(cambio);
  }

  protected ordenCreada(): void {
    this.consulta.cerrar();
    this.consulta.mensaje.set('Orden creada correctamente.');
    this.consulta.recargar();
  }

  protected estadoCambiado(id: number): void {
    const seleccion = this.consulta.seleccion();

    this.cambio.set(null);

    if (seleccion?.tipo === 'orden' && seleccion.detalle.ordenCompra.idOrdenCompra === id)
      this.consulta.abrirOrden(id);

    this.consulta.recargar();
  }

  private exportar(orden: OrdenCompra, formato: FormatoOrden): void {
    if (this.exportando()) return;

    this.exportando.set(true);
    this.consulta.mensaje.set('');

    this.registro
      .obtener(orden.idOrdenCompra)
      .pipe(
        finalize(() => this.exportando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle) => {
          if (!exportarOrden(detalle, formato))
            this.consulta.mensaje.set('Permite abrir ventanas emergentes para imprimir la O.C.');
        },
        error: (error) =>
          this.consulta.mensaje.set(
            mensajeOrden(error, 'No se pudo cargar la O.C. para exportar.'),
          ),
      });
  }
}
