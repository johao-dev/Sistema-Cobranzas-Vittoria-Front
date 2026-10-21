import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RegistroInventario } from '../registro-inventario';
import { KardexStockActualResponseDto, KardexStockFiltroDto } from '../contratos-inventario';
import { ConsultaInventario } from '../consulta-inventario/consulta-inventario';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { FiltrosInventario } from '../filtros-inventario/filtros-inventario';
import { ExportacionStock } from './exportacion-stock';
import {
  coincideBusquedaInventario,
  fechaInventario,
  cantidadInventario,
} from '../presentacion-inventario/datos-presentacion-inventario';

@Component({
  selector: 'inventario-stock-actual',
  imports: [FormsModule, FiltrosInventario],
  providers: [ReferenciasInventario, ExportacionStock],
  templateUrl: './stock-actual.html',
  styleUrls: ['../presentacion-inventario/presentacion-inventario.css', './stock-actual.css'],
})
export class StockActual implements OnInit {
  private readonly registro = inject(RegistroInventario);
  protected readonly referencias = inject(ReferenciasInventario);
  protected readonly exportacion = inject(ExportacionStock);

  protected readonly consulta = new ConsultaInventario<KardexStockActualResponseDto>();

  protected readonly filtros = signal<KardexStockFiltroDto>({});
  protected readonly busqueda = signal('');
  protected readonly incluirTotales = signal(false);

  protected readonly fecha = fechaInventario;
  protected readonly cantidad = cantidadInventario;

  protected readonly filtradas = computed(() =>
    this.consulta
      .filas()
      .filter((row) =>
        coincideBusquedaInventario(this.busqueda(), [
          row.idKardexStock,
          row.codigoMaterial,
          row.nombre,
        ]),
      ),
  );

  ngOnInit(): void {
    this.referencias.cargar('stock');
    this.cargar();
  }

  protected cargar(): void {
    this.consulta.cargar(this.registro.listarStockActual(this.filtros()));
  }

  protected filtrar(filtros: KardexStockFiltroDto): void {
    this.filtros.set(filtros);
    this.cargar();
  }
}
