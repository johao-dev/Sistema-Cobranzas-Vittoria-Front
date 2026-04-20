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
  filtros: any = { idProyecto: null, idProveedor: null, idEspecialidad: null };

  detraccionOptions: DetraccionOption[] = [
    { value: 'SinDetraccion', label: 'Sin detracción', porcentaje: 0 },
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
    periodo: '',
    observacion: '',
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
    return this.cabecera?.moneda || this.formConfiguracion.moneda || 'PEN';
  }

  get porcentajeGarantiaActual(): number {
    return Number(this.cabecera?.porcentajeGarantia ?? 0.05);
  }

  get porcentajeDetraccionActual(): number {
    return Number(this.formDetalle.porcentajeDetraccion ?? 0);
  }

  get montoDetraccionCalculado(): number {
    return this.redondear(Number(this.formDetalle.montoFactura || 0) * this.porcentajeDetraccionActual);
  }

  get montoGarantiaCalculado(): number {
    return this.formDetalle.aplicaGarantia
      ? this.redondear(Number(this.formDetalle.montoFactura || 0) * this.porcentajeGarantiaActual) : 0;
  }

  get montoAAbonarCalculado(): number {
    return this.redondear(Number(this.formDetalle.montoFactura || 0) - this.montoDetraccionCalculado - this.montoGarantiaCalculado - Number(this.formDetalle.otrosDescuentos || 0));
  }

  get configuracionActiva(): any | null {
    const id = this.formValorizacion.idConfiguracion || this.cabecera?.idConfiguracion;
    return this.configuraciones.find(x => Number(x.idConfiguracion) === Number(id)) || null;
  }

  get resumenFacturas(): any[] {
    return Array.isArray(this.resumen?.facturas) ? this.resumen.facturas : [];
  }

  get resumenTotales(): any {
    const cotizacion = Number(this.resumen?.cotizacion ?? this.cabecera?.cotizacion ?? 0);
    const garantia = this.redondear(cotizacion * 0.05);
    const facturado = this.redondear((this.detalle || []).reduce((acc: number, row: any) => acc + Number(row?.montoFactura || 0), 0));
    const transferido = this.redondear((this.detalle || []).reduce((acc: number, row: any) => acc + Number(row?.montoTransferido || 0), 0));
    const resta = this.redondear(cotizacion - facturado);
    return { cotizacion, garantia, facturado, transferido, resta };
  }


  cargarCatalogos(): void {
    this.maestra.proyectos(true).subscribe(x => { this.proyectos = x || []; this.cdr.detectChanges(); });
    this.maestra.proveedores(true).subscribe(x => { this.proveedores = x || []; this.cdr.detectChanges(); });
    this.maestra.especialidades(true).subscribe(x => { this.especialidades = x || []; this.cdr.detectChanges(); });
  }

  cargarConfiguraciones(): void {
    this.valorizaciones.configuraciones(this.filtros).subscribe({
      next: x => { this.configuraciones = (x || []).map((r: any) => this.mapConfiguracion(r)); this.cdr.detectChanges(); },
      error: e => { this.msg = e?.error?.message || 'No se pudo listar configuraciones.'; this.cdr.detectChanges(); }
    });
  }

  cargarValorizaciones(): void {
    this.valorizaciones.valorizaciones(this.filtros).subscribe({
      next: x => { this.rows = x || []; this.cdr.detectChanges(); },
      error: e => { this.msg = e?.error?.message || 'No se pudo listar valorizaciones.'; this.cdr.detectChanges(); }
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
      periodo: this.formConfiguracion.periodo || '',
      observacion: this.formConfiguracion.observacion || '',
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

    if (!payload.idProyecto || !payload.idProveedor || !payload.idEspecialidad) { this.msg = 'Debes seleccionar proyecto, proveedor y especialidad.'; return; }
    if (!payload.montoCotizacion || payload.montoCotizacion <= 0) { this.msg = 'Debes ingresar una cotización mayor a cero.'; return; }

    this.valorizaciones.guardarConfiguracion(payload).subscribe({
      next: () => {
        this.msg = 'Configuración guardada correctamente.';
        this.formConfiguracion = { idConfiguracion: null, idProyecto: null, idProveedor: null, idEspecialidad: null, moneda: 'PEN', montoCotizacion: null, periodo: '', observacion: '', usuario: 'system' };
        this.formValorizacion = { idValorizacion: null, idConfiguracion: null, periodo: this.defaultPeriodo(), observacion: '', usuario: 'system' };
        this.cargarConfiguraciones();
        this.cdr.detectChanges();
      },
      error: e => { this.msg = e?.error?.message || 'No se pudo guardar la configuración.'; this.cdr.detectChanges(); }
    });
  }

  onConfiguracionSeleccionada() {
    const cfg = this.configuracionActiva;
    if (!cfg) return;
    this.cabecera = {
      idConfiguracion: cfg.idConfiguracion,
      proyecto: cfg.proyecto,
      proveedor: cfg.proveedor,
      especialidad: cfg.especialidad,
      moneda: cfg.moneda,
      cotizacion: cfg.montoCotizacion,
      montoCotizacion: cfg.montoCotizacion,
      porcentajeGarantia: cfg.porcentajeGarantia,
      porcentajeDetraccion: cfg.porcentajeDetraccion
    };
    if (!this.formValorizacion.periodo) this.formValorizacion.periodo = this.defaultPeriodo();
    this.resumen = this.buildResumenInicial(cfg);
    this.detalle = [];
    this.formDetalle = this.detalleVacio(this.toNullableNumber(this.formValorizacion.idValorizacion));
    this.syncDetalleCalculados();
  }

  crearDesdeConfiguracion(row: any) {
    this.formValorizacion = {
      idValorizacion: null,
      idConfiguracion: row.idConfiguracion,
      periodo: this.formConfiguracion.periodo || this.defaultPeriodo(),
      observacion: this.formConfiguracion.observacion || '',
      usuario: 'system'
    };
    this.onConfiguracionSeleccionada();
    this.detalle = [];
    this.resumen = this.buildResumenInicial(row);
    this.formDetalle = this.detalleVacio();
    this.syncDetalleCalculados();
  }

  guardarValorizacion(): void {
    const payload = {
      idValorizacion: this.toNullableNumber(this.formValorizacion.idValorizacion),
      idConfiguracion: this.toRequiredNumber(this.formValorizacion.idConfiguracion),
      periodo: String(this.formValorizacion.periodo || '').trim(),
      observacion: String(this.formValorizacion.observacion || '').trim(),
      usuario: 'system'
    };

    if (!payload.idConfiguracion) { this.msg = 'Debes seleccionar o usar una configuración.'; return; }
    if (!payload.periodo) { this.msg = 'Debes ingresar el periodo.'; return; }

    this.valorizaciones.guardarValorizacion(payload).subscribe({
      next: (resp: any) => {
        const idValorizacion = resp?.idValorizacion ?? resp?.IdValorizacion ?? resp?.id;
        this.msg = 'Valorización guardada correctamente.';
        if (idValorizacion) {
          this.formValorizacion.idValorizacion = idValorizacion;
          this.formDetalle.idValorizacion = idValorizacion;
          this.ver(idValorizacion);
        }
        this.cargarValorizaciones();
        this.cdr.detectChanges();
      },
      error: e => { this.msg = e?.error?.message || 'No se pudo guardar la valorización.'; this.cdr.detectChanges(); }
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
          idConfiguracion: this.cabecera?.idConfiguracion || null,
          periodo: this.cabecera?.periodo || '',
          observacion: this.cabecera?.observacion || '',
          usuario: 'system'
        };
        this.formDetalle = this.detalleVacio(idValorizacion);
        this.syncDetalleCalculados();
        this.cdr.detectChanges();
      },
      error: e => { this.msg = e?.error?.message || 'No se pudo obtener la valorización.'; this.cdr.detectChanges(); },
      complete: () => { this.cargando = false; this.cdr.detectChanges(); }
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
    if (!this.formValorizacion.idConfiguracion) { this.msg = 'Primero usa una configuración.'; return; }
    if (!Number(this.formDetalle.montoFactura || 0)) { this.msg = 'Debes ingresar el monto de factura.'; return; }

    const guardarConId = (idValorizacion: number) => {
      const payload = {
        idDetalle: this.toNullableNumber(this.formDetalle.idDetalle),
        idValorizacion,
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
        porcentajeDetraccionAplicado: this.detraccionOptions.find(x => x.value === this.formDetalle.tipoDetraccion)?.porcentaje ?? 0,
        porcentajeGarantiaAplicado: this.formDetalle.aplicaGarantia ? this.porcentajeGarantiaActual : 0,
        usuario: 'system'
      };

      this.valorizaciones.guardarDetalle(payload).subscribe({
        next: () => {
          this.msg = 'Detalle guardado correctamente.';
          this.ver(idValorizacion);
          this.cdr.detectChanges();
        },
        error: e => { this.msg = e?.error?.message || 'No se pudo guardar el detalle.'; this.cdr.detectChanges(); }
      });
    };

    const idActual = this.toRequiredNumber(this.formValorizacion.idValorizacion);
    if (idActual) {
      guardarConId(idActual);
      return;
    }

    const payloadValorizacion = {
      idValorizacion: null,
      idConfiguracion: this.toRequiredNumber(this.formValorizacion.idConfiguracion),
      periodo: String(this.formValorizacion.periodo || this.formConfiguracion.periodo || this.defaultPeriodo()).trim(),
      observacion: String(this.formValorizacion.observacion || this.formConfiguracion.observacion || '').trim(),
      usuario: 'system'
    };

    this.valorizaciones.guardarValorizacion(payloadValorizacion).subscribe({
      next: (resp: any) => {
        const idValorizacion = Number(resp?.idValorizacion ?? resp?.IdValorizacion ?? resp?.id ?? 0);
        if (!idValorizacion) {
          this.msg = 'No se pudo crear la valorización base.';
          this.cdr.detectChanges();
          return;
        }
        this.formValorizacion.idValorizacion = idValorizacion;
        this.formDetalle.idValorizacion = idValorizacion;
        guardarConId(idValorizacion);
      },
      error: e => { this.msg = e?.error?.message || 'No se pudo crear la valorización base.'; this.cdr.detectChanges(); }
    });
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
      error: e => { this.msg = e?.error?.message || 'No se pudo eliminar la factura.'; this.cdr.detectChanges(); }
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
    if (!idDetalle || !this.modalAdjuntarFiles.length) { this.msg = 'Debes seleccionar al menos un PDF.'; return; }

    this.valorizaciones.uploadDetalleArchivos(Number(idDetalle), this.modalAdjuntarFiles).subscribe({
      next: () => {
        this.msg = 'Facturas adjuntas correctamente.';
        if (this.formValorizacion.idValorizacion) this.ver(this.formValorizacion.idValorizacion);
        this.cerrarAdjuntarFacturas();
        this.cdr.detectChanges();
      },
      error: e => { this.msg = e?.error?.message || 'No se pudieron adjuntar las facturas.'; this.cdr.detectChanges(); }
    });
  }

  downloadArchivo(row: any, archivo: any): void {
    const idDetalle = row?.idDetalle;
    const idArchivo = archivo?.idArchivo;
    if (!idDetalle || !idArchivo) return;
    window.open(this.valorizaciones.downloadDetalleArchivoUrl(Number(idDetalle), Number(idArchivo)), '_blank');
  }


  exportarFacturasExcel(): void {
    if (!this.detalle.length) {
      this.msg = 'No hay facturas registradas para exportar.';
      this.cdr.detectChanges();
      return;
    }

    const rows = this.detalle.map((row: any) => ({
      Proveedor: row.proveedor || this.cabecera?.proveedor || '',
      'Fecha de factura': row.fechaFactura ? new Date(row.fechaFactura).toLocaleDateString('es-PE') : '',
      'Nro factura': row.numeroFactura || '',
      'Monto factura': Number(row.montoFactura || 0),
      Descripción: row.descripcion || '',
      'Tipo detracción': this.detraccionLabel(row.tipoDetraccion),
      Detracción: Number(row.detraccion || 0),
      Garantía: Number(row.garantia || 0),
      Transferido: Number(row.montoTransferido || 0),
      'Fecha transferido': row.fechaTransferencia ? new Date(row.fechaTransferencia).toLocaleDateString('es-PE') : ''
    }));

    const headers = Object.keys(rows[0]);
    const escapeCell = (value: any) => {
      const text = String(value ?? '');
      return /[",;\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = [headers.join(';'), ...rows.map((row: any) => headers.map(h => escapeCell(row[h])).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valorizaciones_facturas_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  formatMoney(value: any, moneda?: string): string {
    const number = Number(value || 0);
    const code = (moneda || this.monedaActual || 'PEN').toUpperCase() === 'USD' ? 'USD' : 'PEN';
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  }

  nuevaValorizacion(): void {
    this.cabecera = null;
    this.detalle = [];
    this.resumen = null;
    this.formValorizacion = { idValorizacion: null, idConfiguracion: null, periodo: this.defaultPeriodo(), observacion: '', usuario: 'system' };
    this.formDetalle = this.detalleVacio();
    this.syncDetalleCalculados();
  }

  detraccionLabel(tipo: string | null | undefined): string {
    return this.detraccionOptions.find(x => x.value === tipo)?.label || 'Sin detracción';
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
      tipoDetraccion: 'SinDetraccion',
      porcentajeDetraccion: 0,
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
