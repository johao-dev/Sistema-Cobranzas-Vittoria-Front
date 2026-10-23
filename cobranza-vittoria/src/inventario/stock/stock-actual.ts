import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { RegistroInventario } from '../registro-inventario';
import { KardexStockActualResponseDto } from '../contratos-inventario';
import { FiltrosStockProyecto } from './contratos-stock-proyecto';
import { ConsultaInventario } from '../consulta-inventario/consulta-inventario';
import { ReferenciasInventario } from '../referencias-inventario/referencias-inventario';
import { FiltrosInventario } from '../filtros-inventario/filtros-inventario';
import { ExportacionStock } from './exportacion-stock';
import { DistribucionMaterial } from './distribucion-material/distribucion-material';
import {
  coincideBusquedaInventario,
  fechaInventario,
  cantidadInventario,
} from '../presentacion-inventario/datos-presentacion-inventario';

interface FilaStock extends Omit<
  KardexStockActualResponseDto,
  'idKardexStock' | 'fechaUltimaMovimiento' | 'totalEntrada' | 'totalSalida'
> {
  idRegistro: number;
  fechaMovimiento: string;
  proyecto: string | null;
  totalEntrada: number | null;
  totalSalida: number | null;
}

@Component({
  selector: 'inventario-stock-actual',
  imports: [FormsModule, FiltrosInventario, DistribucionMaterial],
  providers: [ReferenciasInventario, ExportacionStock],
  templateUrl: './stock-actual.html',
  styleUrls: ['../presentacion-inventario/presentacion-inventario.css', './stock-actual.css'],
})
export class StockActual implements OnInit {
  private readonly registro = inject(RegistroInventario);
  protected readonly referencias = inject(ReferenciasInventario);
  protected readonly exportacion = inject(ExportacionStock);

  protected readonly consulta = new ConsultaInventario<FilaStock>();

  protected readonly filtros = signal<FiltrosStockProyecto>({});
  protected readonly porProyecto = signal(false);
  protected readonly busqueda = signal('');
  protected readonly incluirTotales = signal(false);
  protected readonly idDistribucion = signal<number | null>(null);

  protected readonly fecha = fechaInventario;
  protected readonly cantidad = cantidadInventario;

  protected readonly filtradas = computed(() =>
    this.consulta
      .filas()
      .filter((row) =>
        coincideBusquedaInventario(this.busqueda(), [
          row.idRegistro,
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
    const filtros = this.filtros();

    this.porProyecto.set(!!filtros.idProyecto);
    this.idDistribucion.set(null);
    this.consulta.filas.set([]);

    const consulta = filtros.idProyecto
      ? this.registro.listarStockProyecto(filtros).pipe(
          map((filas): FilaStock[] =>
            filas.map((fila) => ({
              ...fila,
              idRegistro: fila.idStockProyecto,
              fechaMovimiento: fila.fechaUltimoMovimiento,
              totalEntrada: null,
              totalSalida: null,
            })),
          ),
        )
      : this.registro.listarStockActual(filtros).pipe(
          map((filas): FilaStock[] =>
            filas.map((fila) => ({
              ...fila,
              idRegistro: fila.idKardexStock,
              fechaMovimiento: fila.fechaUltimaMovimiento,
              proyecto: null,
            })),
          ),
        );

    this.consulta.cargar(consulta);
  }

  protected filtrar(filtros: FiltrosStockProyecto): void {
    this.filtros.set(filtros);
    this.cargar();
  }

  protected alternarDistribucion(idMaterial: number): void {
    this.idDistribucion.update((actual) => (actual === idMaterial ? null : idMaterial));
  }
}
