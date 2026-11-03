import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { ModalImportacion } from '../../shared/importacion/modal-importacion/modal-importacion';
import { AccionGasto, GastoDirectoListado, MonedaColumnaGasto } from '../contratos-gastos-directos';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { ReferenciasGastos } from '../referencias-gastos';
import { ConsultaGastos } from '../consulta-gastos';
import { esGastoHistorico, montoEnGasto, normalizarBusquedaGasto } from '../presentacion-gastos';
import { FormularioGasto } from '../formulario/formulario-gasto';
import { DocumentosGasto } from '../documentos/documentos-gasto';
import { TransicionGasto } from '../transiciones/transicion-gasto';

@Component({
  selector: 'gastos-seccion',
  imports: [
    CommonModule,
    FormsModule,
    ModalImportacion,
    FormularioGasto,
    DocumentosGasto,
    TransicionGasto,
  ],
  providers: [ReferenciasGastos],
  templateUrl: './gastos-seccion.html',
  styleUrl: '../gastos-directos.css',
})
export class GastosSeccion implements OnInit {
  private readonly registro = inject(RegistroGastosDirectos);
  private readonly sesion = inject(SesionUsuario);

  protected readonly referencias = inject(ReferenciasGastos);

  protected readonly consulta = new ConsultaGastos<GastoDirectoListado>(
    'No se pudieron cargar los gastos.',
  );
  protected readonly filtroCategoria = signal('');
  protected readonly filtroEstado = signal('');
  protected readonly filtroCentroCosto = signal('');
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');
  protected readonly filtroBusqueda = signal('');
  protected readonly errorFiltro = signal('');
  protected readonly importOpen = signal(false);
  protected readonly modalGasto = signal(false);
  protected readonly edicion = signal<GastoDirectoListado | null>(null);
  protected readonly gastoDocumentos = signal<GastoDirectoListado | null>(null);
  protected readonly modalConfirmacion = signal<{
    accion: AccionGasto;
    row: GastoDirectoListado;
  } | null>(null);
  protected readonly monedasColumna: MonedaColumnaGasto[] = ['PEN', 'USD'];
  protected readonly montoEn = montoEnGasto;
  protected readonly esHistorico = esGastoHistorico;

  protected readonly rowsFiltradas = computed(() => {
    const termino = normalizarBusquedaGasto(this.filtroBusqueda());
    return this.consulta
      .filas()
      .filter((row) =>
        normalizarBusquedaGasto(
          [
            row.concepto,
            row.nombreCategoriaGasto,
            row.proveedor,
            row.codigoPartida,
            row.partida,
            row.centroCosto,
            row.codigoPresupuesto,
          ].join(' '),
        ).includes(termino),
      );
  });
  protected readonly vigentes = computed(() =>
    this.rowsFiltradas().filter((row) => row.estado !== 'ANULADO'),
  );
  protected readonly totalesPorMoneda = computed(() => {
    const totales = new Map<string, number>();
    for (const row of this.vigentes())
      totales.set(row.moneda, (totales.get(row.moneda) ?? 0) + row.monto);
    return Array.from(totales, ([moneda, total]) => ({ moneda, total }));
  });
  protected readonly hayMoneda = computed(() => ({
    pen: this.vigentes().some((row) => row.moneda === 'PEN'),
    usd: this.vigentes().some((row) => row.moneda === 'USD'),
  }));

  ngOnInit(): void {
    this.referencias.cargar();
    this.load();
  }

  protected get puedeOperar(): boolean {
    return this.sesion.hasPermission('gasto_directo.operar');
  }

  protected totalColumna(moneda: MonedaColumnaGasto): number {
    return this.vigentes()
      .filter((row) => row.moneda === moneda)
      .reduce((total, row) => total + row.monto, 0);
  }

  protected load(): void {
    if (this.filtroDesde() && this.filtroHasta() && this.filtroDesde() > this.filtroHasta()) {
      this.errorFiltro.set('La fecha desde no puede ser posterior a la fecha hasta.');
      this.consulta.cargar(of([]));
      return;
    }
    this.errorFiltro.set('');
    this.consulta.cargar(
      this.registro.listar({
        ...(this.filtroCategoria() === ''
          ? {}
          : { idCategoriaGasto: [Number(this.filtroCategoria())] }),
        estado: this.filtroEstado() || null,
        idCentroCosto: this.filtroCentroCosto() === '' ? null : Number(this.filtroCentroCosto()),
        desde: this.filtroDesde() || null,
        hasta: this.filtroHasta() || null,
      }),
    );
  }

  protected reintentarReferencias(): void {
    this.referencias.cargar();
  }

  protected abrirImportModal(): void {
    if (this.puedeOperar) this.importOpen.set(true);
  }

  protected abrirModalNuevo(): void {
    if (!this.puedeOperar || !this.referencias.listas()) return;
    this.edicion.set(null);
    this.modalGasto.set(true);
  }

  protected editar(row: GastoDirectoListado): void {
    if (!this.puedeOperar || !this.referencias.listas() || row.estado !== 'REGISTRADO') return;
    this.edicion.set(row);
    this.modalGasto.set(true);
  }

  protected onAccion(event: Event, row: GastoDirectoListado): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const accion = select.value;
    select.value = '';
    if (accion === 'documentos') {
      this.gastoDocumentos.set(row);
      return;
    }
    if (!this.puedeOperar) return;
    if (accion === 'edit') this.editar(row);
    if (accion === 'confirmar' && row.estado === 'REGISTRADO' && !esGastoHistorico(row))
      this.modalConfirmacion.set({ accion, row });
    if (accion === 'anular' && row.estado !== 'ANULADO')
      this.modalConfirmacion.set({ accion, row });
  }

  protected guardado(): void {
    this.modalGasto.set(false);
    this.load();
  }
}
