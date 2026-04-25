import { Component, ChangeDetectorRef, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { PresupuestoService } from '../../core/services/presupuesto.service';
import { ComprasService } from '../../core/services/compras.service';
import { SunatService } from '../../core/services/sunat.service';

type PresupuestoItem = {
  concepto: string;
  soles: number | null;
  dolares: number | null;
};

@Component({
  standalone: true,
  selector: 'app-presupuesto-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuesto.page.html',
  styleUrl: './presupuesto.page.css'
})
export class PresupuestoPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  proyectos: any[] = [];
  msg = '';
  tipoCambioActual = 3.41;

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
    private sunatService: SunatService,
    private cdr: ChangeDetectorRef
  ) {
    this.resetItems();
  }

  ngOnInit(): void {
    this.sunatService.tipoCambio$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const sell_price = this.toNumber(data?.sell_price);
        if (sell_price <= 0) return;

        this.tipoCambioActual = sell_price;

        const terreno = this.form.items.find((x: PresupuestoItem) => this.esTerreno(x));
        if (terreno && this.toNumber(terreno.dolares) > 0) {
          terreno.soles = this.round(this.toNumber(terreno.dolares) * this.tipoCambioActual);
          this.recalcularDependientes();
        }
        this.cdr.detectChanges();
      });
    this.sunatService.loadTipoCambio();

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
      dolares: null
    }));
    this.recalcularDependientes();
  }

  esTerreno(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'TERRENO';
  }

  esAlcabala(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'ALCABALA';
  }

  onDolaresChange(item: PresupuestoItem): void {
    if (!this.esTerreno(item)) {
      item.dolares = null;
      return;
    }
    const dolares = this.toNumber(item.dolares);
    item.soles = this.round(dolares * this.tipoCambioActual);
    this.recalcularDependientes();
  }

  onSolesChange(item: PresupuestoItem): void {
    if (this.esTerreno(item) && this.toNumber(item.dolares) > 0) {
      item.soles = this.round(this.toNumber(item.dolares) * this.tipoCambioActual);
    }
    this.recalcularDependientes();
  }

  private recalcularDependientes(): void {
    const terreno = this.form.items.find((x: PresupuestoItem) => this.esTerreno(x));
    const alcabala = this.form.items.find((x: PresupuestoItem) => this.esAlcabala(x));
    const terrenoSoles = terreno ? this.toNumber(terreno.soles) : 0;

    if (alcabala) {
      alcabala.soles = this.round(terrenoSoles * 0.03);
      alcabala.dolares = 0;
    }
  }

  guardarConfiguracion(): void {
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }

    this.recalcularDependientes();

    const items = (this.form.items || []).map((x: PresupuestoItem, index: number) => {
      const concepto = this.conceptosFijos[index] || String(x.concepto || '').trim();
      const esTerreno = this.esTerreno(x);
      const esAlcabala = this.esAlcabala(x);
      const dolares = esTerreno ? this.toNumber(x.dolares) : 0;
      let soles = this.toNumber(x.soles);

      if (esTerreno && dolares > 0) {
        soles = this.round(dolares * this.tipoCambioActual);
      }

      if (esAlcabala) {
        const terreno = this.form.items.find((it: PresupuestoItem) => this.esTerreno(it));
        soles = this.round(this.toNumber(terreno?.soles) * 0.03);
      }

      return {
        concepto,
        soles,
        dolares
      };
    });

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
            dolares: found ? this.toNumber(found.dolares) : null
          } as PresupuestoItem;
        });

        this.form.items = items.map((x: PresupuestoItem) => ({ ...x }));
        this.recalcularDependientes();

        const totalPresupuesto = this.round(this.form.items.reduce((acc: number, item: PresupuestoItem) => acc + this.toNumber(item.soles), 0));

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
              items: this.form.items.map((x: PresupuestoItem) => ({ ...x }))
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
              items: this.form.items.map((x: PresupuestoItem) => ({ ...x }))
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
    this.recalcularDependientes();
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
