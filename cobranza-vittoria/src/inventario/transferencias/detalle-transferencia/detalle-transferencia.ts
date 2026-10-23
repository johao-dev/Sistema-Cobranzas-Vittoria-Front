import { Component, input, output } from '@angular/core';

import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';
import { TransferenciaProyecto } from '../contratos-transferencias-proyecto';
import {
  cantidadInventario,
  fechaInventario,
} from '../../presentacion-inventario/datos-presentacion-inventario';

@Component({
  selector: 'inventario-detalle-transferencia',
  imports: [DialogoModal],
  templateUrl: './detalle-transferencia.html',
  styleUrls: [
    '../../presentacion-inventario/presentacion-inventario.css',
    '../transferencias-proyecto.css',
  ],
})
export class DetalleTransferencia {
  readonly filas = input.required<readonly TransferenciaProyecto[]>();
  readonly cerrar = output<void>();

  protected readonly cantidad = cantidadInventario;
  protected readonly fecha = fechaInventario;
}
