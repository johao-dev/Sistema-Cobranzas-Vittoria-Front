import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { ConsultaInventario } from '../consulta-inventario/consulta-inventario';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { RegistroKardexCompras } from './registro-kardex-compras';
import { MovimientoCompra, FiltrosMovimientosCompra } from './contratos-kardex-compras';
import {
  presentarMovimientosCompra,
  comprasParaSalida,
  faltanteCompra,
  esNuevoGrupoCompra,
} from './datos-kardex-compras';
import { cantidadInventario } from '../presentacion-inventario/datos-presentacion-inventario';
import { SalidaDesdeCompra } from './salida-desde-compra';
import { exportarKardexCompras } from './exportar-kardex-compras';

@Component({
  selector: 'inventario-kardex-compras',
  imports: [FormsModule, DatePipe, SalidaDesdeCompra],
  providers: [ReferenciasInventario],
  templateUrl: './kardex-compras.html',
  styleUrl: './kardex-compras.css',
})
export class KardexCompras implements OnInit {
  private readonly registro = inject(RegistroKardexCompras);

  private readonly tabla = viewChild<ElementRef<HTMLTableElement>>('tablaExportar');

  protected readonly referencias = inject(ReferenciasInventario);

  protected readonly consulta = new ConsultaInventario<MovimientoCompra>();

  protected readonly filtros = signal<FiltrosMovimientosCompra>({
    idCompra: null,
    idMaterial: null,
    idEspecialidad: null,
    fechaDesde: '',
    fechaHasta: '',
  });
  protected readonly msg = signal('');

  protected readonly filas = computed(() => presentarMovimientosCompra(this.consulta.filas()));
  protected readonly compras = computed(() => comprasParaSalida(this.filas()));

  protected readonly cantidad = cantidadInventario;
  protected readonly faltante = faltanteCompra;
  protected readonly nuevoGrupo = esNuevoGrupoCompra;

  ngOnInit(): void {
    this.referencias.cargar('compras');
    this.cargar();
  }

  protected actualizarFiltro<K extends keyof FiltrosMovimientosCompra>(
    campo: K,
    valor: FiltrosMovimientosCompra[K],
  ): void {
    this.filtros.update((filtros) => ({ ...filtros, [campo]: valor }));
  }

  protected cargar(): void {
    const filtros = this.filtros();
    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      this.msg.set('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.consulta.cargar(this.registro.movimientos(filtros));
  }

  protected registrada(mensaje: string): void {
    this.msg.set(mensaje);
    this.cargar();
  }

  protected exportar(formato: 'excel' | 'pdf'): void {
    const tabla = this.tabla()?.nativeElement;
    if (tabla) exportarKardexCompras(tabla, formato);
  }
}
