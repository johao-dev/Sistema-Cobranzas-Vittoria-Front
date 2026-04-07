import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { ValorizacionesService } from '../../core/services/valorizaciones.service';

type DetraccionOption = {
  value: string;
  label: string;
  porcentaje: number;
};

@Component({
  standalone: true,
  selector: 'app-valorizaciones-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './valorizaciones.page.html',
  styleUrl: './valorizaciones.page.css'
})
export class ValorizacionesPage implements OnInit {
  proyectos: any[] = [];
  proveedores: any[] = [];
  especialidades: any[] = [];
  configuraciones: any[] = [];
  rows: any[] = [];
  detalle: any[] = [];
  resumen: any = null;
  cabecera: any = null;
  configuracionEnUso: any = null;
  filtros: any = { idProyecto: null, idProveedor: null, idEspecialidad: null };

  detraccionOptions: DetraccionOption[] = [
    { value: 'Contratos', label: 'Contratos (4%)', porcentaje: 0.04 },
    { value: 'Arrendamiento', label: 'Arrendamiento (10%)', porcentaje: 0.10 },
    { value: 'OtrosServicios', label: 'Otros servicios (12%)', porcentaje: 0.12 }
  ];

  formConfiguracion: any = {
    idConfiguracion: null,
    idProyecto: null,
    idProveedor: null,
    idEspecialidad: null,
    moneda: 'PEN',
    montoCotizacion: null,
    usuario: 'system'
  };

  formValorizacion: any = {
    idValorizacion: null,
    idConfiguracion: null,
    periodo: '',
    observacion: '',
    usuario: 'system'
  };

  formDetalle: any = this.detalleVacio();

  modalAdjuntarOpen = false;
  modalAdjuntarDetalle: any = null;
  modalAdjuntarFiles: File[] = [];
  msg = '';
  cargando = false;

  constructor(private maestra: MaestraService, private valorizaciones: ValorizacionesService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarConfiguraciones();
    this.cargarValorizaciones();
  }

  get monedaActual(): string {
    return this.cabecera?.moneda || this.configuracionEnUso?.moneda || this.formConfiguracion.moneda || 'PEN';
  }

  get porcentajeGarantiaActual(): number {
    return Number(this.cabecera?.porcentajeGarantia ?? this.configuracionEnUso?.porcentajeGarantia ?? 0.05);
  }

  get porcentajeDetraccionActual(): number {
    return Number(this.formDetalle.porcentajeDetraccion ?? 0);
  }

  get montoDetraccionCalculado(): number {
    return this.redondear(Number(this.formDetalle.montoFactura || 0) * this.porcentajeDetraccionActual);
  }

  get montoGarantiaCalculado(): number {
    return this.formDetalle.aplicaGarantia
      ? this.redondear(Number(this.formDetalle.montoFactura || 0) * this.porcentajeGarantiaActual)
      : 0;
  }

  get montoAAbonarCalculado(): number {
    return this.redondear(
      Number(this.formDetalle.montoFactura || 0) -
      this.montoDetraccionCalculado -
      this.montoGarantiaCalculado -
      Number(this.formDetalle.otrosDescuentos || 0)
    );
  }

  get resumenFacturas(): any[] {
    return Array.isArray(this.resumen?.facturas) ? this.resumen.facturas : [];
  }

  cargarCatalogos(): void {
    this.maestra.proyectos(true).subscribe(x => { this.proyectos = x || []; this.cdr.detectChanges(); });
    this.maestra.proveedores(true).subscribe(x => { this.proveedores = x || []; this.cdr.detectChanges(); });
    this.maestra.especialidades(true).subscribe(x => { this.especialidades = x || []; this.cdr.detectChanges(); });
  }

  cargarConfiguraciones(): void {
    this.valorizaciones.configuraciones(this.filtros).subscribe({
      next: x => {
        this.configuraciones = (x || []).map((r: any) => this.mapConfiguracion(r));
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo listar configuraciones.';
        this.cdr.detectChanges();
      }
    });
  }

