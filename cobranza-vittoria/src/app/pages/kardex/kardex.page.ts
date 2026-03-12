import { Component, OnInit } from '@angular/core';
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
  especialidades: any[] = [];
  materiales: any[] = [];

  filtros = {
    idMaterial: null as number | null,
    idEspecialidad: null as number | null,
    fechaDesde: '',
    fechaHasta: ''
  };

  constructor(
    private kardex: KardexService,
    private maestra: MaestraService
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.load();
  }

  loadCatalogos(): void {
    this.maestra.materiales(true).subscribe({ next: (x: any) => this.materiales = x ?? [], error: () => this.materiales = [] });
    this.maestra.especialidades(true).subscribe({ next: (x: any) => this.especialidades = x ?? [], error: () => this.especialidades = [] });
  }

  load(): void {
    this.kardex.movimientos({
      idMaterial: this.filtros.idMaterial,
      idEspecialidad: this.filtros.idEspecialidad,
      fechaDesde: this.filtros.fechaDesde || null,
      fechaHasta: this.filtros.fechaHasta || null
    }).subscribe({
      next: (x: any) => {
        const data = x || [];
        this.rows = [...data].sort((a: any, b: any) => {
          const ea = (a.especialidad || a.Especialidad || '').toString();
          const eb = (b.especialidad || b.Especialidad || '').toString();
          if (ea < eb) return -1;
          if (ea > eb) return 1;
          const fa = (a.fechaMovimiento || a.FechaMovimiento || '').toString();
          const fb = (b.fechaMovimiento || b.FechaMovimiento || '').toString();
          return fa.localeCompare(fb);
        });
      },
      error: () => this.rows = []
    });
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
    const actual = this.rows[index]?.especialidad || this.rows[index]?.Especialidad || '';
    const anterior = this.rows[index - 1]?.especialidad || this.rows[index - 1]?.Especialidad || '';
    return actual !== anterior;
  }
}
