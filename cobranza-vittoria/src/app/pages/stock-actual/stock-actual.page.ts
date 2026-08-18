import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { KardexInventarioService } from '../../core/services/kardex-inventario.service';
import { KardexStockFiltroDto } from '../../models/kardex-inventario.models';
import { extraerMensajeError } from '../../core/utils/api-error.util';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-stock-actual-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-actual.page.html',
  styleUrl: './stock-actual.page.css'
})
export class StockActualPage implements OnInit {
  rows: any[] = [];
  filtroBusqueda = '';

  filtros = {
    idEspecialidad: null as number | null,
    idProyecto: null as number | null,
    fechaDesde: '',
    fechaHasta: ''
  };

  especialidades: any[] = [];
  proyectos: any[] = [];

  private normalizarBusqueda(valor: any): string {
    return (valor ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizarBusqueda(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];

    return (this.rows ?? []).filter(row => {
      const id = this.read(row, ['idKardexStock', 'IdKardexStock', 'idStock', 'IdStock', 'id', 'Id']);
      const codigo = this.read(row, ['codigoMaterial', 'CodigoMaterial', 'codigo', 'Codigo']) ?? '';
      const nombre = this.read(row, ['nombre', 'Nombre']) ?? '';
      const proyecto = this.read(row, ['proyecto', 'Proyecto']) ?? '';
      const texto = `${id ?? ''} ${codigo} ${nombre} ${proyecto}`;
      return this.normalizarBusqueda(texto).includes(termino);
    });
  }

  constructor(
    private maestra: MaestraService,
    private kardex: KardexInventarioService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.maestra.especialidades(true).subscribe({
      next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.especialidades = []; this.cdr.detectChanges(); }
    });

    this.maestra.proyectos(true).subscribe({
      next: (x: any) => { this.proyectos = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });

    this.load();
  }

  load() {
    const filtros: KardexStockFiltroDto = {
      idEspecialidad: this.filtros.idEspecialidad,
      idProyecto: this.filtros.idProyecto,
      fechaDesde: this.filtros.fechaDesde || null,
      fechaHasta: this.filtros.fechaHasta || null
    };
    this.kardex.listarStockActual(filtros).subscribe({
      next: (x) => {
        this.rows = (x || []).map((row) => this.normalizarStock(row));
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.rows = [];
        this.notifyService.show(extraerMensajeError(e, 'No se pudo cargar el stock actual.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  limpiarFiltros() {
    this.filtros = {
      idEspecialidad: null,
      idProyecto: null,
      fechaDesde: '',
      fechaHasta: ''
    };
    this.load();
  }

  formatCantidad(value: any): string {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  getProyectoLabel(p: any): string {
    return this.read(p, ['nombre', 'Nombre', 'nombreProyecto', 'NombreProyecto']) ?? '';
  }

  private normalizarStock(row: any): any {
    if (!row) return null;

    return {
      idKardexStock: this.toNumberOrNull(this.read(row, ['idKardexStock', 'IdKardexStock', 'idStock', 'IdStock', 'id', 'Id'])),
      idMaterial: this.toNumberOrNull(this.read(row, ['idMaterial', 'IdMaterial'])),
      codigoMaterial: this.read(row, ['codigoMaterial', 'CodigoMaterial', 'codigo', 'Codigo']) ?? '',
      nombre: this.read(row, ['nombre', 'Nombre', 'material', 'Material']) ?? '',
      unidadMedida: this.read(row, ['unidadMedida', 'UnidadMedida', 'unidad', 'Unidad', 'abreviatura', 'Abreviatura']) ?? '',
      idEspecialidad: this.toNumberOrNull(this.read(row, ['idEspecialidad', 'IdEspecialidad'])),
      especialidad: this.read(row, ['especialidad', 'Especialidad', 'nombreEspecialidad', 'NombreEspecialidad']) ?? '',
      idProyecto: this.toNumberOrNull(this.read(row, ['idProyecto', 'IdProyecto'])),
      proyecto: this.read(row, ['proyecto', 'Proyecto', 'nombreProyecto', 'NombreProyecto']) ?? '',
      totalEntrada: this.toNumberOrDefault(this.read(row, ['totalEntrada', 'TotalEntrada', 'entrada', 'Entrada']), 0),
      totalSalida: this.toNumberOrDefault(this.read(row, ['totalSalida', 'TotalSalida', 'salida', 'Salida']), 0),
      stock: this.toNumberOrDefault(this.read(row, ['stock', 'Stock', 'stockActual', 'StockActual', 'disponible', 'Disponible']), 0),
      fechaUltimaMovimiento: this.read(row, ['fechaUltimaMovimiento', 'FechaUltimaMovimiento']) ?? ''
    };
  }

  private read(obj: any, keys: string[]): any {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    const lowerMap = Object.keys(obj).reduce((acc: any, key: string) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
    for (const key of keys) {
      const value = lowerMap[key.toLowerCase()];
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  private toNumberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toNumberOrDefault(value: any, fallback: number): number {
    const n = this.toNumberOrNull(value);
    return n === null ? fallback : n;
  }
}