  cargarValorizaciones(): void {
    this.valorizaciones.valorizaciones(this.filtros).subscribe({
      next: x => {
        this.rows = x || [];
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo listar valorizaciones.';
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltros(): void {
    this.cargarConfiguraciones();
    this.cargarValorizaciones();
  }

  editarConfiguracion(row: any): void {
    this.formConfiguracion = {
      idConfiguracion: row.idConfiguracion,
      idProyecto: row.idProyecto,
      idProveedor: row.idProveedor,
      idEspecialidad: row.idEspecialidad,
      moneda: row.moneda || 'PEN',
      montoCotizacion: row.montoCotizacion,
      usuario: 'system'
    };
  }

  guardarConfiguracion(): void {
    const payload = {
      idConfiguracion: this.toNullableNumber(this.formConfiguracion.idConfiguracion),
      idProyecto: this.toRequiredNumber(this.formConfiguracion.idProyecto),
      idProveedor: this.toRequiredNumber(this.formConfiguracion.idProveedor),
      idEspecialidad: this.toRequiredNumber(this.formConfiguracion.idEspecialidad),
      moneda: String(this.formConfiguracion.moneda || 'PEN').trim(),
      montoCotizacion: Number(this.formConfiguracion.montoCotizacion || 0),
      usuario: 'system'
    };

    if (!payload.idProyecto || !payload.idProveedor || !payload.idEspecialidad) {
      this.msg = 'Debes seleccionar proyecto, proveedor y especialidad.';
      return;
    }
    if (!payload.montoCotizacion || payload.montoCotizacion <= 0) {
      this.msg = 'Debes ingresar una cotización mayor a cero.';
      return;
    }

    this.valorizaciones.guardarConfiguracion(payload).subscribe({
      next: (resp: any) => {
        const idConfiguracion = resp?.idConfiguracion ?? payload.idConfiguracion;
        this.msg = 'Configuración guardada correctamente.';
        this.formConfiguracion = {
          idConfiguracion: null,
          idProyecto: null,
          idProveedor: null,
          idEspecialidad: null,
          moneda: 'PEN',
          montoCotizacion: null,
          usuario: 'system'
        };
        this.cargarConfiguraciones();
        this.cargarValorizaciones();
        if (idConfiguracion) {
          setTimeout(() => {
            const cfg = this.configuraciones.find(x => Number(x.idConfiguracion) === Number(idConfiguracion));
            if (cfg) this.usarConfiguracion(cfg);
          }, 250);
        }
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo guardar la configuración.';
        this.cdr.detectChanges();
      }
    });
  }

  usarConfiguracion(row: any): void {
    this.configuracionEnUso = row;
    this.formValorizacion = {
      idValorizacion: null,
      idConfiguracion: row.idConfiguracion,
      periodo: this.defaultPeriodo(),
      observacion: '',
      usuario: 'system'
    };

    this.cabecera = {
      idConfiguracion: row.idConfiguracion,
      proyecto: row.proyecto,
      proveedor: row.proveedor,
      especialidad: row.especialidad,
      moneda: row.moneda,
      cotizacion: row.montoCotizacion,
      montoCotizacion: row.montoCotizacion,
      porcentajeGarantia: row.porcentajeGarantia,
      porcentajeDetraccion: row.porcentajeDetraccion
    };

    this.detalle = [];
    this.resumen = this.buildResumenInicial(row);
    this.formDetalle = this.detalleVacio();
    this.onTipoDetraccionChange();

    const existente = this.buscarValorizacionExistente(row);
    if (existente?.idValorizacion) {
      this.ver(Number(existente.idValorizacion));
      return;
    }

    this.guardarValorizacionInterna(true);
  }

  guardarValorizacionInterna(silencioso = false, onDone?: (idValorizacion: number) => void): void {
    const payload = {
      idValorizacion: this.toNullableNumber(this.formValorizacion.idValorizacion),
      idConfiguracion: this.toRequiredNumber(this.formValorizacion.idConfiguracion),
      periodo: String(this.formValorizacion.periodo || '').trim(),
      observacion: String(this.formValorizacion.observacion || '').trim(),
      usuario: 'system'
    };

    if (!payload.idConfiguracion) {
      this.msg = 'Debes usar una configuración primero.';
      return;
    }
    if (!payload.periodo) {
      this.formValorizacion.periodo = this.defaultPeriodo();
      payload.periodo = this.formValorizacion.periodo;
    }

    this.valorizaciones.guardarValorizacion(payload).subscribe({
      next: (resp: any) => {
        const idValorizacion = Number(resp?.idValorizacion ?? resp?.IdValorizacion ?? resp?.id ?? 0);
        if (!idValorizacion) {
          this.msg = 'No se pudo resolver la valorización activa.';
          this.cdr.detectChanges();
          return;
        }

        this.formValorizacion.idValorizacion = idValorizacion;
        this.formDetalle.idValorizacion = idValorizacion;

        if (!silencioso) this.msg = 'Valorización preparada correctamente.';

        this.ver(idValorizacion);
        this.cargarValorizaciones();
        onDone?.(idValorizacion);
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo preparar la valorización.';
        this.cdr.detectChanges();
      }
    });
  }

  ver(idValorizacion: number): void {
    this.cargando = true;
    this.valorizaciones.valorizacion(idValorizacion).subscribe({
      next: (resp: any) => {
        this.cabecera = resp?.cabecera || null;
        this.detalle = resp?.detalle || [];
        this.resumen = resp?.resumen || null;
        this.formValorizacion = {
          idValorizacion: this.cabecera?.idValorizacion || idValorizacion,
          idConfiguracion: this.cabecera?.idConfiguracion || this.configuracionEnUso?.idConfiguracion || null,
          periodo: this.cabecera?.periodo || this.formValorizacion.periodo || this.defaultPeriodo(),
          observacion: this.cabecera?.observacion || '',
          usuario: 'system'
        };

        if (!this.configuracionEnUso && this.cabecera?.idConfiguracion) {
          this.configuracionEnUso = this.configuraciones.find(x => Number(x.idConfiguracion) === Number(this.cabecera.idConfiguracion)) || null;
        }

        this.formDetalle = this.detalleVacio(idValorizacion);
        this.onTipoDetraccionChange();
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo obtener la valorización.';
        this.cdr.detectChanges();
      },
      complete: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  onDetalleMontoFacturaChange(): void {
    this.syncDetalleCalculados();
  }

  onDetalleReglasChange(): void {
    this.syncDetalleCalculados();
  }

  onTipoDetraccionChange(): void {
    const selected = this.detraccionOptions.find(x => x.value === this.formDetalle.tipoDetraccion) || this.detraccionOptions[0];
    this.formDetalle.porcentajeDetraccion = selected.porcentaje;
    this.syncDetalleCalculados();
  }

  guardarDetalle(): void {
    if (!this.formValorizacion.idConfiguracion) {
      this.msg = 'Debes usar una configuración antes de registrar facturas.';
      return;
    }

    const continuar = () => {
      const payload = {
        idDetalle: this.toNullableNumber(this.formDetalle.idDetalle),
        idValorizacion: this.toRequiredNumber(this.formValorizacion.idValorizacion),
        fechaFactura: this.formDetalle.fechaFactura || null,
        numeroFactura: String(this.formDetalle.numeroFactura || '').trim(),
        montoFactura: Number(this.formDetalle.montoFactura || 0),
        descripcion: String(this.formDetalle.descripcion || '').trim(),
        otrosDescuentos: Number(this.formDetalle.otrosDescuentos || 0),
        fechaTransferencia: this.formDetalle.fechaTransferencia || null,
        numeroOperacion: '',
        bancoTransferencia: '',
        bancoDestino: '',
        montoTransferido: Number(this.formDetalle.montoTransferido || 0),
        tipoDetraccion: this.formDetalle.tipoDetraccion,
        porcentajeDetraccionAplicado: this.porcentajeDetraccionActual,
        porcentajeGarantiaAplicado: this.formDetalle.aplicaGarantia ? this.porcentajeGarantiaActual : 0,
        usuario: 'system'
      };

      if (!payload.idValorizacion) {
        this.msg = 'No se pudo resolver la valorización activa.';
        return;
      }
      if (!payload.numeroFactura) {
        this.msg = 'Debes ingresar el número de factura.';
        return;
      }
      if (!payload.montoFactura || payload.montoFactura <= 0) {
        this.msg = 'Debes ingresar el monto de factura.';
        return;
      }

      this.valorizaciones.guardarDetalle(payload).subscribe({
        next: () => {
          this.msg = 'Factura registrada correctamente.';
          this.ver(payload.idValorizacion);
          this.cdr.detectChanges();
        },
        error: e => {
          this.msg = e?.error?.message || 'No se pudo guardar la factura.';
          this.cdr.detectChanges();
        }
      });
    };

    if (this.formValorizacion.idValorizacion) {
      continuar();
      return;
    }

    this.guardarValorizacionInterna(true, () => continuar());
  }

  eliminarFactura(row: any): void {
    const idDetalle = Number(row?.idDetalle || 0);
    if (!idDetalle) return;
    if (!confirm('¿Eliminar físicamente la factura registrada? Esta acción no se puede deshacer.')) return;

    this.valorizaciones.eliminarDetalle(idDetalle).subscribe({
      next: () => {
        this.msg = 'Factura eliminada correctamente.';
        if (this.formValorizacion.idValorizacion) this.ver(this.formValorizacion.idValorizacion);
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo eliminar la factura.';
        this.cdr.detectChanges();
      }
    });
  }

  abrirAdjuntarFacturas(row: any): void {
    this.modalAdjuntarDetalle = row;
    this.modalAdjuntarFiles = [];
    this.modalAdjuntarOpen = true;
  }

  cerrarAdjuntarFacturas(): void {
    this.modalAdjuntarOpen = false;
    this.modalAdjuntarDetalle = null;
    this.modalAdjuntarFiles = [];
  }

  onModalArchivosSelected(event: any): void {
    const files = Array.from(event?.target?.files || []) as File[];
    this.modalAdjuntarFiles = files.filter((f: File) => f.name.toLowerCase().endsWith('.pdf'));
  }

  guardarAdjuntarFacturas(): void {
    const idDetalle = this.modalAdjuntarDetalle?.idDetalle;
    if (!idDetalle || !this.modalAdjuntarFiles.length) {
      this.msg = 'Debes seleccionar al menos un PDF.';
      return;
    }

    this.valorizaciones.uploadDetalleArchivos(Number(idDetalle), this.modalAdjuntarFiles).subscribe({
      next: () => {
        this.msg = 'Facturas adjuntas correctamente.';
        if (this.formValorizacion.idValorizacion) this.ver(this.formValorizacion.idValorizacion);
        this.cerrarAdjuntarFacturas();
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudieron adjuntar las facturas.';
        this.cdr.detectChanges();
      }
    });
  }

  downloadArchivo(row: any, archivo: any): void {
    const idDetalle = row?.idDetalle;
    const idArchivo = archivo?.idArchivo;
    if (!idDetalle || !idArchivo) return;
    window.open(this.valorizaciones.downloadDetalleArchivoUrl(Number(idDetalle), Number(idArchivo)), '_blank');
  }

  formatMoney(value: any, moneda?: string): string {
    const number = Number(value || 0);
    const code = (moneda || this.monedaActual || 'PEN').toUpperCase() === 'USD' ? 'USD' : 'PEN';
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }

  limpiarConfiguracion(): void {
    this.formConfiguracion = {
      idConfiguracion: null,
      idProyecto: null,
      idProveedor: null,
      idEspecialidad: null,
      moneda: 'PEN',
      montoCotizacion: null,
      usuario: 'system'
    };
  }

  detraccionLabel(tipo: string | null | undefined): string {
    return this.detraccionOptions.find(x => x.value === tipo)?.label || 'Contratos (4%)';
  }

  private defaultPeriodo(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private detalleVacio(idValorizacion: number | null = null): any {
    return {
      idDetalle: null,
      idValorizacion,
      fechaFactura: '',
      numeroFactura: '',
      montoFactura: null,
      descripcion: '',
      tipoDetraccion: 'Contratos',
      porcentajeDetraccion: 0.04,
      aplicaGarantia: true,
      fechaTransferencia: '',
      montoTransferido: 0,
      otrosDescuentos: 0
    };
  }

  private toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toRequiredNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private redondear(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private syncDetalleCalculados(): void {
    this.formDetalle.montoTransferido = this.montoAAbonarCalculado;
  }

  private buildResumenInicial(source?: any): any {
    return {
      cotizacion: Number(source?.montoCotizacion ?? source?.cotizacion ?? this.cabecera?.cotizacion ?? 0),
      facturas: []
    };
  }

  private buscarValorizacionExistente(configuracion: any): any | null {
    if (!configuracion) return null;

    const matches = this.rows.filter((row: any) =>
      String(row?.proyecto || '').trim().toLowerCase() === String(configuracion?.proyecto || '').trim().toLowerCase() &&
      String(row?.proveedor || '').trim().toLowerCase() === String(configuracion?.proveedor || '').trim().toLowerCase() &&
      String(row?.especialidad || '').trim().toLowerCase() === String(configuracion?.especialidad || '').trim().toLowerCase()
    );

    if (!matches.length) return null;

    return matches.sort((a: any, b: any) => Number(b.idValorizacion || 0) - Number(a.idValorizacion || 0))[0];
  }

  private mapConfiguracion(x: any): any {
    return {
      idConfiguracion: x?.idConfiguracion ?? x?.idProveedorEspecialidadCotizacion ?? null,
      idProyecto: x?.idProyecto ?? null,
      proyecto: x?.proyecto ?? x?.nombreProyecto ?? '',
      idProveedor: x?.idProveedor ?? null,
      proveedor: x?.proveedor ?? x?.razonSocial ?? '',
      idEspecialidad: x?.idEspecialidad ?? null,
      especialidad: x?.especialidad ?? x?.nombreEspecialidad ?? '',
      moneda: x?.moneda ?? 'PEN',
      montoCotizacion: Number(x?.montoCotizacion ?? 0),
      porcentajeGarantia: Number(x?.porcentajeGarantia ?? 0.05),
      porcentajeDetraccion: Number(x?.porcentajeDetraccion ?? 0.04)
    };
  }
}
