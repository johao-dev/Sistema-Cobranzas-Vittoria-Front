import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { GastosAdministrativosService } from '../../core/services/gastos-administrativos.service';

type TerrenoItem = {
  idTerreno: number;
  fechaEmision: string;
  idProyecto: number | null;
  nombreProyecto: string;
  idProveedorGastoAdministrativo: number | null;
  proveedor: string;
  actividad: string;
  tipoActividad: string;
  moneda: string;
  total: number;
  descripcion: string;
  estado: string;
  concepto: string;
  monto: number;
};

@Component({
  standalone: true,
  selector: 'app-terreno-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './terreno.page.html',
  styleUrl: './terreno.page.css'
})
export class TerrenoPage implements OnInit {
  private readonly storageKey = 'vittoria-terrenos-v2';

  proyectos: any[] = [];
  proveedoresGasto: any[] = [];
  rows: TerrenoItem[] = [];
  msg = '';
  editandoId: number | null = null;

  form = {
    fechaEmision: this.todayIso(),
    idProyecto: null as number | null,
    idProveedorGastoAdministrativo: null as number | null,
    actividad: '',
    tipoActividad: '',
    moneda: 'PEN',
    total: null as number | null,
    descripcion: '',
    estado: 'Activo'
  };

  constructor(
    private maestra: MaestraService,
    private gastosAdmin: GastosAdministrativosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.maestra.proyectos(true).subscribe({
      next: (rows: any[]) => { this.proyectos = rows || []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });

    this.gastosAdmin.proveedores(true).subscribe({
      next: (rows: any[]) => { this.proveedoresGasto = rows || []; this.cdr.detectChanges(); },
      error: () => { this.proveedoresGasto = []; this.cdr.detectChanges(); }
    });

    this.cargarRows();
  }

  guardar(): void {
    if (!this.form.idProyecto) { this.msg = 'Debes seleccionar un proyecto.'; return; }
    if (!this.form.idProveedorGastoAdministrativo) { this.msg = 'Debes seleccionar un proveedor.'; return; }
    if (!(this.form.actividad || '').trim()) { this.msg = 'Debes ingresar la actividad.'; return; }
    if (!(this.form.tipoActividad || '').trim()) { this.msg = 'Debes ingresar el tipo de actividad.'; return; }
    if (!this.form.moneda) { this.msg = 'Debes seleccionar la moneda.'; return; }
    if (!Number(this.form.total || 0)) { this.msg = 'Debes ingresar el total.'; return; }

    const proyecto = this.proyectos.find((p: any) => Number(p.idProyecto) === Number(this.form.idProyecto));
    const proveedor = this.proveedoresGasto.find((p: any) => Number(p.idProveedorGastoAdministrativo) === Number(this.form.idProveedorGastoAdministrativo));
    const payload: TerrenoItem = {
      idTerreno: this.editandoId || this.nextId(),
      fechaEmision: this.form.fechaEmision || this.todayIso(),
      idProyecto: Number(this.form.idProyecto),
      nombreProyecto: proyecto?.nombreProyecto || '-',
      idProveedorGastoAdministrativo: Number(this.form.idProveedorGastoAdministrativo),
      proveedor: proveedor?.nombre || proveedor?.razonSocial || proveedor?.descripcion || '-',
      actividad: String(this.form.actividad || '').trim(),
      tipoActividad: String(this.form.tipoActividad || '').trim(),
      moneda: String(this.form.moneda || 'PEN').trim(),
      total: Number(this.form.total || 0),
      descripcion: String(this.form.descripcion || '').trim(),
      estado: this.form.estado || 'Activo',
      concepto: `${String(this.form.actividad || '').trim()} - ${String(this.form.tipoActividad || '').trim()}`,
      monto: Number(this.form.total || 0)
    };

    const rows = [...this.rows];
    const index = rows.findIndex(x => x.idTerreno === payload.idTerreno);
    if (index >= 0) rows[index] = payload;
    else rows.unshift(payload);

    this.rows = rows;
    this.persistir();
    this.msg = this.editandoId ? 'Registro de terreno actualizado correctamente.' : 'Registro de terreno guardado correctamente.';
    this.limpiar();
  }

  editar(row: TerrenoItem): void {
    this.editandoId = row.idTerreno;
    this.form = {
      fechaEmision: row.fechaEmision || this.todayIso(),
      idProyecto: row.idProyecto,
      idProveedorGastoAdministrativo: row.idProveedorGastoAdministrativo,
      actividad: row.actividad,
      tipoActividad: row.tipoActividad,
      moneda: row.moneda || 'PEN',
      total: row.total,
      descripcion: row.descripcion,
      estado: row.estado || 'Activo'
    };
  }

  cambiarEstado(row: TerrenoItem): void {
    row.estado = row.estado === 'Activo' ? 'Inactivo' : 'Activo';
    this.persistir();
    this.msg = `Registro ${row.estado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`;
  }

  limpiar(): void {
    this.editandoId = null;
    this.form = {
      fechaEmision: this.todayIso(),
      idProyecto: null,
      idProveedorGastoAdministrativo: null,
      actividad: '',
      tipoActividad: '',
      moneda: 'PEN',
      total: null,
      descripcion: '',
      estado: 'Activo'
    };
    this.cdr.detectChanges();
  }

  private cargarRows(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.rows = raw ? (JSON.parse(raw) as TerrenoItem[]) : [];
    } catch {
      this.rows = [];
    }
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
}
