import { Component, ChangeDetectorRef, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { SunatService } from '../../core/services/sunat.service';

type TerrenoItem = {
  idTerreno: number;
  fechaEmision: string;
  idProyecto: number | null;
  nombreProyecto: string;
  concepto: string;
  montoSoles: number;
  montoDolares: number;
  tipoCambio: number;
  descripcion: string;
  estado: string;
};

@Component({
  standalone: true,
  selector: 'app-terreno-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './terreno.page.html',
  styleUrl: './terreno.page.css'
})
export class TerrenoPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageKey = 'vittoria-terrenos-v4';
  private syncingFromDolares = false;

  proyectos: any[] = [];
  rows: TerrenoItem[] = [];
  msg = '';
  editandoId: number | null = null;
  tipoCambioActual = 3.41;

  form = {
    fechaEmision: this.todayIso(),
    idProyecto: null as number | null,
    concepto: '',
    montoSoles: null as number | null,
    montoDolares: null as number | null,
    tipoCambio: this.tipoCambioActual,
    descripcion: '',
    estado: 'Activo'
  };

  constructor(
    private maestra: MaestraService,
    private sunatService: SunatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sunatService.tipoCambio$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const sellPrice = this.toNumber(data?.sell_price);
        if (sellPrice > 0) {
          this.tipoCambioActual = sellPrice;
          if (!this.editandoId) {
            this.form.tipoCambio = sellPrice;
          }
          if (this.toNumber(this.form.montoDolares) > 0) {
            this.onDolaresInput();
          }
        }
        this.cdr.detectChanges();
      });
    this.sunatService.loadTipoCambio();

    this.maestra.proyectos(true).subscribe({
      next: (rows: any[]) => { this.proyectos = rows || []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });
    this.cargarRows();
  }

  guardar(): void {
    if (!this.form.idProyecto) { this.msg = 'Debes seleccionar un proyecto.'; return; }
    if (!(this.form.concepto || '').trim()) { this.msg = 'Debes ingresar el concepto.'; return; }
    if (!(this.toNumber(this.form.montoSoles) > 0)) { this.msg = 'Debes ingresar el monto en soles o en dólares.'; return; }

    const proyecto = this.proyectos.find((p: any) => Number(p.idProyecto) === Number(this.form.idProyecto));
    const payload: TerrenoItem = {
      idTerreno: this.editandoId || this.nextId(),
      fechaEmision: this.form.fechaEmision || this.todayIso(),
      idProyecto: Number(this.form.idProyecto),
      nombreProyecto: proyecto?.nombreProyecto || '-',
      concepto: String(this.form.concepto || '').trim(),
      montoSoles: this.toNumber(this.form.montoSoles),
      montoDolares: this.toNumber(this.form.montoDolares),
      tipoCambio: this.toNumber(this.form.tipoCambio || this.tipoCambioActual) || this.tipoCambioActual,
      descripcion: String(this.form.descripcion || '').trim(),
      estado: this.form.estado || 'Activo'
    };

    const rows = [...this.rows];
    const index = rows.findIndex(x => x.idTerreno === payload.idTerreno);
    if (index >= 0) rows[index] = payload;
    else rows.unshift(payload);
    this.rows = rows;
    this.persistir();
    this.msg = this.editandoId ? 'Registro actualizado correctamente.' : 'Registro guardado correctamente.';
    this.limpiar();
  }

  editar(row: TerrenoItem): void {
    this.editandoId = row.idTerreno;
    this.form = {
      fechaEmision: row.fechaEmision || this.todayIso(),
      idProyecto: row.idProyecto,
      concepto: row.concepto,
      montoSoles: row.montoSoles,
      montoDolares: row.montoDolares || null,
      tipoCambio: row.tipoCambio || this.tipoCambioActual,
      descripcion: row.descripcion,
      estado: row.estado || 'Activo'
    };
  }

  cambiarEstado(row: TerrenoItem): void {
    row.estado = row.estado === 'Activo' ? 'Inactivo' : 'Activo';
    this.persistir();
    this.msg = `Registro ${row.estado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`;
  }

  onDolaresInput(): void {
    const dolares = this.toNumber(this.form.montoDolares);
    if (dolares <= 0) {
      this.form.montoDolares = null;
      return;
    }

    this.syncingFromDolares = true;
    this.form.tipoCambio = this.toNumber(this.form.tipoCambio || this.tipoCambioActual) || this.tipoCambioActual;
    this.form.montoSoles = this.round(dolares * this.form.tipoCambio);
    this.syncingFromDolares = false;
  }

  onSolesInput(): void {
    if (this.syncingFromDolares) return;
    if (this.toNumber(this.form.montoSoles) <= 0) {
      this.form.montoSoles = null;
    }
    this.form.montoDolares = null;
  }

  limpiar(): void {
    this.editandoId = null;
    this.form = {
      fechaEmision: this.todayIso(),
      idProyecto: null,
      concepto: '',
      montoSoles: null,
      montoDolares: null,
      tipoCambio: this.tipoCambioActual,
      descripcion: '',
      estado: 'Activo'
    };
    this.cdr.detectChanges();
  }

  formatMoney(value: any, currency: 'PEN' | 'USD' = 'PEN'): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  totalRegistrado(): number {
    return this.rows.reduce((acc, row) => acc + this.toNumber(row.montoSoles), 0);
  }

  totalPorConcepto(nombreConcepto: string): number {
    const match = String(nombreConcepto || '').trim().toUpperCase();
    return this.rows
      .filter((x) => String(x.concepto || '').trim().toUpperCase() === match)
      .reduce((acc, row) => acc + this.toNumber(row.montoSoles), 0);
  }

  registrosActivos(): number {
    return this.rows.filter((x) => x.estado === 'Activo').length;
  }

  private cargarRows(): void {
    try {
      const raw = localStorage.getItem(this.storageKey)
        || localStorage.getItem('vittoria-terrenos-v3')
        || localStorage.getItem('vittoria-terrenos-v2');

      const sourceRows = raw ? (JSON.parse(raw) as any[]) : [];
      this.rows = sourceRows.map((row: any) => this.normalizarRow(row));
      this.persistir();
    } catch {
      this.rows = [];
    }
  }

  private normalizarRow(row: any): TerrenoItem {
    const montoDolares = this.toNumber(row?.montoDolares ?? (String(row?.moneda || '').toUpperCase() === 'USD' ? row?.monto : 0));
    const tipoCambio = this.toNumber(row?.tipoCambio) || this.tipoCambioActual;
    let montoSoles = this.toNumber(row?.montoSoles ?? (String(row?.moneda || '').toUpperCase() === 'PEN' ? row?.monto : 0));

    if (montoSoles <= 0 && montoDolares > 0) {
      montoSoles = this.round(montoDolares * tipoCambio);
    }

    return {
      idTerreno: Number(row?.idTerreno || 0),
      fechaEmision: row?.fechaEmision || this.todayIso(),
      idProyecto: row?.idProyecto != null ? Number(row.idProyecto) : null,
      nombreProyecto: row?.nombreProyecto || '-',
      concepto: String(row?.concepto || '').trim(),
      montoSoles,
      montoDolares,
      tipoCambio,
      descripcion: String(row?.descripcion || '').trim(),
      estado: row?.estado || 'Activo'
    };
  }

  private persistir(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.rows));
    this.cdr.detectChanges();
  }

  private nextId(): number {
    return this.rows.reduce((acc, row) => Math.max(acc, Number(row.idTerreno || 0)), 0) + 1;
  }

  private todayIso(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private toNumber(value: any): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? this.round(number) : 0;
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
