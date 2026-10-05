import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ComprasService } from '../../core/services/compras.service';
import { ValorizacionesService } from '../../core/services/valorizaciones.service';
import { MaestraService } from '../../core/services/maestra.service';
import { CotizacionMaterialesService } from '../../core/services/cotizacion-materiales.service';
import { GastosDirectosService } from '../../core/services/gastos-directos.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';

/** Secciones de Gastos del proyecto; todas son gasto directo filtrado por sección. */
const SECCIONES_GASTO = ['ADMINISTRATIVO', 'TERRENO', 'MARKETING_VENTAS', 'OTROS', 'MUNICIPAL'] as const;
type SeccionGasto = typeof SECCIONES_GASTO[number];

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
  fechaDesde = '';
  fechaHasta = '';

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
  /** False si el backend no expone la cotización de materiales: se muestra "No disponible", no 0. */
  cotizacionMaterialesDisponible = true;
  /** El proyecto no tiene centro de costo: sus gastos del proyecto no se pueden consultar. */
  sinCentroCosto = false;
  totalGeneral = 0;
  saldo = 0;

  private comprasSource: any[] = [];
  private valorizacionesSource: any[] = [];

  constructor(
    private comprasService: ComprasService,
    private valorizacionesService: ValorizacionesService,
    private maestraService: MaestraService,
    private cotizacionMaterialesService: CotizacionMaterialesService,
    private gastosDirectosService: GastosDirectosService,
    private controlPresupuestario: ControlPresupuestarioService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.msg = '';

    // Cada fuente falla por separado: una que no responde no deja al resumen sin proyectos.
    forkJoin({
      compras: this.comprasService.compras().pipe(catchError(() => of([]))),
      valorizaciones: this.valorizacionesService.valorizaciones().pipe(catchError(() => of([]))),
      proyectos: this.maestraService.proyectos(true).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ compras, valorizaciones, proyectos }) => {
        if (proyectos === null) this.msg = 'No se pudieron cargar los proyectos.';
        this.comprasSource = Array.isArray(compras) ? compras : [];
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

  onFechaChange(): void {
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


  exportarExcel(): void {
    const lines: string[][] = [];
    lines.push(['Resumen Total']);
    lines.push(['Proyecto', this.proyectoSeleccionadoNombre()]);
    lines.push(['Fecha desde', this.fechaDesde || 'Todos']);
    lines.push(['Fecha hasta', this.fechaHasta || 'Todos']);
    lines.push([]);
    lines.push(['Concepto', 'Monto']);
    lines.push(['Cotización general', this.formatNumber(this.cotizacionGeneral)]);
    lines.push(['Cotización de materiales', this.cotizacionMaterialesDisponible
      ? this.formatNumber(this.totalCotizacionMateriales) : 'No disponible']);
    lines.push(['Valorizaciones', this.formatNumber(this.totalValorizaciones)]);
    lines.push(['Gastos administrativos', this.formatNumber(this.totalGastos)]);
    lines.push(['Terreno', this.formatNumber(this.totalTerreno)]);
    lines.push(['Alcabala', this.formatNumber(this.totalAlcabala)]);
    lines.push(['Marketing / Ventas', this.formatNumber(this.totalMarketing)]);
    lines.push(['Otros gastos', this.formatNumber(this.totalOtrosGastos)]);
    lines.push(['Municipales / Distritales', this.formatNumber(this.totalMunicipales)]);
    lines.push(['Total general', this.formatNumber(this.totalGeneral)]);
    lines.push(['Saldo', this.formatNumber(this.saldo)]);
    lines.push([]);

    lines.push(['Cotización de materiales por especialidad']);
    lines.push(['Especialidad', 'Cotización', 'Facturado', 'Saldo']);
    this.comprasRows.forEach(row => lines.push([row.especialidad, this.formatNumber(row.cotizacion), this.formatNumber(row.facturado), this.formatNumber(row.saldo)]));
    lines.push(['Total', this.formatNumber(this.totalCotizacionMateriales), this.formatNumber(this.totalMateriales), this.formatNumber(this.totalCotizacionMateriales - this.totalMateriales)]);
    lines.push([]);

    lines.push(['Valorizaciones']);
    lines.push(['Especialidad', 'Cotización', 'Garantía', 'Transferido', 'Facturado', 'Saldo pendiente']);
    this.valorizacionesRows.forEach(row => lines.push([row.especialidad, this.formatNumber(row.cotizacion), this.formatNumber(row.garantia), this.formatNumber(row.transferido), this.formatNumber(row.facturado), this.formatNumber(row.saldo)]));
    lines.push([]);

    lines.push(['Gastos administrativos']);
    lines.push(['Categoría', 'Facturado']);
    this.gastosRows.forEach(row => lines.push([row.categoria, this.formatNumber(row.facturado)]));

    this.downloadTableAsExcel(lines, `resumen_total_${this.slug(this.proyectoSeleccionadoNombre())}_${new Date().toISOString().slice(0, 10)}.xls`);
  }

  exportarPdf(): void {
    const win = window.open('', '_blank');
    if (!win) return;

    const rowsKpi = [
      ['Cotización general', this.formatMoney(this.cotizacionGeneral)],
      ['Cotización de materiales', this.cotizacionMaterialesDisponible
        ? this.formatMoney(this.totalCotizacionMateriales) : 'No disponible'],
      ['Valorizaciones', this.formatMoney(this.totalValorizaciones)],
      ['Gastos administrativos', this.formatMoney(this.totalGastos)],
      ['Terreno', this.formatMoney(this.totalTerreno)],
      ['Alcabala', this.formatMoney(this.totalAlcabala)],
      ['Marketing / Ventas', this.formatMoney(this.totalMarketing)],
      ['Otros gastos', this.formatMoney(this.totalOtrosGastos)],
      ['Municipales / Distritales', this.formatMoney(this.totalMunicipales)],
      ['Total general', this.formatMoney(this.totalGeneral)],
      ['Saldo', this.formatMoney(this.saldo)]
    ].map(row => `<tr><td>${this.escapeHtml(row[0])}</td><td class="num">${this.escapeHtml(row[1])}</td></tr>`).join('');

    const materialesRows = this.comprasRows.map(row => `<tr><td>${this.escapeHtml(row.especialidad)}</td><td class="num">${this.escapeHtml(this.formatMoney(row.cotizacion))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.facturado))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.saldo))}</td></tr>`).join('');
    const valorizacionesRows = this.valorizacionesRows.map(row => `<tr><td>${this.escapeHtml(row.especialidad)}</td><td class="num">${this.escapeHtml(this.formatMoney(row.cotizacion))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.garantia))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.transferido))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.facturado))}</td><td class="num">${this.escapeHtml(this.formatMoney(row.saldo))}</td></tr>`).join('');
    const gastosRows = this.gastosRows.map(row => `<tr><td>${this.escapeHtml(row.categoria)}</td><td class="num">${this.escapeHtml(this.formatMoney(row.facturado))}</td></tr>`).join('');

    win.document.write(`
      <html>
      <head>
        <title>Resumen Total</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 22px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          h2 { margin-top: 22px; font-size: 16px; }
          .meta { color: #4b5563; margin-bottom: 14px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th, td { border: 1px solid #dbe3ef; padding: 6px 8px; text-align: left; }
          th { background: #f3f6fb; }
          .num { text-align: right; white-space: nowrap; }
        </style>
      </head>
      <body>
        <h1>Resumen Total</h1>
        <div class="meta">Proyecto: ${this.escapeHtml(this.proyectoSeleccionadoNombre())} | Desde: ${this.escapeHtml(this.fechaDesde || 'Todos')} | Hasta: ${this.escapeHtml(this.fechaHasta || 'Todos')}</div>
        <h2>Consolidado</h2>
        <table><tbody>${rowsKpi}</tbody></table>
        <h2>Cotización de materiales por especialidad</h2>
        <table><thead><tr><th>Especialidad</th><th>Cotización</th><th>Facturado</th><th>Saldo</th></tr></thead><tbody>${materialesRows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody></table>
        <h2>Valorizaciones</h2>
        <table><thead><tr><th>Especialidad</th><th>Cotización</th><th>Garantía</th><th>Transferido</th><th>Facturado</th><th>Saldo</th></tr></thead><tbody>${valorizacionesRows || '<tr><td colspan="6">Sin datos</td></tr>'}</tbody></table>
        <h2>Gastos administrativos</h2>
        <table><thead><tr><th>Categoría</th><th>Facturado</th></tr></thead><tbody>${gastosRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  private rebuildByProject(): void {
    const idProyecto = Number(this.selectedProjectId || 0);
    const nombreProyecto = this.proyectoSeleccionadoNombre();

    const proyecto = this.proyectos.find((x: any) => Number(x.idProyecto ?? x.IdProyecto) === idProyecto);
    this.cotizacionGeneral = this.toNumber(proyecto?.cotizacionGeneral ?? proyecto?.CotizacionGeneral);

    const comprasFiltradas = this.filterByDate(this.filterByProject(this.comprasSource, idProyecto, nombreProyecto));
    const valorizacionesFiltradas = this.filterByDate(this.filterByProject(this.valorizacionesSource, idProyecto, nombreProyecto));

    if (!idProyecto) {
      this.comprasRows = [];
      this.valorizacionesRows = [];
      this.gastosRows = [];
      this.totalMateriales = 0;
      this.totalCotizacionMateriales = 0;
      this.cotizacionMaterialesDisponible = true;
      this.sinCentroCosto = false;
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
      gastos: this.gastosDelProyecto(idProyecto)
    }).subscribe(({ resumenMateriales, cotizacionMateriales, gastos }) => {
      const resumenItems = Array.isArray(resumenMateriales?.items) ? resumenMateriales.items : [];
      const cotizaciones = Array.isArray(cotizacionMateriales?.items) ? cotizacionMateriales.items : [];
      this.cotizacionMaterialesDisponible = resumenMateriales !== null || cotizacionMateriales !== null;

      if (resumenItems.length && !this.hasDateFilter()) {
        this.buildComprasFromResumen(resumenMateriales);
      } else {
        this.buildComprasFallback(comprasFiltradas, cotizaciones);
        if (cotizacionMateriales) {
          this.totalCotizacionMateriales = this.toNumber(
            cotizacionMateriales?.totalCotizacionMateriales ?? cotizacionMateriales?.TotalCotizacionMateriales);
        }
      }

      this.buildValorizaciones(valorizacionesFiltradas);

      this.sinCentroCosto = gastos === null;
      const porSeccion = (seccion: SeccionGasto) => this.filterByDate(gastos?.[seccion] ?? []);
      this.buildGastos(porSeccion('ADMINISTRATIVO'));
      this.buildTerrenoTotals(porSeccion('TERRENO'));
      this.totalMarketing = this.sumGastoDirecto(porSeccion('MARKETING_VENTAS'));
      this.totalOtrosGastos = this.sumGastoDirecto(porSeccion('OTROS'));
      this.totalMunicipales = this.sumGastoDirecto(porSeccion('MUNICIPAL'));

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
    });
  }

  /**
   * Gastos directos vigentes (no anulados) del proyecto, agrupados por sección. El proyecto se
   * resuelve a su centro de costo; null si no tiene ninguno.
   */
  private gastosDelProyecto(idProyecto: number): Observable<Record<SeccionGasto, any[]> | null> {
    return this.controlPresupuestario.centrosCosto(null, null, null, idProyecto).pipe(
      catchError(() => of([] as any[])),
      switchMap(centros => {
        const ids = (centros ?? []).map((c: any) => Number(c.idCentroCosto)).filter(id => !!id);
        if (!ids.length) return of(null);

        const peticiones = SECCIONES_GASTO.flatMap(seccion => ids.map(idCentroCosto =>
          this.gastosDirectosService.listar({ seccion, idCentroCosto }).pipe(
            catchError(() => of([] as any[])),
            map(rows => ({ seccion, rows: Array.isArray(rows) ? rows : [] })))));

        return forkJoin(peticiones).pipe(map(resultados => {
          const agrupado = Object.fromEntries(SECCIONES_GASTO.map(s => [s, [] as any[]])) as Record<SeccionGasto, any[]>;
          resultados.forEach(r => agrupado[r.seccion].push(
            ...r.rows.filter(row => String(row.estado ?? '').toUpperCase() !== 'ANULADO')));
          return agrupado;
        }));
      })
    );
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

  /** Gastos administrativos agrupados por partida presupuestal. */
  private buildGastos(rows: any[]): void {
    const map = new Map<string, GastoResumenRow>();
    for (const row of rows) {
      const categoria = String(this.readValue(row, 'partida', 'Partida', 'categoria', 'Categoria') || 'Sin categoría').trim();
      const facturado = this.readGastoDirectoMontoSoles(row);
      const item = map.get(categoria) || { categoria, facturado: 0 };
      item.facturado += facturado;
      map.set(categoria, item);
    }
    this.gastosRows = Array.from(map.values());
    this.totalGastos = this.round(this.gastosRows.reduce((a, x) => a + x.facturado, 0));
  }

  /** La sección Terreno se separa en Alcabala (por partida o concepto) y el resto. */
  private buildTerrenoTotals(rows: any[]): void {
    const esAlcabala = (x: any) => this.normalizeKey(
      `${this.readValue(x, 'partida', 'Partida') || ''} ${this.readValue(x, 'concepto', 'Concepto') || ''}`).includes('ALCABALA');
    this.totalAlcabala = this.sumGastoDirecto(rows.filter(esAlcabala));
    this.totalTerreno = this.sumGastoDirecto(rows.filter(x => !esAlcabala(x)));
  }

  private sumGastoDirecto(rows: any[]): number {
    return this.round((rows || []).reduce((acc: number, row: any) => acc + this.readGastoDirectoMontoSoles(row), 0));
  }

  private filterByProject(rows: any[], idProyecto: number, nombreProyecto: string): any[] {
    const proyectoNombre = String(nombreProyecto || '').trim().toLowerCase();
    return rows.filter((row: any) => {
      const sameId = Number(this.readValue(row, 'idProyecto', 'IdProyecto')) === idProyecto;
      const sameName = String(this.readValue(row, 'nombreProyecto', 'NombreProyecto', 'proyecto', 'Proyecto') || '').trim().toLowerCase() === proyectoNombre;
      return sameId || (!!proyectoNombre && sameName);
    });
  }

  /**
   * El gasto directo está en la moneda del presupuesto y el resumen es en soles: se usa el monto
   * original si se pagó en soles y, si no, se convierte con el tipo de cambio registrado.
   */
  private readGastoDirectoMontoSoles(row: any): number {
    const monto = Number(this.readValue(row, 'monto', 'Monto') ?? 0);
    const moneda = String(this.readValue(row, 'moneda', 'Moneda') || 'PEN').trim().toUpperCase();
    if (moneda === 'PEN') return this.round(monto);

    const monedaOriginal = String(this.readValue(row, 'monedaOriginal', 'MonedaOriginal') || '').trim().toUpperCase();
    if (monedaOriginal === 'PEN') return this.round(Number(this.readValue(row, 'montoOriginal', 'MontoOriginal') ?? 0));
    return this.round(monto * Number(this.readValue(row, 'tipoCambio', 'TipoCambio') || 3.41));
  }


  private hasDateFilter(): boolean {
    return !!(this.fechaDesde || this.fechaHasta);
  }

  private filterByDate(rows: any[]): any[] {
    if (!this.hasDateFilter()) return rows || [];
    const desde = this.fechaDesde ? new Date(`${this.fechaDesde}T00:00:00`) : null;
    const hasta = this.fechaHasta ? new Date(`${this.fechaHasta}T23:59:59`) : null;
    return (rows || []).filter((row: any) => {
      const date = this.readDate(row);
      if (!date) return false;
      if (desde && date < desde) return false;
      if (hasta && date > hasta) return false;
      return true;
    });
  }

  private readDate(row: any): Date | null {
    const value = this.readValue(row,
      'fechaRegistro', 'FechaRegistro',
      'fechaCreacion', 'FechaCreacion',
      'fechaCompra', 'FechaCompra',
      'fechaFactura', 'FechaFactura',
      'fechaEmision', 'FechaEmision',
      'fecha', 'Fecha',
      'createdAt', 'CreatedAt'
    );
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatNumber(value: any): string {
    return Number(value || 0).toFixed(2);
  }

  private downloadTableAsExcel(rows: string[][], filename: string): void {
    const escapeCell = (value: any) => {
      const text = String(value ?? '');
      return /[";\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = rows.map(row => row.map(escapeCell).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private slug(value: string): string {
    return String(value || 'reporte').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'reporte';
  }

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
