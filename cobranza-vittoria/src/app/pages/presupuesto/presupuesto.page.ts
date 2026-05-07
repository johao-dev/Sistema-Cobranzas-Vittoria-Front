
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
    'ANTEPROYECTO',
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
        const sellPrice = this.toNumber(data?.sell_price);
        if (sellPrice <= 0) return;
        this.tipoCambioActual = sellPrice;

        this.recalcularDependientes();
        this.cdr.detectChanges();
      });
    this.sunatService.consultarTipoCambio();

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

  onProyectoChange(): void {
    this.cargarVisualizacion();
  }

  esTerreno(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'TERRENO';
  }

  esAlcabala(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'ALCABALA';
  }

  esProyecto(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'PROYECTO';
  }

  esAnteproyecto(item: PresupuestoItem): boolean {
    return String(item?.concepto || '').trim().toUpperCase() === 'ANTEPROYECTO';
  }

  esSoloLectura(item: PresupuestoItem): boolean {
    const c = String(item?.concepto || '').trim().toUpperCase();
    return ['TERRENO', 'ALCABALA', 'PROYECTO', 'ANTEPROYECTO', 'LICENCIA DE CONSTRUCCION', 'GASTOS ADMINISTRATIVOS', 'PUBLICIDAD / COMISION POR VENTAS', 'INSTALACIONES (LUZ Y AGUA)', 'CONFORMIDAD DE OBRA', 'DECLARATORIA DE FABRICA', 'INDEPENDIZACION', 'OTROS GASTOS'].includes(c);
  }

  onDolaresChange(item: PresupuestoItem): void {
    if (this.esSoloLectura(item)) return;
    const dolares = this.toNumber(item.dolares);
    item.soles = dolares > 0 ? this.round(dolares * this.tipoCambioActual) : null;
    this.recalcularDependientes();
  }

  onSolesChange(item: PresupuestoItem): void {
    if (this.esSoloLectura(item)) return;
    const soles = this.toNumber(item.soles);
    item.dolares = soles > 0 ? this.round(soles / this.tipoCambioActual) : null;
    this.recalcularDependientes();
  }

  private recalcularDependientes(): void {
    const proyecto = this.form.items.find((x: PresupuestoItem) => this.esProyecto(x));
    const anteproyecto = this.form.items.find((x: PresupuestoItem) => this.esAnteproyecto(x));
    const licencia = this.form.items.find((x: PresupuestoItem) => String(x?.concepto || '').trim().toUpperCase() === 'LICENCIA DE CONSTRUCCION');
    if (licencia) {
      licencia.soles = this.round(this.toNumber(proyecto?.soles) + this.toNumber(anteproyecto?.soles));
      licencia.dolares = this.round(this.toNumber(proyecto?.dolares) + this.toNumber(anteproyecto?.dolares));
    }
  }

  private cargarMontosDesdeTerreno(idProyecto: number): void {
    // Los montos automáticos ahora vienen desde la API de presupuesto.
  }

  guardarConfiguracion(): void {
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }

    this.completarDolaresManual();
    this.recalcularDependientes();

    const items = (this.form.items || []).map((x: PresupuestoItem, index: number) => {
      const concepto = this.conceptosFijos[index] || String(x.concepto || '').trim();
      const dolares = this.toNumber(x.dolares);
      const soles = this.toNumber(x.soles);
      return { concepto, soles, dolares };
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
        proyecto: '',
        totalPresupuesto: 0,
        totalCompras: 0,
        saldo: 0,
        porcentajeConsumido: 0,
        porcentajeDisponible: 100,
        items: []
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
        this.cargarMontosDesdeTerreno(Number(this.form.idProyecto));
        this.completarDolaresManual();
        this.recalcularDependientes();

        const totalPresupuesto = this.round(this.form.items.reduce((acc: number, item: PresupuestoItem) => acc + this.toNumber(item.soles), 0));
        const totalCompras = this.toNumber(row?.totalCompras ?? row?.TotalCompras);
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
        this.msg = 'No se pudo cargar la visualización del presupuesto.';
        this.cdr.detectChanges();
      }
    });
  }


  private completarDolaresManual(): void {
    for (const item of this.form.items || []) {
      if (this.esSoloLectura(item)) continue;
      const soles = this.toNumber(item.soles);
      const dolares = this.toNumber(item.dolares);
      if (soles > 0 && dolares <= 0 && this.tipoCambioActual > 0) {
        item.dolares = this.round(soles / this.tipoCambioActual);
      }
      if (dolares > 0 && soles <= 0 && this.tipoCambioActual > 0) {
        item.soles = this.round(dolares * this.tipoCambioActual);
      }
    }
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
