import { Component, OnInit, inject, input } from '@angular/core';

import { RegistroInventario } from '../../registro-inventario';
import { ConsultaInventario } from '../../consulta-inventario/consulta-inventario';
import { StockProyecto } from '../contratos-stock-proyecto';
import {
  cantidadInventario,
  fechaInventario,
} from '../../presentacion-inventario/datos-presentacion-inventario';

@Component({
  selector: 'inventario-distribucion-material',
  templateUrl: './distribucion-material.html',
  styleUrls: [
    '../../presentacion-inventario/presentacion-inventario.css',
    './distribucion-material.css',
  ],
})
export class DistribucionMaterial implements OnInit {
  private readonly registro = inject(RegistroInventario);

  readonly idMaterial = input.required<number>();

  protected readonly consulta = new ConsultaInventario<StockProyecto>();

  protected readonly cantidad = cantidadInventario;
  protected readonly fecha = fechaInventario;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    // La expansión consulta la distribución actual completa del material, sin filtros del listado.
    this.consulta.cargar(this.registro.listarStockProyecto({ idMaterial: this.idMaterial() }));
  }
}
