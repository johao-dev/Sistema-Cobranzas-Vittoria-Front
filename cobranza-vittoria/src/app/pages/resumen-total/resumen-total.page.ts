import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { ComprasService } from '../../core/services/compras.service';
import { GastosAdministrativosService } from '../../core/services/gastos-administrativos.service';
import { ValorizacionesService } from '../../core/services/valorizaciones.service';
import { MaestraService } from '../../core/services/maestra.service';
import { GastoProyectoService } from '../../core/services/gasto-proyecto.service';
import { CotizacionMaterialesService } from '../../core/services/cotizacion-materiales.service';

type CompraResumenRow = { especialidad: string; cotizacion: number; facturado: number; saldo: number; };
type ValResumenRow = { especialidad: string; cotizacion: number; garantia: number; transferido: number; facturado: number; saldo: number; };
type GastoResumenRow = { categoria: string; facturado: number; };

@Component({
  standalone: true,
  selector: 'app-resumen-total-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-total.page.html',
  styleUrl: './resumen-total.page.css'
})
export class ResumenTotalPage implements OnInit {
  loading = false;
  msg = '';

  proyectos: any[] = [];
  selectedProjectId: number | null = null;

  comprasRows: CompraResumenRow[] = [];
  valorizacionesRows: ValResumenRow[] = [];
  gastosRows: GastoResumenRow[] = [];

  cotizacionGeneral = 0;
  totalMateriales = 0; // total facturado/ejecutado de materiales
  totalValorizaciones = 0;
  totalGastos = 0;
  totalTerreno = 0;
  totalAlcabala = 0;
  totalMarketing = 0;
  totalOtrosGastos = 0;
  totalMunicipales = 0;
  totalCotizacionMateriales = 0; // suma de subcotizaciones por especialidad
  totalGeneral = 0;
  saldo = 0;

  private comprasSource: any[] = [];
  private valorizacionesSource: any[] = [];
  private gastosSource: any[] = [];

