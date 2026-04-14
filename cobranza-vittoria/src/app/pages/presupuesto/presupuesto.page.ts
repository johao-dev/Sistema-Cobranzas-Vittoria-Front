import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { PresupuestoService } from '../../core/services/presupuesto.service';

type PresupuestoItem = {
  concepto: string;
  soles: number | null;
  incidencia: number | null;
};

@Component({
  standalone: true,
  selector: 'app-presupuesto-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuesto.page.html',
  styleUrl: './presupuesto.page.css'
})
export class PresupuestoPage implements OnInit {
  proyectos: any[] = [];
  msg = '';

  form = {
    idProyecto: null as number | null,
    items: [this.nuevoItem()]
  };

  visualizacion = {
    proyecto: '',
    totalPresupuesto: 0,
    totalCompras: 0,
    saldo: 0,
    porcentajeConsumido: 0,
    porcentajeDisponible: 100,
    items: [] as PresupuestoItem[]
  };

  constructor(
    private maestra: MaestraService,
    private presupuestoService: PresupuestoService,
    private cdr: ChangeDetectorRef
  ) {}

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
  }

  nuevoItem(): PresupuestoItem {
    return { concepto: '', soles: null, incidencia: null };
  }

  agregarItem(): void {
    this.form.items.push(this.nuevoItem());
  }

  eliminarItem(index: number): void {
    if (this.form.items.length === 1) {
      this.form.items[0] = this.nuevoItem();
      return;
    }
    this.form.items.splice(index, 1);
  }

  guardarConfiguracion(): void {
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }

    const items = (this.form.items || [])
      .map((x: PresupuestoItem) => ({
        concepto: String(x.concepto || '').trim(),
        soles: this.toNumber(x.soles),
        incidencia: this.toNumber(x.incidencia)
      }))
      .filter(x => x.concepto || x.soles > 0 || x.incidencia > 0);

    if (!items.length) {
      this.msg = 'Debes registrar al menos un ítem de presupuesto.';
      return;
    }

    if (items.some(x => !x.concepto)) {
      this.msg = 'Todos los ítems deben tener concepto.';
      return;
    }

    this.presupuestoService.guardar({ idProyecto: Number(this.form.idProyecto), items }).subscribe({
      next: () => {
        this.msg = 'Configuración inicial guardada correctamente.';
        this.cargarVisualizacion();
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo guardar la configuración.';
        this.cdr.detectChanges();
      }
    });
  }

  cargarVisualizacion(): void {
    if (!this.form.idProyecto) {
      this.visualizacion = {
        proyecto: '', totalPresupuesto: 0, totalCompras: 0, saldo: 0, porcentajeConsumido: 0, porcentajeDisponible: 100, items: []
      };
      this.cdr.detectChanges();
      return;
    }

    this.presupuestoService.getByProyecto(Number(this.form.idProyecto)).subscribe({
      next: (row: any) => {
        if (!row) {
          this.visualizacion = {
            proyecto: this.proyectoNombre(this.form.idProyecto),
            totalPresupuesto: 0,
            totalCompras: 0,
            saldo: 0,
            porcentajeConsumido: 0,
            porcentajeDisponible: 100,
            items: []
          };
          this.cdr.detectChanges();
          return;
        }

        const items = Array.isArray(row.items) ? row.items.map((x: any) => ({
          concepto: String(x.concepto || ''),
          soles: this.toNumber(x.soles),
          incidencia: this.toNumber(x.incidencia)
        })) : [];

        this.form.idProyecto = Number(row.idProyecto || this.form.idProyecto);
        this.form.items = items.length ? items.map((x: any) => ({ ...x })) : [this.nuevoItem()];

        const totalPresupuesto = this.toNumber(row.totalPresupuesto);
        const totalCompras = this.toNumber(row.totalCompras);
        const saldo = this.toNumber(row.saldo);
        const porcentajeConsumido = totalPresupuesto > 0 ? Math.min(100, this.round((totalCompras / totalPresupuesto) * 100)) : 0;
        const porcentajeDisponible = Math.max(0, this.round(100 - porcentajeConsumido));

        this.visualizacion = {
          proyecto: row.proyecto || this.proyectoNombre(this.form.idProyecto),
          totalPresupuesto,
          totalCompras,
          saldo,
          porcentajeConsumido,
          porcentajeDisponible,
          items
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.msg = 'No se pudo cargar la visualización del presupuesto.';
        this.cdr.detectChanges();
      }
    });
  }

  totalItemsFormulario(): number {
    return this.round((this.form.items || []).reduce((acc: number, item: any) => acc + this.toNumber(item.soles), 0));
  }

  proyectoNombre(idProyecto: number | null): string {
    return this.proyectos.find((x: any) => Number(x.idProyecto) === Number(idProyecto))?.nombreProyecto || 'Sin proyecto';
  }

  private toNumber(value: any): number {
    return this.round(Number(value || 0));
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
