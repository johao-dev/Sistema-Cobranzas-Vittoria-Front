import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RegistroTransferenciasProyecto } from '../registro-transferencias-proyecto';
import {
  FiltrosTransferenciasProyecto,
  TransferenciaProyecto,
} from '../contratos-transferencias-proyecto';
import { ReferenciasInventario } from '../../referencias-inventario/referencias-inventario';
import { ConsultaInventario } from '../../consulta-inventario/consulta-inventario';
import { FormularioTransferencia } from '../formulario-transferencia/formulario-transferencia';
import { DetalleTransferencia } from '../detalle-transferencia/detalle-transferencia';
import { NotificationService } from '../../../app/core/services/notification.service';
import {
  fechaInventario,
  cantidadInventario,
} from '../../presentacion-inventario/datos-presentacion-inventario';

@Component({
  selector: 'inventario-lista-transferencias',
  imports: [FormsModule, FormularioTransferencia, DetalleTransferencia],
  providers: [ReferenciasInventario],
  templateUrl: './lista-transferencias.html',
  styleUrls: [
    '../../presentacion-inventario/presentacion-inventario.css',
    '../transferencias-proyecto.css',
  ],
})
export class ListaTransferencias implements OnInit {
  private readonly registro = inject(RegistroTransferenciasProyecto);
  private readonly notificaciones = inject(NotificationService);
  protected readonly referencias = inject(ReferenciasInventario);

  protected readonly consulta = new ConsultaInventario<TransferenciaProyecto>();
  protected readonly detalle = new ConsultaInventario<TransferenciaProyecto>();
  protected readonly filtros = signal<FiltrosTransferenciasProyecto>({});
  protected readonly aplicados = signal<FiltrosTransferenciasProyecto>({});
  protected readonly errorFiltros = signal('');
  protected readonly creando = signal(false);
  protected readonly idDetalle = signal<number | null>(null);

  protected readonly fecha = fechaInventario;
  protected readonly cantidad = cantidadInventario;

  ngOnInit(): void {
    this.referencias.cargar('transferencia');
    this.cargar();
  }

  protected actualizar<K extends keyof FiltrosTransferenciasProyecto>(
    campo: K,
    valor: FiltrosTransferenciasProyecto[K],
  ): void {
    this.filtros.update((filtros) => ({ ...filtros, [campo]: valor }));
  }

  protected filtrar(): void {
    const filtros = this.filtros();

    if (
      filtros.idTransferencia != null &&
      (!Number.isInteger(filtros.idTransferencia) || filtros.idTransferencia <= 0)
    ) {
      this.errorFiltros.set('El ID de transferencia debe ser un entero mayor a 0.');
      return;
    }
    if (filtros.fechaDesde && filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta) {
      this.errorFiltros.set('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.errorFiltros.set('');
    this.aplicados.set({ ...filtros });
    this.cargar();
  }

  protected limpiar(): void {
    this.filtros.set({});
    this.filtrar();
  }

  protected cargar(): void {
    this.consulta.cargar(this.registro.listar(this.aplicados()));
  }

  protected verDetalle(id: number): void {
    this.idDetalle.set(id);
    this.detalle.filas.set([]);
    this.detalle.cargar(this.registro.obtener(id));
  }

  protected reintentarDetalle(): void {
    const id = this.idDetalle();

    if (id !== null) this.verDetalle(id);
  }

  protected registrada(): void {
    this.creando.set(false);
    this.notificaciones.show('Transferencia registrada correctamente.', 'success');
    this.cargar();
  }
}
