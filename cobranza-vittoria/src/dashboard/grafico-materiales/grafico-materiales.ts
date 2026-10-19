import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FilaGrafico, MetricaMaterial } from '../contratos-dashboard';
import { formatearImporte } from '../indicadores/calculos-dashboard';

@Component({
  selector: 'grafico-materiales',
  imports: [DecimalPipe],
  templateUrl: './grafico-materiales.html',
  styleUrl: './grafico-materiales.css',
})
export class GraficoMateriales {
  readonly titulo = input.required<string>();
  readonly filas = input.required<readonly FilaGrafico[]>();
  readonly metrica = input.required<MetricaMaterial>();
  protected readonly formatearImporte = formatearImporte;
}
