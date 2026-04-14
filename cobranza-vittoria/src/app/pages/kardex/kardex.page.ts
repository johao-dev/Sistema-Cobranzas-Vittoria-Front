import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KardexService } from '../../core/services/kardex.service';
import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-kardex-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex.page.html',
  styleUrl: './kardex.page.css'
})
export class KardexPage implements OnInit {
  rows: any[] = [];
  rowsAgrupadas: any[] = [];
  comprasRealizadas: any[] = [];
  materialesCompraSeleccionada: any[] = [];
  especialidades: any[] = [];
  materiales: any[] = [];
  msg = '';

  filtros = {
    idMaterial: null as number | null,
    idEspecialidad: null as number | null,
    fechaDesde: '',
    fechaHasta: ''
  };

  salida = {
    idCompra: null as number | null,
    idMaterial: null as number | null,
    idEspecialidad: null as number | null,
    fechaMovimiento: '',
    cantidadSalida: 1,
    observacion: ''
  };

  constructor(
    private kardex: KardexService,
    private maestra: MaestraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.maestra.materiales(true).subscribe({ next: (x: any) => { this.materiales = x ?? []; this.cdr.detectChanges(); }, error: () => { this.materiales = []; this.cdr.detectChanges(); } });
    this.maestra.especialidades(true).subscribe({ next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); }, error: () => { this.especialidades = []; this.cdr.detectChanges(); } });
    this.salida.fechaMovimiento = new Date().toISOString().slice(0, 10);
    this.load();
  }

  load(): void {
    this.kardex.movimientos({
      idMaterial: this.filtros.idMaterial,
      idEspecialidad: this.filtros.idEspecialidad,
      fechaDesde: this.filtros.fechaDesde || null,
      fechaHasta: this.filtros.fechaHasta || null
    }).subscribe({
      next: (x: any) => {
        this.rows = x || [];
        this.rowsAgrupadas = this.rows;
        const map = new Map<number, any>();

        for (const row of this.rows) {
          const idCompra = Number(row.idCompra ?? row.IdCompra ?? 0);
          if (!idCompra) continue;

          const numeroCompra = row.numeroCompra || row.NumeroCompra || `Compra ${idCompra}`;
          const especialidad = row.especialidad || row.Especialidad || '-';
          const idMaterial = Number(row.idMaterial ?? row.IdMaterial ?? 0);
          const material = row.material || row.Material || '-';
          const idEspecialidad = row.idEspecialidad ?? row.IdEspecialidad ?? null;

          if (!map.has(idCompra)) {
            map.set(idCompra, { idCompra, numeroCompra, especialidad, items: [] });
          }

          const compra = map.get(idCompra);
          if (!compra.items.some((m: any) => m.idMaterial === idMaterial)) {
            compra.items.push({ idMaterial, material, idEspecialidad });
          }
        }

        this.comprasRealizadas = Array.from(map.values()).sort((a: any, b: any) => b.idCompra - a.idCompra);
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows = [];
        this.rowsAgrupadas = [];
        this.comprasRealizadas = [];
        this.cdr.detectChanges();
      }
    });
  }

  compraSalidaChange(): void {
    const compra = this.comprasRealizadas.find((c: any) => c.idCompra === this.salida.idCompra);
    this.materialesCompraSeleccionada = compra?.items || [];
    this.salida.idMaterial = null;
    this.salida.idEspecialidad = null;
  }

  materialSalidaChange(): void {
    const item = this.materialesCompraSeleccionada.find((m: any) => m.idMaterial === this.salida.idMaterial);
    if (item) this.salida.idEspecialidad = item.idEspecialidad ?? null;
  }

  registrarSalida(): void {
    if (!this.salida.idCompra || !this.salida.idMaterial || !this.salida.idEspecialidad || !this.salida.fechaMovimiento || !this.salida.cantidadSalida) {
      return;
    }

    this.kardex.registrarSalida(this.salida).subscribe({
      next: (x: any) => {
        this.msg = x?.mensaje || 'Salida registrada correctamente.';
        this.salida = {
          idCompra: null,
          idMaterial: null,
          idEspecialidad: null,
          fechaMovimiento: new Date().toISOString().slice(0, 10),
          cantidadSalida: 1,
          observacion: ''
        };
        this.materialesCompraSeleccionada = [];
        this.load();
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo registrar la salida.';
        this.cdr.detectChanges();
      }
    });
  }
  exportarExcel(): void {
    const tabla = document.getElementById('tabla-kardex-export');
    if (!tabla) return;

    const html = `
      <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        ${tabla.outerHTML}
      </body>
      </html>`;

    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kardex-listado.xls';
    a.click();
    window.URL.revokeObjectURL(url);
  }


  private formatDate(value: any): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('es-PE');
  }

  exportarPdf(): void {
    const tabla = document.getElementById('tabla-kardex-export');
    if (!tabla) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
      <head>
        <title>Kardex por especialidad</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Kardex por especialidad</h1>
        ${tabla.outerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  esNuevoGrupo(index: number): boolean {
    if (index === 0) return true;
    const compraActual = this.rowsAgrupadas[index]?.idCompra || this.rowsAgrupadas[index]?.IdCompra || 0;
    const compraAnterior = this.rowsAgrupadas[index - 1]?.idCompra || this.rowsAgrupadas[index - 1]?.IdCompra || 0;
    const especialidadActual = this.rowsAgrupadas[index]?.especialidad || this.rowsAgrupadas[index]?.Especialidad || '';
    const especialidadAnterior = this.rowsAgrupadas[index - 1]?.especialidad || this.rowsAgrupadas[index - 1]?.Especialidad || '';
    return compraActual !== compraAnterior || especialidadActual !== especialidadAnterior;
  }
}
