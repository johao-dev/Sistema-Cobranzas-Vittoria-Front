import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { ComprasService } from '../../core/services/compras.service';
import { ValorizacionesService } from '../../core/services/valorizaciones.service';
import { NavigationEnd, Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, CurrencyPipe],
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
  chartRows: Array<{ label: string; value: number; width: number }> = [];
  hasData = false;
  private routeSub?: Subscription;

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

  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.router.url.includes('/dashboard')) this.load();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden && this.router.url.includes('/dashboard')) this.load();
  }

  load(): void {
    this.loading = true;
    forkJoin({
      compras: this.comprasService.compras().pipe(catchError(() => of([]))),
      valorizaciones: this.valorizacionesService.valorizaciones().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ compras, valorizaciones }) => {
        const comprasRows = this.asArray(compras);
        const valorizacionesRows = this.asArray(valorizaciones);

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

        const maxValue = Math.max(...valorizacionesRows.map(row => this.toNumber(this.read(row, ['facturado', 'Facturado']))), 0);
        this.chartRows = valorizacionesRows.slice(0, 12).map((row: any, idx: number) => {
          const value = this.toNumber(this.read(row, ['facturado', 'Facturado']));
          const proveedor = this.read(row, ['proveedor', 'Proveedor']) || 'Proveedor';
          const especialidad = this.read(row, ['especialidad', 'Especialidad']) || 'Especialidad';
          const periodo = this.read(row, ['periodo', 'Periodo']) || this.read(row, ['empresa', 'Empresa']) || `Val ${idx + 1}`;
          return {
            label: `${periodo} · ${proveedor} · ${especialidad}`,
            value,
            width: maxValue > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) : 0,
          };
        });

        this.hasData = this.cards.some(card => card.value > 0) || this.chartRows.some(row => row.value > 0);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.cards = this.cards.map(card => ({ ...card, value: 0 }));
        this.chartRows = [];
        this.hasData = false;
      }
    });
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
}
