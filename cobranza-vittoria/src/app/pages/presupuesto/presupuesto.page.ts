import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { PresupuestoService } from '../../core/services/presupuesto.service';
import { ComprasService } from '../../core/services/compras.service';

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

  readonly conceptosFijos: string[] = [
    'TERRENO',
    'ALCABALA',
    'CONSTRUCCION (incluir GG e IGV)',
    'UTILIDAD DEL CONSTRUCTOR (en caso de tercerizar la operación)',
    'DEMOLICION',
    'PROYECTO',
    'LICENCIA DE CONSTRUCCION',
    'GASTOS ADMINISTRATIVOS',
    'PUBLICIDAD / COMISION POR VENTAS',
    'INSTALACIONES (LUZ Y AGUA)',
    'CONFORMIDAD DE OBRA',
    'DECLARATORIA DE FABRICA',
    'INDEPENDIZACION',
    'OTROS GASTOS'
  ];

  form = {
    idProyecto: null as number | null,
    items: [] as PresupuestoItem[]
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
    private comprasService: ComprasService,
    private cdr: ChangeDetectorRef
  ) {
    this.resetItems();
  }

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

  private resetItems(): void {
    this.form.items = this.conceptosFijos.map((concepto: string) => ({
      concepto,
      soles: null,
      incidencia: null
    }));
  }

  guardarConfiguracion(): void {
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }

    const items = (this.form.items || []).map((x: PresupuestoItem, index: number) => ({
      concepto: this.conceptosFijos[index] || String(x.concepto || '').trim(),
      soles: this.toNumber(x.soles),
      incidencia: this.toNumber(x.incidencia)
    }));

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
      this.resetItems();
      this.cdr.detectChanges();
      return;
    }

    this.presupuestoService.getByProyecto(Number(this.form.idProyecto)).subscribe({
      next: (row: any) => {
        const apiItems = Array.isArray(row?.items) ? row.items : [];
        const items = this.conceptosFijos.map((concepto: string) => {
          const found = apiItems.find((x: any) => String(x.concepto || '').trim().toUpperCase() === concepto.toUpperCase());
          return {
            concepto,
            soles: found ? this.toNumber(found.soles) : null,
            incidencia: found ? this.toNumber(found.incidencia) : null
          };
        });

        this.form.items = items.map((x: PresupuestoItem) => ({ ...x }));

        const totalPresupuesto = this.round(items.reduce((acc: number, item: PresupuestoItem) => acc + this.toNumber(item.soles), 0));

        this.comprasService.compras().subscribe({
          next: (compras: any[]) => {
            const idProyecto = Number(this.form.idProyecto || 0);
            const nombreProyecto = this.proyectoNombre(idProyecto);
            const totalCompras = this.round((compras || []).reduce((acc: number, x: any) => {
              const sameId = Number(x.idProyecto ?? x.IdProyecto ?? 0) === idProyecto;
              const sameName = String(x.nombreProyecto ?? x.NombreProyecto ?? '').trim().toLowerCase() === String(nombreProyecto || '').trim().toLowerCase();
              if (!sameId && !sameName) return acc;
              return acc + this.toNumber(x.montoTotal ?? x.MontoTotal ?? x.total ?? x.Total);
            }, 0));

            const saldo = this.round(totalPresupuesto - totalCompras);
            const porcentajeConsumido = totalPresupuesto > 0 ? Math.min(100, this.round((totalCompras / totalPresupuesto) * 100)) : 0;
            const porcentajeDisponible = Math.max(0, this.round(100 - porcentajeConsumido));

            this.visualizacion = {
              proyecto: row?.proyecto || this.proyectoNombre(this.form.idProyecto),
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
            const saldo = totalPresupuesto;
            this.visualizacion = {
              proyecto: row?.proyecto || this.proyectoNombre(this.form.idProyecto),
              totalPresupuesto,
              totalCompras: 0,
              saldo,
              porcentajeConsumido: 0,
              porcentajeDisponible: totalPresupuesto > 0 ? 100 : 0,
              items
            };
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.msg = 'No se pudo cargar la visualización del presupuesto.';
        this.cdr.detectChanges();
      }
    });
  }

  totalItemsFormulario(): number {
    return this.round((this.form.items || []).reduce((acc: number, item: PresupuestoItem) => acc + this.toNumber(item.soles), 0));
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
