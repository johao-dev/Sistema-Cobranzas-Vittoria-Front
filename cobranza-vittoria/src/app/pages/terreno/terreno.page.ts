import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';

type TerrenoItem = {
  idTerreno: number;
  fecha: string;
  idProyecto: number | null;
  nombreProyecto: string;
  terreno: string;
  alcabala: string;
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
  private readonly storageKey = 'vittoria-terrenos';

  proyectos: any[] = [];
  rows: TerrenoItem[] = [];
  msg = '';
  editandoId: number | null = null;

  form = {
    fecha: this.todayIso(),
    idProyecto: null as number | null,
    terreno: '',
    alcabala: '',
    estado: 'Activo'
  };

  constructor(private maestra: MaestraService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.maestra.proyectos(true).subscribe({
      next: (rows: any[]) => {
        this.proyectos = rows || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.proyectos = [];
        this.cdr.detectChanges();
      }
    });

    this.cargarRows();
  }

  guardar(): void {
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }
    if (!(this.form.terreno || '').trim()) {
      this.msg = 'Debes ingresar el terreno.';
      return;
    }
    if (!(this.form.alcabala || '').trim()) {
      this.msg = 'Debes ingresar la alcabala.';
      return;
    }

    const proyecto = this.proyectos.find((p: any) => Number(p.idProyecto) === Number(this.form.idProyecto));
    const payload: TerrenoItem = {
      idTerreno: this.editandoId || this.nextId(),
      fecha: this.form.fecha || this.todayIso(),
      idProyecto: Number(this.form.idProyecto),
      nombreProyecto: proyecto?.nombreProyecto || '-',
      terreno: String(this.form.terreno || '').trim(),
      alcabala: String(this.form.alcabala || '').trim(),
      estado: this.form.estado || 'Activo'
    };

    const rows = [...this.rows];
    const index = rows.findIndex(x => x.idTerreno === payload.idTerreno);
    if (index >= 0) rows[index] = payload;
    else rows.unshift(payload);

    this.rows = rows;
    localStorage.setItem(this.storageKey, JSON.stringify(this.rows));
    this.msg = this.editandoId ? 'Terreno actualizado correctamente.' : 'Terreno registrado correctamente.';
    this.limpiar();
  }

  editar(row: TerrenoItem): void {
    this.editandoId = row.idTerreno;
    this.form = {
      fecha: row.fecha || this.todayIso(),
      idProyecto: row.idProyecto,
      terreno: row.terreno,
      alcabala: row.alcabala,
      estado: row.estado || 'Activo'
    };
  }

  cambiarEstado(row: TerrenoItem): void {
    row.estado = row.estado === 'Activo' ? 'Inactivo' : 'Activo';
    this.persistir();
    this.msg = `Terreno ${row.estado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`;
  }

  limpiar(): void {
    this.editandoId = null;
    this.form = {
      fecha: this.todayIso(),
      idProyecto: null,
      terreno: '',
      alcabala: '',
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
