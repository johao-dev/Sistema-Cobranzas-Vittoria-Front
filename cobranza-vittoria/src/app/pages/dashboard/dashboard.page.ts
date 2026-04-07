import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, filter, finalize, timeout } from 'rxjs/operators';
import { ComprasService } from '../../core/services/compras.service';
import { ValorizacionesService } from '../../core/services/valorizaciones.service';
import { NavigationEnd, Router } from '@angular/router';

type MaterialChartRow = {
  label: string;
  value: number;
  width: number;
};

type MaterialStats = {
  material: string;
  cantidad: number;
  monto: number;
  frecuencia: number;
};

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.css']
})
export class DashboardPage implements OnInit, OnDestroy {
  loading = true;
  cards = [
    { key: 'compras', label: 'Compras registradas', value: 0 },
    { key: 'facturado', label: 'Valorizado facturado', value: 0 },
    { key: 'transferido', label: 'Valorizado transferido', value: 0 },
    { key: 'garantia', label: 'Garantías retenidas', value: 0 },
    { key: 'detraccion', label: 'Detracciones', value: 0 },
  ];
  totalMateriales = 0;
  materialSummary = {
    topCantidad: '',
    topMonto: '',
    topFrecuencia: ''
  };
  chartRowsCantidad: MaterialChartRow[] = [];
  chartRowsMonto: MaterialChartRow[] = [];
  chartRowsFrecuencia: MaterialChartRow[] = [];
  hasData = false;
  loadingMessage = 'Cargando dashboard...';
  loadingMaterials = false;
  private routeSub?: Subscription;
  private loadVersion = 0;

  constructor(
    private comprasService: ComprasService,
    private valorizacionesService: ValorizacionesService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    this.routeSub = this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      if (event.urlAfterRedirects.includes('/dashboard')) this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  load(): void {
    const version = ++this.loadVersion;
    this.loading = true;
    this.loadingMaterials = false;
    this.loadingMessage = this.hasData ? 'Actualizando dashboard...' : 'Cargando dashboard...';

    forkJoin({
      compras: this.comprasService.compras().pipe(catchError(() => of([]))),
      valorizaciones: this.valorizacionesService.valorizaciones().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ compras, valorizaciones }) => {
        if (version !== this.loadVersion) return;

        const comprasRows = this.asArray(compras);
        const valorizacionesRows = this.asArray(valorizaciones);
        const compraIds = comprasRows
          .map((row: any) => Number(this.read(row, ['idCompra', 'IdCompra']) || 0))
          .filter((id: number) => id > 0);

        const totalCompras = this.sum(comprasRows, ['montoTotal', 'MontoTotal', 'total', 'Total']);
        const totalFacturado = this.sum(valorizacionesRows, ['facturado', 'Facturado']);
        const totalTransferido = this.sum(valorizacionesRows, ['transferido', 'Transferido']);
        const totalGarantia = this.sum(valorizacionesRows, ['garantia', 'Garantia']);
        const totalDetraccion = this.sum(valorizacionesRows, ['detraccion', 'Detraccion']);

        this.cards = [
          { key: 'compras', label: 'Compras registradas', value: totalCompras },
          { key: 'facturado', label: 'Valorizado facturado', value: totalFacturado },
          { key: 'transferido', label: 'Valorizado transferido', value: totalTransferido },
          { key: 'garantia', label: 'Garantías retenidas', value: totalGarantia },
          { key: 'detraccion', label: 'Detracciones', value: totalDetraccion },
        ];

        this.hasData = this.cards.some(card => card.value > 0);
        this.loading = false;

        if (!compraIds.length) {
          this.clearMaterialStats();
          return;
        }

        this.loadingMaterials = true;
        forkJoin(
          compraIds.map(id =>
            this.comprasService.compra(id).pipe(
              timeout(12000),
              catchError(() => of(null))
            )
          )
        )
          .pipe(finalize(() => { if (version === this.loadVersion) this.loadingMaterials = false; }))
          .subscribe({
            next: detalleCompras => {
              if (version !== this.loadVersion) return;
              const materialStats = this.buildMaterialStats(detalleCompras);
              this.totalMateriales = materialStats.length;
              this.chartRowsCantidad = this.buildChartRows(materialStats, 'cantidad');
              this.chartRowsMonto = this.buildChartRows(materialStats, 'monto');
              this.chartRowsFrecuencia = this.buildChartRows(materialStats, 'frecuencia');
              this.materialSummary = {
                topCantidad: this.chartRowsCantidad[0]?.label || '-',
                topMonto: this.chartRowsMonto[0]?.label || '-',
                topFrecuencia: this.chartRowsFrecuencia[0]?.label || '-'
              };

              this.hasData = this.hasData
                || this.chartRowsCantidad.some(row => row.value > 0)
                || this.chartRowsMonto.some(row => row.value > 0)
                || this.chartRowsFrecuencia.some(row => row.value > 0);
            },
            error: () => {
              if (version !== this.loadVersion) return;
              this.clearMaterialStats();
            }
          });
      },
      error: () => {
        if (version !== this.loadVersion) return;
        this.loading = false;
        this.loadingMaterials = false;
        this.cards = this.cards.map(card => ({ ...card, value: 0 }));
        this.clearMaterialStats();
        this.hasData = false;
      }
    });
  }


  formatMoney(value: any): string {
    const number = this.toNumber(value);
    return `PEN ${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private clearMaterialStats(): void {
    this.totalMateriales = 0;
    this.materialSummary = { topCantidad: '-', topMonto: '-', topFrecuencia: '-' };
    this.chartRowsCantidad = [];
    this.chartRowsMonto = [];
    this.chartRowsFrecuencia = [];
  }

  private buildMaterialStats(detallesCompra: any[]): MaterialStats[] {
    const materialMap = new Map<string, MaterialStats>();

    for (const compra of detallesCompra || []) {
      const items = this.asArray(compra?.items);
      for (const item of items) {
        const material = String(this.read(item, ['material', 'Material']) || '-').trim() || '-';
        const cantidad = this.toNumber(this.read(item, ['cantidad', 'Cantidad']));
        const monto = this.toNumber(this.read(item, ['subtotal', 'Subtotal']))
          || this.round(cantidad * this.toNumber(this.read(item, ['precioUnitario', 'PrecioUnitario'])));

        const current = materialMap.get(material) || {
          material,
          cantidad: 0,
          monto: 0,
          frecuencia: 0
        };

        current.cantidad = this.round(current.cantidad + cantidad);
        current.monto = this.round(current.monto + monto);
        current.frecuencia += 1;
        materialMap.set(material, current);
      }
    }

    return Array.from(materialMap.values());
  }

  private buildChartRows(materialStats: MaterialStats[], metric: 'cantidad' | 'monto' | 'frecuencia'): MaterialChartRow[] {
    const rows = [...materialStats].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0));
    const maxValue = Math.max(...rows.map(row => Number(row[metric] || 0)), 0);
    return rows.map(row => ({
      label: row.material,
      value: Number(row[metric] || 0),
      width: maxValue > 0 ? Math.max(6, Math.round((Number(row[metric] || 0) / maxValue) * 100)) : 0,
    }));
  }

  private asArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  }

  private read(row: any, keys: string[]): any {
    for (const key of keys) {
      if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
    }
    return null;
  }

  private toNumber(value: any): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private sum(rows: any[], keys: string[]): number {
    return rows.reduce((acc, row) => acc + this.toNumber(this.read(row, keys)), 0);
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