  constructor(
    private comprasService: ComprasService,
    private gastosService: GastosAdministrativosService,
    private valorizacionesService: ValorizacionesService,
    private maestraService: MaestraService,
    private gastoProyectoService: GastoProyectoService,
    private cotizacionMaterialesService: CotizacionMaterialesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.msg = '';

    forkJoin({
      compras: this.comprasService.compras(),
      gastos: this.gastosService.gastos(),
      valorizaciones: this.valorizacionesService.valorizaciones(),
      proyectos: this.maestraService.proyectos(true)
    }).subscribe({
      next: ({ compras, gastos, valorizaciones, proyectos }) => {
        this.comprasSource = Array.isArray(compras) ? compras : [];
        this.gastosSource = Array.isArray(gastos) ? gastos : [];
        this.valorizacionesSource = Array.isArray(valorizaciones) ? valorizaciones : [];
        this.proyectos = (Array.isArray(proyectos) ? proyectos : []).map((row: any) => ({
          ...row,
          cotizacionGeneral: this.toNumber(this.readValue(row, 'cotizacionGeneral', 'CotizacionGeneral')),
          nombreProyecto: String(this.readValue(row, 'nombreProyecto', 'NombreProyecto') || '')
        }));

        if (!this.selectedProjectId && this.proyectos.length) {
          this.selectedProjectId = Number(this.proyectos[0].idProyecto ?? this.proyectos[0].IdProyecto);
        }

        this.rebuildByProject();
      },
      error: (e) => {
        this.msg = e?.error?.message || 'No se pudo cargar el resumen total.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onProjectChange(): void {
    this.rebuildByProject();
  }

  formatMoney(value: any, currency: 'PEN' | 'USD' = 'PEN'): string {
    const number = Number(value || 0);
    return new Intl.NumberFormat('es-PE', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(number);
  }

  totalEjecutadoVsCotizacion(): number {
    if (this.cotizacionGeneral <= 0) return 0;
    return Math.min(100, this.round((this.totalGeneral / this.cotizacionGeneral) * 100));
  }

  proyectoSeleccionadoNombre(): string {
    const proyecto = this.proyectos.find((x: any) => Number(x.idProyecto ?? x.IdProyecto) === Number(this.selectedProjectId));
    return proyecto?.nombreProyecto || proyecto?.NombreProyecto || 'Sin proyecto';
  }

  private rebuildByProject(): void {
    const idProyecto = Number(this.selectedProjectId || 0);
    const nombreProyecto = this.proyectoSeleccionadoNombre();

    const proyecto = this.proyectos.find((x: any) => Number(x.idProyecto ?? x.IdProyecto) === idProyecto);
    this.cotizacionGeneral = this.toNumber(proyecto?.cotizacionGeneral ?? proyecto?.CotizacionGeneral);

    const comprasFiltradas = this.filterByProject(this.comprasSource, idProyecto, nombreProyecto);
    const valorizacionesFiltradas = this.filterByProject(this.valorizacionesSource, idProyecto, nombreProyecto);
    const gastosFiltrados = this.filterByProjectStrict(this.gastosSource, idProyecto, nombreProyecto);

    if (!idProyecto) {
      this.comprasRows = [];
      this.valorizacionesRows = [];
      this.gastosRows = [];
      this.totalMateriales = 0;
      this.totalCotizacionMateriales = 0;
      this.totalValorizaciones = 0;
      this.totalGastos = 0;
      this.totalTerreno = 0;
      this.totalAlcabala = 0;
      this.totalMarketing = 0;
      this.totalOtrosGastos = 0;
      this.totalMunicipales = 0;
      this.totalGeneral = 0;
      this.saldo = this.cotizacionGeneral;
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    forkJoin({
      resumenMateriales: this.cotizacionMaterialesService.getResumenByProyecto(idProyecto).pipe(catchError(() => of(null))),
      cotizacionMateriales: this.cotizacionMaterialesService.getByProyecto(idProyecto).pipe(catchError(() => of(null))),
      terreno: this.gastoProyectoService.listar('terreno', { idProyecto, estado: 'Activo' }).pipe(catchError(() => of([]))),
      marketing: this.gastoProyectoService.listar('marketing-publicidad', { idProyecto, estado: 'Activo' }).pipe(catchError(() => of([]))),
      otros: this.gastoProyectoService.listar('otros-gastos', { idProyecto, estado: 'Activo' }).pipe(catchError(() => of([]))),
      municipales: this.gastoProyectoService.listar('gastos-municipales-distritales', { idProyecto, estado: 'Activo' }).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ resumenMateriales, cotizacionMateriales, terreno, marketing, otros, municipales }) => {
        const resumenItems = Array.isArray(resumenMateriales?.items) ? resumenMateriales.items : [];
        const cotizaciones = Array.isArray(cotizacionMateriales?.items) ? cotizacionMateriales.items : [];

        if (resumenItems.length) {
          this.buildComprasFromResumen(resumenMateriales);
        } else {
          this.totalCotizacionMateriales = this.toNumber(cotizacionMateriales?.totalCotizacionMateriales ?? cotizacionMateriales?.TotalCotizacionMateriales);
          this.buildComprasFallback(comprasFiltradas, cotizaciones);
        }

        this.buildValorizaciones(valorizacionesFiltradas);
        this.buildGastos(gastosFiltrados);
        this.buildTerrenoTotals(Array.isArray(terreno) ? terreno : []);
        this.totalMarketing = this.sumGastoProyecto(Array.isArray(marketing) ? marketing : []);
        this.totalOtrosGastos = this.sumGastoProyecto(Array.isArray(otros) ? otros : []);
        this.totalMunicipales = this.sumGastoProyecto(Array.isArray(municipales) ? municipales : []);

        this.totalGeneral = this.round(
          this.totalMateriales +
          this.totalValorizaciones +
          this.totalGastos +
          this.totalTerreno +
          this.totalAlcabala +
          this.totalMarketing +
          this.totalOtrosGastos +
          this.totalMunicipales
        );
        this.saldo = this.round(this.cotizacionGeneral - this.totalGeneral);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buildComprasFallback(comprasFiltradas, []);
        this.buildValorizaciones(valorizacionesFiltradas);
        this.buildGastos(gastosFiltrados);
        this.totalTerreno = 0;
        this.totalAlcabala = 0;
        this.totalMarketing = 0;
        this.totalOtrosGastos = 0;
        this.totalMunicipales = 0;
        this.totalGeneral = this.round(this.totalMateriales + this.totalValorizaciones + this.totalGastos);
        this.saldo = this.round(this.cotizacionGeneral - this.totalGeneral);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildComprasFromResumen(resumen: any): void {
    const items = Array.isArray(resumen?.items) ? resumen.items : [];

    this.comprasRows = items.map((row: any) => {
      const cotizacion = this.toNumber(this.readValue(row, 'cotizacion', 'Cotizacion'));
      const facturado = this.toNumber(this.readValue(row, 'facturado', 'Facturado'));
      return {
        especialidad: String(this.readValue(row, 'especialidad', 'Especialidad') || 'Sin especialidad').trim(),
        cotizacion,
        facturado,
        saldo: this.round(cotizacion - facturado)
      };
    });

    this.totalCotizacionMateriales = this.toNumber(
      this.readValue(resumen, 'totalCotizacionMateriales', 'TotalCotizacionMateriales') ??
      this.comprasRows.reduce((a, x) => a + x.cotizacion, 0)
    );

    this.totalMateriales = this.toNumber(
      this.readValue(resumen, 'totalFacturado', 'TotalFacturado') ??
      this.comprasRows.reduce((a, x) => a + x.facturado, 0)
    );
  }

  private buildComprasFallback(rows: any[], cotizaciones: any[]): void {
    const result = new Map<string, CompraResumenRow>();
    const cotizacionItems = (cotizaciones || []).map((cot: any) => ({
      key: this.normalizeKey(String(this.readValue(cot, 'especialidad', 'Especialidad') || 'Sin especialidad').trim()),
      especialidad: String(this.readValue(cot, 'especialidad', 'Especialidad') || 'Sin especialidad').trim(),
      cotizacion: this.toNumber(this.readValue(cot, 'cotizacion', 'Cotizacion'))
    }));
    const usedCotizaciones = new Set<string>();

    for (const row of rows) {
      const rawEspecialidad = String(this.readValue(row, 'especialidad', 'Especialidad', 'nombreEspecialidad', 'NombreEspecialidad') || 'Sin especialidad').trim();
      const facturado = this.toNumber(this.readValue(row, 'montoTotal', 'MontoTotal', 'facturado', 'Facturado', 'total', 'Total'));
      const resultKey = this.normalizeKey(rawEspecialidad);
      const matches = this.findCotizacionMatches(cotizacionItems, rawEspecialidad)
        .filter(match => !usedCotizaciones.has(match.key));

      const cotizacion = matches.reduce((acc, match) => acc + match.cotizacion, 0);
      matches.forEach(match => usedCotizaciones.add(match.key));

      const item = result.get(resultKey) || { especialidad: rawEspecialidad, cotizacion: 0, facturado: 0, saldo: 0 };
      item.cotizacion += cotizacion;
      item.facturado += facturado;
      item.saldo = this.round(item.cotizacion - item.facturado);
      result.set(resultKey, item);
    }

    for (const cotizacion of cotizacionItems) {
      if (usedCotizaciones.has(cotizacion.key)) continue;

      const existing = result.get(cotizacion.key);
      if (existing) {
        existing.cotizacion += cotizacion.cotizacion;
        existing.saldo = this.round(existing.cotizacion - existing.facturado);
        result.set(cotizacion.key, existing);
      } else {
        result.set(cotizacion.key, {
          especialidad: cotizacion.especialidad,
          cotizacion: cotizacion.cotizacion,
          facturado: 0,
          saldo: cotizacion.cotizacion
        });
      }
    }

    this.comprasRows = Array.from(result.values());
    this.totalCotizacionMateriales = this.round(cotizacionItems.reduce((a, x) => a + x.cotizacion, 0));
    this.totalMateriales = this.round(this.comprasRows.reduce((a, x) => a + x.facturado, 0));
  }

  private buildValorizaciones(rows: any[]): void {
    const map = new Map<string, ValResumenRow>();
    for (const row of rows) {
      const especialidad = String(this.readValue(row, 'especialidad', 'Especialidad') || 'Sin especialidad').trim();
      const cotizacion = this.toNumber(this.readValue(row, 'cotizacion', 'Cotizacion', 'montoCotizacion', 'MontoCotizacion'));
      const garantia = this.toNumber(this.readValue(row, 'garantia', 'Garantia'));
      const transferido = this.toNumber(this.readValue(row, 'transferido', 'Transferido'));
      const facturado = this.toNumber(this.readValue(row, 'facturado', 'Facturado'));
      const saldo = this.toNumber(this.readValue(row, 'resta', 'Resta', 'saldoPendiente', 'SaldoPendiente')) || this.round(cotizacion - facturado);

      const item = map.get(especialidad) || { especialidad, cotizacion: 0, garantia: 0, transferido: 0, facturado: 0, saldo: 0 };
      item.cotizacion += cotizacion;
      item.garantia += garantia;
      item.transferido += transferido;
      item.facturado += facturado;
      item.saldo += saldo;
      map.set(especialidad, item);
    }
    this.valorizacionesRows = Array.from(map.values());
    this.totalValorizaciones = this.round(this.valorizacionesRows.reduce((a, x) => a + x.facturado, 0));
  }

  private buildGastos(rows: any[]): void {
    const map = new Map<string, GastoResumenRow>();
    for (const row of rows) {
      const categoria = String(this.readValue(row, 'categoria', 'Categoria') || 'Sin categoría').trim();
      const facturado = this.toNumber(this.readValue(row, 'monto', 'Monto', 'total', 'Total'));
      const item = map.get(categoria) || { categoria, facturado: 0 };
      item.facturado += facturado;
      map.set(categoria, item);
    }
    this.gastosRows = Array.from(map.values());
    this.totalGastos = this.round(this.gastosRows.reduce((a, x) => a + x.facturado, 0));
  }

  private buildTerrenoTotals(rows: any[]): void {
    this.totalTerreno = this.round(rows
      .filter((x: any) => String(this.readValue(x, 'concepto', 'Concepto') || '').trim().toUpperCase() === 'TERRENO')
      .reduce((a: number, x: any) => a + this.readGastoProyectoMontoSoles(x), 0));

    this.totalAlcabala = this.round(rows
      .filter((x: any) => String(this.readValue(x, 'concepto', 'Concepto') || '').trim().toUpperCase() === 'ALCABALA')
      .reduce((a: number, x: any) => a + this.readGastoProyectoMontoSoles(x), 0));
  }

  private sumGastoProyecto(rows: any[]): number {
    return this.round((rows || []).reduce((acc: number, row: any) => acc + this.readGastoProyectoMontoSoles(row), 0));
  }

  private filterByProject(rows: any[], idProyecto: number, nombreProyecto: string): any[] {
    const proyectoNombre = String(nombreProyecto || '').trim().toLowerCase();
    return rows.filter((row: any) => {
      const sameId = Number(this.readValue(row, 'idProyecto', 'IdProyecto')) === idProyecto;
      const sameName = String(this.readValue(row, 'nombreProyecto', 'NombreProyecto', 'proyecto', 'Proyecto') || '').trim().toLowerCase() === proyectoNombre;
      return sameId || (!!proyectoNombre && sameName);
    });
  }

  private filterByProjectStrict(rows: any[], idProyecto: number, nombreProyecto: string): any[] {
    const proyectoNombre = String(nombreProyecto || '').trim().toLowerCase();
    return rows.filter((row: any) => {
      const rawId = this.readValue(row, 'idProyecto', 'IdProyecto');
      const rawName = this.readValue(row, 'nombreProyecto', 'NombreProyecto', 'proyecto', 'Proyecto');
      const hasProjectData = rawId !== null || (rawName !== null && String(rawName).trim() !== '');
      if (!hasProjectData) return false;

      const sameId = Number(rawId) === idProyecto;
      const sameName = String(rawName || '').trim().toLowerCase() === proyectoNombre;
      return sameId || (!!proyectoNombre && sameName);
    });
  }

  private readGastoProyectoMontoSoles(row: any): number {
    const montoSoles = Number(this.readValue(row, 'montoSoles', 'MontoSoles') ?? 0);
    if (montoSoles > 0) return montoSoles;

    const monto = Number(this.readValue(row, 'monto', 'Monto') ?? 0);
    const montoDolares = Number(this.readValue(row, 'montoDolares', 'MontoDolares') ?? 0);
    const moneda = String(this.readValue(row, 'moneda', 'Moneda') || '').trim().toUpperCase();
    if (montoDolares > 0) return this.round(montoDolares * Number(this.readValue(row, 'tipoCambio', 'TipoCambio') || 3.41));
    if (moneda === 'USD') return this.round(monto * Number(this.readValue(row, 'tipoCambio', 'TipoCambio') || 3.41));
    return monto;
  }

  private findCotizacionMatches(cotizaciones: Array<{ key: string; especialidad: string; cotizacion: number }>, rawEspecialidad: string): Array<{ key: string; especialidad: string; cotizacion: number }> {
    const rawKey = this.normalizeKey(rawEspecialidad);
    const parts = rawEspecialidad
      .split(/[,;/|+&]/)
      .map(x => this.normalizeKey(x))
      .filter(Boolean);

    const matches = new Map<string, { key: string; especialidad: string; cotizacion: number }>();

    const add = (item: { key: string; especialidad: string; cotizacion: number }) => {
      if (item.cotizacion === 0) return;
      matches.set(item.key, item);
    };

    for (const item of cotizaciones) {
      if (item.key === rawKey) {
        add(item);
        continue;
      }

      if (parts.some(part => part === item.key)) {
        add(item);
        continue;
      }

      if (parts.some(part => part.length >= 3 && item.key.length >= 3 && (part.includes(item.key) || item.key.includes(part)))) {
        add(item);
      }
    }

    return Array.from(matches.values());
  }

  private normalizeKey(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private readValue<T = any>(row: any, ...keys: string[]): T | null {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null) return row[key] as T;
    }
    return null;
  }

  private toNumber(value: any): number {
    return this.round(Number(value || 0));
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
